import { notFound } from "next/navigation";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { InvoiceRender } from "@/modules/invoices/components/invoice-render";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "@/modules/invoices/schema";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await requireCustomer();
  const { id } = await params;

  const rows = await db
    .select({
      invoice: schema.invoices,
      customer: schema.customers,
      template: schema.invoiceTemplates,
    })
    .from(schema.invoices)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.invoices.customerId))
    .leftJoin(
      schema.invoiceTemplates,
      eq(schema.invoiceTemplates.id, schema.invoices.templateId),
    )
    .where(
      and(
        eq(schema.invoices.orgId, active.org.id),
        eq(schema.invoices.id, id),
        eq(schema.invoices.customerId, active.contact.customerId),
      ),
    )
    .limit(1);
  if (!rows.length) notFound();
  const { invoice, customer, template } = rows[0];

  let orderNumber: string | null = null;
  if (invoice.orderId) {
    const o = await db
      .select({ number: schema.orders.number })
      .from(schema.orders)
      .where(eq(schema.orders.id, invoice.orderId))
      .limit(1);
    orderNumber = o[0]?.number ?? null;
  }

  const config = template?.config ?? DEFAULT_INVOICE_TEMPLATE_CONFIG;
  const layout = (template?.layout ?? "clean") as any;
  const items = (invoice.itemsSnapshot as any[]) ?? [];

  return (
    <html>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: "window.addEventListener('load', () => setTimeout(() => window.print(), 200));",
          }}
        />
        <InvoiceRender
          layout={layout}
          config={config}
          org={{
            name: active.org.name,
            logoUrl: active.org.logoUrl ?? null,
            currency: active.org.currency,
          }}
          customer={customer ?? (invoice.customerSnapshot as any)}
          invoice={{
            number: invoice.number,
            status: invoice.status,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            subtotal: invoice.subtotal,
            taxTotal: invoice.taxTotal,
            discountTotal: invoice.discountTotal,
            total: invoice.total,
            amountPaid: invoice.amountPaid,
            notes: invoice.notes,
            terms: invoice.terms,
            orderNumber,
          }}
          items={items}
        />
      </body>
    </html>
  );
}
