/**
 * Pure sales-order renderer used by staff print pages.
 * Layout controls structure; config controls branding, copy, and visibility.
 */

import { formatMoney } from "@/lib/utils";
import { renderOrderMergeFields } from "../lib/merge-fields";
import { DEFAULT_ORDER_TEMPLATE_CONFIG } from "../schema";
import type { OrderTemplateConfig } from "../schema";

type OrderItem = {
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
  shippingAddress?: Address;
  billingAddress?: Address;
} | null;

type OrgSnap = {
  name: string;
  logoUrl?: string | null;
  currency: string;
  address?: Address;
};

export type OrderRenderProps = {
  layout?: "clean" | "bold" | "classic" | "receipt";
  config?: Partial<OrderTemplateConfig>;
  org: OrgSnap;
  customer: CustomerSnap;
  order: {
    number: string;
    stage?: string | null;
    issueDate: string | Date;
    subtotal: string | number;
    taxTotal: string | number;
    discountTotal: string | number;
    total: string | number;
    notes?: string | null;
  };
  items: OrderItem[];
};

function formatDate(d: string | Date, fmt: OrderTemplateConfig["dateFormat"]): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (fmt === "iso") return date.toISOString().slice(0, 10);
  if (fmt === "eu") return date.toLocaleDateString("en-GB");
  return date.toLocaleDateString("en-US");
}

function fmtAddress(addr: Address): string[] {
  if (!addr) return [];
  const lines: string[] = [];
  if (addr.line1) lines.push(addr.line1);
  if (addr.line2) lines.push(addr.line2);
  const cityLine = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines;
}

export function OrderRender(props: OrderRenderProps) {
  const config: OrderTemplateConfig = {
    ...DEFAULT_ORDER_TEMPLATE_CONFIG,
    ...(props.config ?? {}),
  };
  const layout = props.layout ?? "clean";
  const { org, customer, order, items } = props;

  const brand = config.brandColor;
  const accent = config.accentColor;

  const issueDateText = formatDate(order.issueDate, config.dateFormat);

  const mergeCtx = {
    org,
    customer: customer ?? {},
    order: {
      ...order,
      date: issueDateText,
      total: formatMoney(order.total, org.currency),
      subtotal: formatMoney(order.subtotal, org.currency),
    },
  };

  const fontClass =
    config.fontFamily === "serif"
      ? "font-serif"
      : config.fontFamily === "mono"
        ? "font-mono"
        : "font-sans";

  const shipLines = fmtAddress(customer?.shippingAddress ?? null);
  const orgAddrLines = fmtAddress(org.address ?? null);

  const Header = () => {
    if (layout === "bold") {
      return (
        <div className="px-10 py-8 text-white" style={{ backgroundColor: brand }}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              {config.showLogo && config.logoUrl ? (
                <img src={config.logoUrl} alt={org.name} className="h-12 w-auto" />
              ) : null}
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Sales order</div>
                <div className="text-2xl font-bold">{org.name}</div>
              </div>
            </div>
            <div className="text-right">
              {config.showOrderNumber && (
                <div className="text-3xl font-bold">#{order.number}</div>
              )}
              <div className="mt-1 text-sm opacity-80">{issueDateText}</div>
            </div>
          </div>
        </div>
      );
    }
    if (layout === "classic") {
      return (
        <div className="border-b-2 px-10 py-8" style={{ borderColor: brand }}>
          <div className="flex items-start justify-between gap-6">
            <div>
              {config.showLogo && config.logoUrl ? (
                <img src={config.logoUrl} alt={org.name} className="mb-2 h-10 w-auto" />
              ) : null}
              <div className="text-xl font-semibold" style={{ color: brand }}>
                {org.name}
              </div>
              {orgAddrLines.map((l, i) => (
                <div key={i} className="text-xs text-slate-600">
                  {l}
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-slate-500">Sales order</div>
              {config.showOrderNumber && <div className="text-2xl font-bold">#{order.number}</div>}
              <div className="mt-1 text-sm text-slate-600">{issueDateText}</div>
            </div>
          </div>
        </div>
      );
    }
    if (layout === "receipt") {
      return (
        <div className="px-6 pt-6 pb-4 text-center">
          {config.showLogo && config.logoUrl ? (
            <img src={config.logoUrl} alt={org.name} className="mx-auto mb-2 h-10 w-auto" />
          ) : null}
          <div className="text-base font-bold uppercase tracking-wider" style={{ color: brand }}>
            {org.name}
          </div>
          <div className="mt-1 text-xs text-slate-600">— Sales Order —</div>
          {config.showOrderNumber && (
            <div className="mt-1 text-sm">
              #{order.number} · {issueDateText}
            </div>
          )}
          <div className="mt-3 border-t border-dashed" style={{ borderColor: brand }} />
        </div>
      );
    }
    // Modern (clean)
    return (
      <div
        className="px-10 py-8"
        style={{
          background: `linear-gradient(135deg, ${brand}10 0%, ${accent}08 100%)`,
        }}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            {config.showLogo && config.logoUrl ? (
              <img src={config.logoUrl} alt={org.name} className="h-12 w-auto" />
            ) : null}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
                Sales order
              </div>
              <div className="mt-0.5 text-2xl font-bold" style={{ color: brand }}>
                {org.name}
              </div>
            </div>
          </div>
          <div className="text-right">
            {config.showOrderNumber && (
              <div className="text-2xl font-bold" style={{ color: brand }}>
                #{order.number}
              </div>
            )}
            <div className="mt-1 text-sm text-slate-600">Issued {issueDateText}</div>
            {order.stage ? (
              <div
                className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: `${accent}1a`, color: accent }}
              >
                {order.stage}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const Meta = () => {
    if (layout === "receipt") {
      return (
        <div className="px-6 py-2 text-xs">
          {customer?.name && <div>Customer: {customer.name}</div>}
          {customer?.storeCode && <div>Store: {customer.storeCode}</div>}
          {config.showCustomerAddress &&
            shipLines.map((l, i) => (
              <div key={i} className="text-slate-600">
                {l}
              </div>
            ))}
        </div>
      );
    }
    return (
      <div className="grid gap-6 px-10 py-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Bill to
          </div>
          <div className="mt-1 text-sm font-semibold">{customer?.name ?? "Walk-in customer"}</div>
          {customer?.storeCode && (
            <div className="text-xs text-slate-600">Store {customer.storeCode}</div>
          )}
          {customer?.email && <div className="text-xs text-slate-600">{customer.email}</div>}
          {config.showCustomerAddress &&
            shipLines.map((l, i) => (
              <div key={i} className="text-xs text-slate-600">
                {l}
              </div>
            ))}
        </div>
        <div className="sm:text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Order details
          </div>
          {config.showOrderNumber && (
            <div className="mt-1 text-sm">Order #{order.number}</div>
          )}
          <div className="text-xs text-slate-600">Date: {issueDateText}</div>
          {order.stage ? (
            <div className="text-xs text-slate-600">Stage: {order.stage}</div>
          ) : null}
        </div>
      </div>
    );
  };

  const Items = () => {
    const isCompact = layout === "receipt";
    return (
      <div className={isCompact ? "px-6" : "px-10"}>
        <table className="w-full text-sm">
          <thead>
            <tr
              className={isCompact ? "border-y border-dashed" : "border-b-2"}
              style={{ borderColor: layout === "classic" ? brand : `${brand}30` }}
            >
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Item
              </th>
              <th className="py-2 px-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                Qty
              </th>
              <th className="py-2 px-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                Price
              </th>
              <th className="py-2 pl-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr
                key={i}
                className={
                  isCompact
                    ? "border-b border-dashed last:border-0"
                    : "border-b last:border-0"
                }
                style={isCompact ? { borderColor: `${brand}40` } : undefined}
              >
                <td className="py-2 pr-3">
                  <div className="font-medium">{it.name}</div>
                  {it.sku && <div className="text-xs text-slate-500">SKU {it.sku}</div>}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatMoney(it.unitPrice, org.currency)}
                </td>
                <td className="py-2 pl-2 text-right font-medium tabular-nums">
                  {formatMoney(it.lineTotal, org.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const Totals = () => {
    const isCompact = layout === "receipt";
    return (
      <div className={isCompact ? "px-6 py-4" : "px-10 py-6"}>
        <div className={isCompact ? "" : "ml-auto w-full max-w-xs"}>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="tabular-nums">{formatMoney(order.subtotal, org.currency)}</span>
          </div>
          {+order.discountTotal > 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-slate-600">Discount</span>
              <span className="tabular-nums">
                − {formatMoney(order.discountTotal, org.currency)}
              </span>
            </div>
          )}
          {config.showTaxBreakdown && +order.taxTotal > 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-slate-600">Tax</span>
              <span className="tabular-nums">{formatMoney(order.taxTotal, org.currency)}</span>
            </div>
          )}
          <div
            className={`mt-2 flex justify-between border-t pt-2 text-base font-bold ${
              isCompact ? "border-dashed" : ""
            }`}
            style={{ borderColor: layout === "classic" ? brand : `${brand}40` }}
          >
            <span>Total</span>
            <span className="tabular-nums" style={{ color: brand }}>
              {formatMoney(order.total, org.currency)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const Footer = () => {
    const headerCopy = renderOrderMergeFields(config.headerText, mergeCtx);
    const footerCopy = renderOrderMergeFields(config.footerText, mergeCtx);
    const termsCopy = renderOrderMergeFields(config.termsText, mergeCtx);
    const isCompact = layout === "receipt";
    return (
      <div className={isCompact ? "px-6 pb-6" : "px-10 pb-10"}>
        {headerCopy && (
          <p className={`text-sm text-slate-700 ${isCompact ? "mt-2 text-center text-xs" : "mt-2"}`}>
            {headerCopy}
          </p>
        )}
        {order.notes && (
          <div className={isCompact ? "mt-3 text-xs" : "mt-4 text-sm"}>
            <div className="font-semibold text-slate-700">Notes</div>
            <p className="mt-0.5 whitespace-pre-line text-slate-600">{order.notes}</p>
          </div>
        )}
        {termsCopy && (
          <div className={isCompact ? "mt-3 text-xs" : "mt-4 text-sm"}>
            <div className="font-semibold text-slate-700">Terms</div>
            <p className="mt-0.5 whitespace-pre-line text-slate-600">{termsCopy}</p>
          </div>
        )}
        {config.showSignatureBlock && !isCompact && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <SignatureLine label="Customer signature" />
            <SignatureLine label={`For ${org.name}`} />
          </div>
        )}
        {footerCopy && (
          <p
            className={
              isCompact
                ? "mt-4 text-center text-xs text-slate-600"
                : "mt-8 border-t pt-4 text-center text-xs text-slate-500"
            }
          >
            {footerCopy}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={`mx-auto max-w-3xl bg-white text-slate-900 ${fontClass} print:max-w-none`}>
      <Header />
      <Meta />
      <Items />
      <Totals />
      <Footer />
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-12 border-b border-slate-400" />
      <div className="mt-1 text-xs text-slate-600">{label}</div>
    </div>
  );
}
