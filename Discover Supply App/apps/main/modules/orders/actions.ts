"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { generateDocNumber } from "@/modules/inventory/lib/generate-number";
import { applyStageEffect } from "./lib/apply-stage-effect";
import { getInitialStage, searchProductsForOrder } from "./queries";
import { DEFAULT_ORDER_TEMPLATE_CONFIG } from "./schema";
import {
  isMissingOrderTemplatesTable,
  ORDER_TEMPLATES_MIGRATION_MESSAGE,
} from "./template-db";

// `quantity` is what the user typed against the chosen unit (e.g. 2 if they
// picked Box, 12 if they picked Each). `unitPrice` is per-unit-of-measure —
// per-box price when uom=box, per-each price when uom=each. `packSize` is the
// multiplier applied at save time to compute the BASE-unit quantity persisted
// on `order_items.quantity` and used for stock effects.
const lineSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(64).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1),
  unitOfMeasure: z.enum(["each", "box"]).default("each"),
  packSize: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(1).default(0),
});

const createOrderSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(lineSchema).min(1),
});

function computeTotals(items: z.infer<typeof lineSchema>[]) {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;
  const lines = items.map((it) => {
    const gross = it.unitPrice * it.quantity;
    const afterDiscount = Math.max(0, gross - it.discount);
    const tax = +(afterDiscount * it.taxRate).toFixed(2);
    const lineTotal = +(afterDiscount + tax).toFixed(2);
    subtotal += gross;
    discountTotal += it.discount;
    taxTotal += tax;
    return { ...it, lineTotal };
  });
  const total = +(subtotal - discountTotal + taxTotal).toFixed(2);
  return {
    lines,
    subtotal: +subtotal.toFixed(2),
    taxTotal: +taxTotal.toFixed(2),
    discountTotal: +discountTotal.toFixed(2),
    total,
  };
}

export async function createOrder(input: z.input<typeof createOrderSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "order.create");
  const parsed = createOrderSchema.parse(input);

  const initialStage = await getInitialStage(org.id);
  if (!initialStage) throw new Error("No order stages configured for this workspace.");

  const number = await generateDocNumber({
    table: schema.orders,
    orgId: org.id,
    prefix: "SO",
  });

  const totals = computeTotals(parsed.items);

  let shippingAddress: unknown = null;
  if (parsed.customerId) {
    const cust = await db
      .select({ shippingAddress: schema.customers.shippingAddress })
      .from(schema.customers)
      .where(and(eq(schema.customers.orgId, org.id), eq(schema.customers.id, parsed.customerId)))
      .limit(1);
    shippingAddress = cust[0]?.shippingAddress ?? null;
  }

  const [order] = await db
    .insert(schema.orders)
    .values({
      orgId: org.id,
      number,
      customerId: parsed.customerId || null,
      stageId: initialStage.id,
      shippingAddress: shippingAddress as any,
      subtotal: String(totals.subtotal),
      taxTotal: String(totals.taxTotal),
      discountTotal: String(totals.discountTotal),
      total: String(totals.total),
      notes: parsed.notes || null,
      internalNotes: parsed.internalNotes || null,
      createdBy: user.id,
      source: "staff",
    })
    .returning({ id: schema.orders.id, number: schema.orders.number });

  await db.insert(schema.orderItems).values(
    totals.lines.map((l) => {
      const packSize = l.unitOfMeasure === "box" ? l.packSize : 1;
      const baseQty = l.quantity * packSize;
      return {
        orgId: org.id,
        orderId: order.id,
        productId: l.productId || null,
        name: l.name,
        sku: l.sku || null,
        // `quantity` is the BASE-unit count; `quantityInput` preserves what
        // the user typed so the line renders the same way next time.
        quantity: baseQty,
        quantityInput: l.quantity,
        unitOfMeasure: l.unitOfMeasure,
        packSize,
        unitPrice: String(l.unitPrice),
        discount: String(l.discount),
        taxRate: String(l.taxRate),
        lineTotal: String(l.lineTotal),
      };
    }),
  );

  await db.insert(schema.orderStageHistory).values({
    orgId: org.id,
    orderId: order.id,
    fromStageId: null,
    toStageId: initialStage.id,
    changedBy: user.id,
    note: "Order created",
  });

  // If the initial stage already has an effect (unusual but allowed), run it.
  if (initialStage.effect !== "none") {
    await applyStageEffect({
      orgId: org.id,
      orderId: order.id,
      effect: initialStage.effect,
      userId: user.id,
    });
  }

  revalidatePath("/orders");
  return { id: order.id, number: order.number };
}

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  toStageId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export async function transitionOrderStage(input: z.input<typeof transitionSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "order.advance_stage");
  const parsed = transitionSchema.parse(input);

  const current = await db
    .select({ id: schema.orders.id, stageId: schema.orders.stageId })
    .from(schema.orders)
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)))
    .limit(1);
  if (!current.length) throw new Error("Order not found");
  const fromStageId = current[0].stageId;

  const target = await db
    .select()
    .from(schema.orderStages)
    .where(and(eq(schema.orderStages.orgId, org.id), eq(schema.orderStages.id, parsed.toStageId)))
    .limit(1);
  if (!target.length) throw new Error("Target stage not found");
  const toStage = target[0];

  if (fromStageId === toStage.id) return;

  await db
    .update(schema.orders)
    .set({ stageId: toStage.id, updatedAt: new Date() })
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)));

  await db.insert(schema.orderStageHistory).values({
    orgId: org.id,
    orderId: parsed.orderId,
    fromStageId,
    toStageId: toStage.id,
    changedBy: user.id,
    note: parsed.note ?? null,
  });

  await applyStageEffect({
    orgId: org.id,
    orderId: parsed.orderId,
    effect: toStage.effect,
    userId: user.id,
  });

  revalidatePath(`/orders/${parsed.orderId}`);
  revalidatePath("/orders");
}

const editItemsSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(lineSchema).min(1),
});

export async function replaceOrderItems(input: z.input<typeof editItemsSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "order.edit");
  const parsed = editItemsSchema.parse(input);

  // Guard: don't allow edit after stock has been committed/consumed.
  const order = await db
    .select({
      id: schema.orders.id,
      effect: schema.orderStages.effect,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)))
    .limit(1);
  if (!order.length) throw new Error("Order not found");
  const effect = order[0].effect;
  if (effect === "commit" || effect === "consume") {
    throw new Error(
      "Cannot edit items after the order has reserved or shipped stock. Move it back to Draft first.",
    );
  }

  const totals = computeTotals(parsed.items);

  await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, parsed.orderId));
  await db.insert(schema.orderItems).values(
    totals.lines.map((l) => {
      const packSize = l.unitOfMeasure === "box" ? l.packSize : 1;
      const baseQty = l.quantity * packSize;
      return {
        orgId: org.id,
        orderId: parsed.orderId,
        productId: l.productId || null,
        name: l.name,
        sku: l.sku || null,
        quantity: baseQty,
        quantityInput: l.quantity,
        unitOfMeasure: l.unitOfMeasure,
        packSize,
        unitPrice: String(l.unitPrice),
        discount: String(l.discount),
        taxRate: String(l.taxRate),
        lineTotal: String(l.lineTotal),
      };
    }),
  );

  await db
    .update(schema.orders)
    .set({
      subtotal: String(totals.subtotal),
      taxTotal: String(totals.taxTotal),
      discountTotal: String(totals.discountTotal),
      total: String(totals.total),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)));

  revalidatePath(`/orders/${parsed.orderId}`);
}

const notesSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export async function updateOrderNotes(input: z.input<typeof notesSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "order.edit");
  const parsed = notesSchema.parse(input);
  await db
    .update(schema.orders)
    .set({
      notes: parsed.notes ?? null,
      internalNotes: parsed.internalNotes ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)));
  revalidatePath(`/orders/${parsed.orderId}`);
}

export async function searchOrderProducts(query: string) {
  const { org } = await requireActiveOrg();
  return searchProductsForOrder(org.id, query);
}

export async function browseOrderProducts(opts: { search?: string; limit?: number } = {}) {
  const { org } = await requireActiveOrg();
  const { listProducts } = await import("@/modules/inventory/queries");
  const rows = await listProducts(org.id, {
    search: opts.search,
    limit: opts.limit ?? 50,
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    unit: p.unit,
    packSize: p.packSize,
    price: p.price,
    onHand: p.onHand,
    committed: p.committed,
    imageUrl: p.imageUrl,
  }));
}

const optionalTemplateText = z
  .string()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const orderTemplateConfigSchema = z.object({
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default(DEFAULT_ORDER_TEMPLATE_CONFIG.brandColor),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default(DEFAULT_ORDER_TEMPLATE_CONFIG.accentColor),
  fontFamily: z.enum(["sans", "serif", "mono"]).default(DEFAULT_ORDER_TEMPLATE_CONFIG.fontFamily),
  showLogo: z.boolean().default(DEFAULT_ORDER_TEMPLATE_CONFIG.showLogo),
  logoUrl: z
    .string()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  headerText: optionalTemplateText,
  footerText: optionalTemplateText,
  termsText: optionalTemplateText,
  showTaxBreakdown: z.boolean().default(DEFAULT_ORDER_TEMPLATE_CONFIG.showTaxBreakdown),
  dateFormat: z.enum(["us", "iso", "eu"]).default(DEFAULT_ORDER_TEMPLATE_CONFIG.dateFormat),
  showOrderNumber: z.boolean().default(DEFAULT_ORDER_TEMPLATE_CONFIG.showOrderNumber),
  showCustomerAddress: z.boolean().default(DEFAULT_ORDER_TEMPLATE_CONFIG.showCustomerAddress),
  showSignatureBlock: z.boolean().default(DEFAULT_ORDER_TEMPLATE_CONFIG.showSignatureBlock),
});

const orderTemplateSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1).max(120),
  layout: z.enum(["clean", "bold", "classic", "receipt"]),
  isDefault: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
  config: orderTemplateConfigSchema,
});

async function ensureOrderTemplateDefault(orgId: string, fallbackTemplateId: string) {
  const defaults = await db
    .select({ id: schema.orderTemplates.id })
    .from(schema.orderTemplates)
    .where(and(eq(schema.orderTemplates.orgId, orgId), eq(schema.orderTemplates.isDefault, true)))
    .limit(1);
  if (!defaults.length) {
    await db
      .update(schema.orderTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(schema.orderTemplates.orgId, orgId),
          eq(schema.orderTemplates.id, fallbackTemplateId),
        ),
      );
  }
}

export async function saveOrderTemplate(input: z.input<typeof orderTemplateSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "template.manage");
  const parsed = orderTemplateSchema.parse(input);

  try {
    if (parsed.isDefault) {
      await db
        .update(schema.orderTemplates)
        .set({ isDefault: false })
        .where(eq(schema.orderTemplates.orgId, org.id));
    }

    if (parsed.id) {
      await db
        .update(schema.orderTemplates)
        .set({
          name: parsed.name,
          layout: parsed.layout,
          isDefault: parsed.isDefault ?? false,
          config: parsed.config,
          updatedAt: new Date(),
        })
        .where(
          and(eq(schema.orderTemplates.orgId, org.id), eq(schema.orderTemplates.id, parsed.id)),
        );
      await ensureOrderTemplateDefault(org.id, parsed.id);
      revalidatePath("/settings/templates");
      revalidatePath("/orders");
      return { id: parsed.id };
    }

    const [row] = await db
      .insert(schema.orderTemplates)
      .values({
        orgId: org.id,
        name: parsed.name,
        layout: parsed.layout,
        isDefault: parsed.isDefault ?? false,
        config: parsed.config,
      })
      .returning({ id: schema.orderTemplates.id });

    await ensureOrderTemplateDefault(org.id, row.id);
    revalidatePath("/settings/templates");
    revalidatePath("/orders");
    return { id: row.id };
  } catch (error) {
    if (isMissingOrderTemplatesTable(error)) {
      throw new Error(ORDER_TEMPLATES_MIGRATION_MESSAGE);
    }
    throw error;
  }
}
