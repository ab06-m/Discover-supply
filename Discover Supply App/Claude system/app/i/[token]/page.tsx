import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { getInvoiceByToken } from "@/modules/invoices/queries";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { InvoiceRender } from "@/modules/invoices/components/invoice-render";
import { Button } from "@/components/ui/button";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "@/modules/invoices/schema";

export const dynamic = "force-dynamic";

// Public, tokenized invoice view. No login required.
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const record = await getInvoiceByToken(token);
  if (!record) notFound();
  const { invoice, customer, template, org, tokenId } = record;

  // Mark viewed + bump use count (fire and forget is fine; we've already loaded).
  await db
    .update(schema.accessTokens)
    .set({ uses: sql`${schema.accessTokens.uses} + 1` })
    .where(eq(schema.accessTokens.id, tokenId));
  if (!invoice.viewedAt) {
    await db
      .update(schema.invoices)
      .set({
        viewedAt: new Date(),
        status: invoice.status === "sent" ? "viewed" : invoice.status,
      })
      .where(eq(schema.invoices.id, invoice.id));
  }

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
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <div className="no-print flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Invoice from <span className="font-semibold">{org?.name}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/i/${token}/print`} target="_blank" rel="noopener noreferrer">
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </a>
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
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
        </div>

        <p className="no-print text-center text-xs text-slate-500">
          Questions? Contact {org?.name} directly.
        </p>
      </div>
    </div>
  );
}
