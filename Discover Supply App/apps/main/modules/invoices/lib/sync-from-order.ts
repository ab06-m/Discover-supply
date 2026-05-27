import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type InvoiceExecutor = Pick<typeof db, "select" | "update">;

/** Keep draft invoice totals/lines aligned when an order is edited after confirmation. */
export async function syncDraftInvoiceFromOrder({
  orgId,
  orderId,
  executor = db,
}: {
  orgId: string;
  orderId: string;
  executor?: InvoiceExecutor;
}) {
  const invoice = await executor
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.orgId, orgId),
        eq(schema.invoices.orderId, orderId),
        eq(schema.invoices.status, "draft"),
      ),
    )
    .limit(1);
  if (!invoice.length) return;

  const [order, items] = await Promise.all([
    executor
      .select({
        subtotal: schema.orders.subtotal,
        taxTotal: schema.orders.taxTotal,
        discountTotal: schema.orders.discountTotal,
        total: schema.orders.total,
        amountPaid: schema.orders.amountPaid,
      })
      .from(schema.orders)
      .where(and(eq(schema.orders.orgId, orgId), eq(schema.orders.id, orderId)))
      .limit(1),
    executor
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId)),
  ]);

  if (!order.length) return;

  await executor
    .update(schema.invoices)
    .set({
      subtotal: order[0].subtotal,
      taxTotal: order[0].taxTotal,
      discountTotal: order[0].discountTotal,
      total: order[0].total,
      amountPaid: order[0].amountPaid,
      itemsSnapshot: items as any,
    })
    .where(and(eq(schema.invoices.orgId, orgId), eq(schema.invoices.id, invoice[0].id)));
}
