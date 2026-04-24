import { notFound } from "next/navigation";
import { getInvoiceByToken } from "@/modules/invoices/queries";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { InvoiceRender } from "@/modules/invoices/components/invoice-render";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "@/modules/invoices/schema";

export const dynamic = "force-dynamic";

export default async function PublicInvoicePrintPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await getInvoiceByToken(token);
  if (!record) notFound();
  const { invoice, customer, template, org } = record;

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
            name: org?.name ?? "",
            logoUrl: org?.logoUrl ?? null,
            currency: org?.currency ?? "USD",
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
