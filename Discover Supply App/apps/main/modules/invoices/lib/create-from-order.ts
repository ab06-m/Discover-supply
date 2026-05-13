import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  generateDocNumber,
  withDocumentNumberRetry,
} from "@/modules/inventory/lib/generate-number";

type InvoiceExecutor = Pick<typeof db, "select" | "insert">;

type CreateInvoiceForOrderInput = {
  orgId: string;
  orderId: string;
  templateId?: string | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  executor?: InvoiceExecutor;
};

export async function createInvoiceForOrder({
  orgId,
  orderId,
  templateId: requestedTemplateId = null,
  dueDate = null,
  notes = null,
  terms = null,
  executor = db,
}: CreateInvoiceForOrderInput) {
  const existing = await executor
    .select({ id: schema.invoices.id, number: schema.invoices.number })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.orgId, orgId), eq(schema.invoices.orderId, orderId)))
    .limit(1);
  if (existing.length) {
    return { ...existing[0], created: false };
  }

  const order = await executor
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.orgId, orgId), eq(schema.orders.id, orderId)))
    .limit(1);
  if (!order.length) throw new Error("Order not found");
  const o = order[0];

  const items = await executor
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, o.id));

  let customerSnapshot: unknown = null;
  if (o.customerId) {
    const customer = await executor
      .select()
      .from(schema.customers)
      .where(and(eq(schema.customers.orgId, orgId), eq(schema.customers.id, o.customerId)))
      .limit(1);
    customerSnapshot = customer[0] ?? null;
  }

  let templateId = requestedTemplateId || null;
  if (!templateId) {
    const defaults = await executor
      .select({ id: schema.invoiceTemplates.id })
      .from(schema.invoiceTemplates)
      .where(
        and(eq(schema.invoiceTemplates.orgId, orgId), eq(schema.invoiceTemplates.isDefault, true)),
      )
      .limit(1);
    templateId = defaults[0]?.id ?? null;
  }

  const invoice = await withDocumentNumberRetry(async () => {
    const number = await generateDocNumber({
      table: schema.invoices,
      orgId,
      prefix: "INV",
    });

    const [createdInvoice] = await executor
      .insert(schema.invoices)
      .values({
        orgId,
        orderId: o.id,
        customerId: o.customerId,
        templateId,
        number,
        status: "draft",
        dueDate,
        subtotal: o.subtotal,
        taxTotal: o.taxTotal,
        discountTotal: o.discountTotal,
        total: o.total,
        amountPaid: o.amountPaid,
        customerSnapshot: customerSnapshot as any,
        itemsSnapshot: items as any,
        notes,
        terms,
      })
      .returning({ id: schema.invoices.id, number: schema.invoices.number });

    return createdInvoice;
  });

  return { ...invoice, created: true };
}
