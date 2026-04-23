import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { InvoiceRender } from "@/modules/invoices/components/invoice-render";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "@/modules/invoices/schema";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PortalInvoiceDetail({
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/portal/invoices"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
        <Button asChild variant="outline" size="sm">
          <a href={`/portal/invoices/${id}/print`} target="_blank" rel="noopener noreferrer">
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </a>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
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
      </div>
    </div>
  );
}
