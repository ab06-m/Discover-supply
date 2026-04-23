/**
 * Invoice renderer — pure presentational. Same component renders:
 *   - staff detail page
 *   - customer-portal view
 *   - tokenized public link (no auth)
 *   - PDF capture (print stylesheet)
 *
 * Renders one of five layouts. The layout choice is a cosmetic switch;
 * colors/logo/texts come from `config`. Merge fields ({{org.name}}, etc.)
 * are resolved in header/footer/terms at render time.
 */

import { renderMergeFields } from "../lib/merge-fields";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "../schema";
import type { InvoiceTemplateConfig } from "../schema";
import { formatMoney } from "@/lib/utils";

type InvoiceItem = {
  name: string;
  sku?: string | null;
  quantity: number;
  unitPrice: string | number;
  discount?: string | number;
  taxRate?: string | number;
  lineTotal: string | number;
};

type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
} | null;

type CustomerSnap = {
  name?: string;
  storeCode?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: Address;
  shippingAddress?: Address;
} | null;

type OrgSnap = {
  name: string;
  logoUrl?: string | null;
  currency: string;
  address?: Address;
};

export type InvoiceRenderProps = {
  layout?: "clean" | "bold" | "minimal" | "classic" | "receipt";
  config?: Partial<InvoiceTemplateConfig>;
  org: OrgSnap;
  customer: CustomerSnap;
  invoice: {
    number: string;
    status: string;
    issueDate: string | Date;
    dueDate?: string | Date | null;
    subtotal: string | number;
    taxTotal: string | number;
    discountTotal: string | number;
    total: string | number;
    amountPaid: string | number;
    notes?: string | null;
    terms?: string | null;
    orderNumber?: string | null;
  };
  items: InvoiceItem[];
};

function formatDate(d: string | Date, fmt: InvoiceTemplateConfig["dateFormat"]): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (fmt === "iso") return date.toISOString().slice(0, 10);
  if (fmt === "eu") return date.toLocaleDateString("en-GB");
  return date.toLocaleDateString("en-US");
}

export function InvoiceRender(props: InvoiceRenderProps) {
  const config: InvoiceTemplateConfig = { ...DEFAULT_INVOICE_TEMPLATE_CONFIG, ...(props.config ?? {}) };
  const layout = props.layout ?? "clean";
  const { org, customer, invoice, items } = props;

  const balance = +(+invoice.total - +invoice.amountPaid).toFixed(2);

  const mergeCtx = {
    org,
    customer: customer ?? {},
    invoice: {
      ...invoice,
      issueDate: formatDate(invoice.issueDate, config.dateFormat),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate, config.dateFormat) : "",
      balance: formatMoney(balance, org.currency),
      total: formatMoney(invoice.total, org.currency),
    },
    order: { number: invoice.orderNumber ?? "" },
  };

  const fontClass =
    config.fontFamily === "serif"
      ? "font-serif"
      : config.fontFamily === "mono"
        ? "font-mono"
        : "font-sans";

  const brand = config.brandColor;
  const accent = config.accentColor;

  return (
    <div className={`invoice-render ${fontClass} bg-white text-slate-900 print:shadow-none`}>
      <style>{`
        @media print {
          .invoice-render { padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {layout === "bold" && (
        <div
          className="px-8 py-10 text-white"
          style={{ backgroundColor: brand }}
        >
          <div className="flex items-start justify-between gap-6">
            <div>
              {config.showLogo && config.logoUrl && (
                <img src={config.logoUrl} alt="" className="mb-3 h-12 object-contain" />
              )}
              <div className="text-2xl font-bold">{org.name}</div>
              <AddressBlock addr={org.address} className="mt-1 text-sm opacity-80" />
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest opacity-70">Invoice</div>
              <div className="text-3xl font-bold">{invoice.number}</div>
              <div className="mt-2 text-sm opacity-90">
                {formatDate(invoice.issueDate, config.dateFormat)}
              </div>
            </div>
          </div>
        </div>
      )}

      {layout === "receipt" && (
        <div className="border-b-2 border-dashed border-slate-300 px-6 py-6 text-center">
          {config.showLogo && config.logoUrl && (
            <img src={config.logoUrl} alt="" className="mx-auto mb-2 h-10 object-contain" />
          )}
          <div className="text-lg font-bold">{org.name}</div>
          <AddressBlock addr={org.address} className="mt-1 text-xs text-slate-600" />
          <div className="mt-3 text-xs uppercase tracking-widest text-slate-500">
            Receipt · {invoice.number}
          </div>
        </div>
      )}

      {(layout === "clean" || layout === "minimal" || layout === "classic") && (
        <div
          className={`px-8 pt-8 ${layout === "classic" ? "border-b-4" : "border-b"}`}
          style={layout === "classic" ? { borderColor: brand } : undefined}
        >
          <div className="flex items-start justify-between gap-6 pb-6">
            <div>
              {config.showLogo && config.logoUrl && (
                <img src={config.logoUrl} alt="" className="mb-3 h-12 object-contain" />
              )}
              <div
                className={`text-xl font-bold ${layout === "minimal" ? "text-slate-900" : ""}`}
                style={layout !== "minimal" ? { color: brand } : undefined}
              >
                {org.name}
              </div>
              <AddressBlock addr={org.address} className="mt-1 text-xs text-slate-600" />
            </div>
            <div className="text-right">
              <div
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: accent }}
              >
                Invoice
              </div>
              <div className="mt-1 text-2xl font-bold">{invoice.number}</div>
              <div className="mt-1 text-sm text-slate-600">
                {formatDate(invoice.issueDate, config.dateFormat)}
              </div>
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>
      )}

      {config.headerText && (
        <div className="px-8 pt-4 text-sm text-slate-700">
          {renderMergeFields(config.headerText, mergeCtx)}
        </div>
      )}

      <div className="px-8 py-6">
        {layout !== "receipt" && (
          <div className="mb-6 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Bill to
              </div>
              <div className="mt-1 text-sm">
                <div className="font-semibold">{customer?.name ?? "—"}</div>
                {customer?.storeCode && (
                  <div className="text-slate-600">Code {customer.storeCode}</div>
                )}
                <AddressBlock addr={customer?.billingAddress} className="mt-1 text-slate-700" />
                {customer?.email && (
                  <div className="mt-1 text-slate-600">{customer.email}</div>
                )}
              </div>
            </div>
            {config.showDueDate && invoice.dueDate && (
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Due date
                </div>
                <div className="mt-1 text-lg font-semibold" style={{ color: accent }}>
                  {formatDate(invoice.dueDate, config.dateFormat)}
                </div>
                {config.showOrderNumber && invoice.orderNumber && (
                  <div className="mt-2 text-xs text-slate-500">
                    Order {invoice.orderNumber}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr
              className={
                layout === "receipt"
                  ? "border-b border-dashed border-slate-400"
                  : "border-b-2"
              }
              style={layout !== "receipt" ? { borderColor: brand } : undefined}
            >
              <th className="py-2 text-left font-semibold">Item</th>
              <th className="py-2 text-right font-semibold w-16">Qty</th>
              <th className="py-2 text-right font-semibold w-24">Price</th>
              <th className="py-2 text-right font-semibold w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-2">
                  <div>{it.name}</div>
                  {it.sku && <div className="text-xs text-slate-500">{it.sku}</div>}
                </td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">{formatMoney(it.unitPrice, org.currency)}</td>
                <td className="py-2 text-right font-medium">
                  {formatMoney(it.lineTotal, org.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <TotalsRow
              label="Subtotal"
              value={formatMoney(invoice.subtotal, org.currency)}
            />
            {+invoice.discountTotal > 0 && (
              <TotalsRow
                label="Discount"
                value={`− ${formatMoney(invoice.discountTotal, org.currency)}`}
              />
            )}
            {config.showTaxBreakdown && +invoice.taxTotal > 0 && (
              <TotalsRow label="Tax" value={formatMoney(invoice.taxTotal, org.currency)} />
            )}
            <div className="border-t pt-2" style={{ borderColor: brand }}>
              <TotalsRow
                label="Total"
                value={formatMoney(invoice.total, org.currency)}
                emphasize
              />
            </div>
            {+invoice.amountPaid > 0 && (
              <>
                <TotalsRow
                  label="Paid"
                  value={`− ${formatMoney(invoice.amountPaid, org.currency)}`}
                />
                <TotalsRow
                  label="Balance due"
                  value={formatMoney(balance, org.currency)}
                  emphasize
                />
              </>
            )}
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-6 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="mb-1 text-xs uppercase text-slate-500">Notes</div>
            <div className="whitespace-pre-wrap">{invoice.notes}</div>
          </div>
        )}

        {config.showPaymentInstructions && config.paymentInstructions && (
          <div className="mt-4 rounded border p-3 text-sm" style={{ borderColor: accent }}>
            <div className="mb-1 text-xs font-semibold uppercase" style={{ color: accent }}>
              Payment instructions
            </div>
            <div className="whitespace-pre-wrap">
              {renderMergeFields(config.paymentInstructions, mergeCtx)}
            </div>
          </div>
        )}

        {(invoice.terms || config.termsText) && (
          <div className="mt-4 text-xs text-slate-600">
            <div className="mb-1 font-semibold uppercase">Terms</div>
            <div className="whitespace-pre-wrap">
              {invoice.terms ?? renderMergeFields(config.termsText, mergeCtx)}
            </div>
          </div>
        )}
      </div>

      {config.footerText && (
        <div
          className={`px-8 py-4 text-center text-xs ${
            layout === "bold" ? "text-white" : "text-slate-600"
          }`}
          style={layout === "bold" ? { backgroundColor: brand } : undefined}
        >
          {renderMergeFields(config.footerText, mergeCtx)}
        </div>
      )}
    </div>
  );
}

function TotalsRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasize ? "text-base font-bold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AddressBlock({ addr, className = "" }: { addr?: Address; className?: string }) {
  if (!addr?.line1) return null;
  return (
    <div className={className}>
      <div>{addr.line1}</div>
      {addr.line2 && <div>{addr.line2}</div>}
      <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}</div>
      {addr.country && <div>{addr.country}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-100 text-blue-700",
    viewed: "bg-sky-100 text-sky-700",
    partial: "bg-amber-100 text-amber-700",
    paid: "bg-emerald-100 text-emerald-700",
    overdue: "bg-rose-100 text-rose-700",
    void: "bg-slate-200 text-slate-500 line-through",
  };
  return (
    <span
      className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${
        colors[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}
