"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { generateDocNumber, withDocumentNumberRetry } from "@/modules/inventory/lib/generate-number";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "./schema";

const createFromOrderSchema = z.object({
  orderId: z.string().uuid(),
  templateId: z.string().uuid().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")), // ISO string
  notes: z.string().max(2000).optional().or(z.literal("")),
  terms: z.string().max(2000).optional().or(z.literal("")),
});

export async function createInvoiceFromOrder(input: z.input<typeof createFromOrderSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "invoice.create");
  const parsed = createFromOrderSchema.parse(input);

  const order = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)))
    .limit(1);
  if (!order.length) throw new Error("Order not found");
  const o = order[0];

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, o.id));

  let customerSnapshot: unknown = null;
  if (o.customerId) {
    const c = await db
      .select()
      .from(schema.customers)
      .where(and(eq(schema.customers.orgId, org.id), eq(schema.customers.id, o.customerId)))
      .limit(1);
    customerSnapshot = c[0] ?? null;
  }

  // Pick template: explicit → org default → null
  let templateId = parsed.templateId || null;
  if (!templateId) {
    const defaults = await db
      .select({ id: schema.invoiceTemplates.id })
      .from(schema.invoiceTemplates)
      .where(
        and(
          eq(schema.invoiceTemplates.orgId, org.id),
          eq(schema.invoiceTemplates.isDefault, true),
        ),
      )
      .limit(1);
    templateId = defaults[0]?.id ?? null;
  }

  const invoice = await withDocumentNumberRetry(async () => {
    const number = await generateDocNumber({
      table: schema.invoices,
      orgId: org.id,
      prefix: "INV",
    });

    const [createdInvoice] = await db
      .insert(schema.invoices)
      .values({
        orgId: org.id,
        orderId: o.id,
        customerId: o.customerId,
        templateId,
        number,
        status: "draft",
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        subtotal: o.subtotal,
        taxTotal: o.taxTotal,
        discountTotal: o.discountTotal,
        total: o.total,
        amountPaid: o.amountPaid,
        customerSnapshot: customerSnapshot as any,
        itemsSnapshot: items as any,
        notes: parsed.notes || null,
        terms: parsed.terms || null,
      })
      .returning({ id: schema.invoices.id, number: schema.invoices.number });

    return createdInvoice;
  });

  revalidatePath("/invoices");
  revalidatePath(`/orders/${o.id}`);
  return { id: invoice.id, number: invoice.number };
}

const sendSchema = z.object({ invoiceId: z.string().uuid() });

export async function markInvoiceSent(input: z.input<typeof sendSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "invoice.send");
  const parsed = sendSchema.parse(input);
  await db
    .update(schema.invoices)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(schema.invoices.orgId, org.id), eq(schema.invoices.id, parsed.invoiceId)));
  revalidatePath(`/invoices/${parsed.invoiceId}`);
  revalidatePath("/invoices");
}

// Create / rotate a tokenized public link for the invoice. No password required.
export async function createInvoiceShareLink(invoiceId: string, daysValid = 30) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "invoice.send");

  const invoice = await db
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.orgId, org.id), eq(schema.invoices.id, invoiceId)))
    .limit(1);
  if (!invoice.length) throw new Error("Invoice not found");

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysValid);

  await db.insert(schema.accessTokens).values({
    orgId: org.id,
    entityType: "invoice",
    entityId: invoiceId,
    token,
    expiresAt,
    createdBy: user.id,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  return { token };
}

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().min(0.01),
  method: z.enum(["cash", "check", "ach", "card", "other"]).default("cash"),
  reference: z.string().max(120).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export async function recordPayment(input: z.input<typeof paymentSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "invoice.record_payment");
  const parsed = paymentSchema.parse(input);

  await db.transaction(async (tx) => {
    const inv = await tx
      .select({ total: schema.invoices.total })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.orgId, org.id), eq(schema.invoices.id, parsed.invoiceId)))
      .limit(1);
    if (!inv.length) throw new Error("Invoice not found");

    await tx.insert(schema.payments).values({
      orgId: org.id,
      invoiceId: parsed.invoiceId,
      amount: String(parsed.amount),
      method: parsed.method,
      reference: parsed.reference || null,
      note: parsed.note || null,
      createdBy: user.id,
    });

    const [{ paid }] = await tx
      .select({ paid: sql<string>`coalesce(sum(${schema.payments.amount}), 0)::text` })
      .from(schema.payments)
      .where(and(eq(schema.payments.orgId, org.id), eq(schema.payments.invoiceId, parsed.invoiceId)));

    const paidNum = parseFloat(paid);
    const totalNum = parseFloat(inv[0].total);
    const newStatus: "paid" | "partial" | "sent" =
      paidNum >= totalNum ? "paid" : paidNum > 0 ? "partial" : "sent";

    await tx
      .update(schema.invoices)
      .set({ amountPaid: paid, status: newStatus })
      .where(and(eq(schema.invoices.orgId, org.id), eq(schema.invoices.id, parsed.invoiceId)));
  });

  revalidatePath(`/invoices/${parsed.invoiceId}`);
  revalidatePath("/invoices");
}

const optionalTemplateText = z
  .string()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const templateConfigSchema = z.object({
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default(DEFAULT_INVOICE_TEMPLATE_CONFIG.brandColor),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default(DEFAULT_INVOICE_TEMPLATE_CONFIG.accentColor),
  fontFamily: z.enum(["sans", "serif", "mono"]).default(DEFAULT_INVOICE_TEMPLATE_CONFIG.fontFamily),
  showLogo: z.boolean().default(DEFAULT_INVOICE_TEMPLATE_CONFIG.showLogo),
  logoUrl: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  headerText: optionalTemplateText,
  footerText: optionalTemplateText,
  termsText: optionalTemplateText,
  showTaxBreakdown: z.boolean().default(DEFAULT_INVOICE_TEMPLATE_CONFIG.showTaxBreakdown),
  showPaymentInstructions: z
    .boolean()
    .default(DEFAULT_INVOICE_TEMPLATE_CONFIG.showPaymentInstructions),
  paymentInstructions: optionalTemplateText,
  dateFormat: z.enum(["us", "iso", "eu"]).default(DEFAULT_INVOICE_TEMPLATE_CONFIG.dateFormat),
  showDueDate: z.boolean().default(DEFAULT_INVOICE_TEMPLATE_CONFIG.showDueDate),
  showOrderNumber: z.boolean().default(DEFAULT_INVOICE_TEMPLATE_CONFIG.showOrderNumber),
});

const templateSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1).max(120),
  layout: z.enum(["clean", "bold", "minimal", "classic", "receipt"]),
  isDefault: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
  config: templateConfigSchema,
});

async function ensureTemplateDefault(orgId: string, fallbackTemplateId: string) {
  const defaults = await db
    .select({ id: schema.invoiceTemplates.id })
    .from(schema.invoiceTemplates)
    .where(and(eq(schema.invoiceTemplates.orgId, orgId), eq(schema.invoiceTemplates.isDefault, true)))
    .limit(1);

  if (!defaults.length) {
    await db
      .update(schema.invoiceTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(schema.invoiceTemplates.orgId, orgId),
          eq(schema.invoiceTemplates.id, fallbackTemplateId),
        ),
      );
  }
}

export async function saveInvoiceTemplate(input: z.input<typeof templateSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "template.manage");
  const parsed = templateSchema.parse(input);

  if (parsed.isDefault) {
    await db
      .update(schema.invoiceTemplates)
      .set({ isDefault: false })
      .where(eq(schema.invoiceTemplates.orgId, org.id));
  }

  if (parsed.id) {
    await db
      .update(schema.invoiceTemplates)
      .set({
        name: parsed.name,
        layout: parsed.layout,
        isDefault: parsed.isDefault ?? false,
        config: parsed.config,
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.invoiceTemplates.orgId, org.id), eq(schema.invoiceTemplates.id, parsed.id)),
      );
    await ensureTemplateDefault(org.id, parsed.id);
    revalidatePath("/settings/templates");
    revalidatePath("/settings");
    revalidatePath("/invoices");
    return { id: parsed.id };
  }

  const [row] = await db
    .insert(schema.invoiceTemplates)
    .values({
      orgId: org.id,
      name: parsed.name,
      layout: parsed.layout,
      isDefault: parsed.isDefault ?? false,
      config: parsed.config,
    })
    .returning({ id: schema.invoiceTemplates.id });

  await ensureTemplateDefault(org.id, row.id);
  revalidatePath("/settings/templates");
  revalidatePath("/settings");
  revalidatePath("/invoices");
  return { id: row.id };
}
