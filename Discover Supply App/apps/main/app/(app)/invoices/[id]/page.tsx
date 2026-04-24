import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Send, Printer } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { getInvoice } from "@/modules/invoices/queries";
import { db, schema } from "@/lib/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { InvoiceRender } from "@/modules/invoices/components/invoice-render";
import { ShareLinkButton } from "@/modules/invoices/components/share-link";
import { PaymentForm } from "@/modules/invoices/components/payment-form";
import { markInvoiceSent } from "@/modules/invoices/actions";
import { can, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "@/modules/invoices/schema";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  const { id } = await params;

  const record = await getInvoice(org.id, id);
  if (!record) notFound();
  const { invoice, customer, template, payments } = record;

  // Look up order number if linked.
  let orderNumber: string | null = null;
  if (invoice.orderId) {
    const o = await db
      .select({ number: schema.orders.number })
      .from(schema.orders)
      .where(eq(schema.orders.id, invoice.orderId))
      .limit(1);
    orderNumber = o[0]?.number ?? null;
  }

  // Find an active share token (if any).
  const activeTokens = await db
    .select({ token: schema.accessTokens.token })
    .from(schema.accessTokens)
    .where(
      and(
        eq(schema.accessTokens.orgId, org.id),
        eq(schema.accessTokens.entityType, "invoice"),
        eq(schema.accessTokens.entityId, id),
        isNull(schema.accessTokens.revokedAt),
      ),
    )
    .orderBy(desc(schema.accessTokens.createdAt))
    .limit(1);
  const shareToken = activeTokens[0]?.token ?? null;

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";

  const balance = parseFloat(invoice.total) - parseFloat(invoice.amountPaid);
  const canSend = can(role as Role, "invoice.send");
  const canPay = can(role as Role, "invoice.record_payment");

  const config = template?.config ?? DEFAULT_INVOICE_TEMPLATE_CONFIG;
  const layout = (template?.layout ?? "clean") as any;
  const items = (invoice.itemsSnapshot as any[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link
          href="/invoices"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to invoices
        </Link>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{invoice.number}</h1>
          <p className="text-sm text-muted-foreground">
            {customer?.name ?? "—"} · {formatMoney(invoice.total, org.currency)}
          </p>
        </div>
        <div className="flex gap-2">
          {canSend && invoice.status === "draft" && (
            <form
              action={async () => {
                "use server";
                await markInvoiceSent({ invoiceId: id });
              }}
            >
              <Button type="submit" variant="outline">
                <Send className="mr-2 h-4 w-4" /> Mark sent
              </Button>
            </form>
          )}
          <Button asChild variant="outline">
            <a href={`/invoices/${id}/print`} target="_blank" rel="noopener noreferrer">
              <Printer className="mr-2 h-4 w-4" /> Print / PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <InvoiceRender
            layout={layout}
            config={config}
            org={{
              name: org.name,
              logoUrl: org.logoUrl ?? null,
              currency: org.currency,
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
            items={items.map((it) => ({
              name: it.name,
              sku: it.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount,
              taxRate: it.taxRate,
              lineTotal: it.lineTotal,
            }))}
          />
        </div>

        <aside className="no-print space-y-4">
          {canSend && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Share link</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Passwordless link your customer can open from email.
                </p>
                <ShareLinkButton
                  invoiceId={id}
                  baseUrl={baseUrl}
                  existingToken={shareToken}
                />
              </CardContent>
            </Card>
          )}

          {canPay && balance > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record payment</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentForm invoiceId={id} suggestedAmount={balance} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <div>
                        <div className="font-medium">
                          {formatMoney(p.amount, org.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.method} · {new Date(p.receivedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {p.reference && (
                        <span className="text-xs text-muted-foreground">{p.reference}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
