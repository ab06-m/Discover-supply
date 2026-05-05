/**
 * Pure invoice renderer used by staff pages, customer portal, public links,
 * and print/PDF capture. Layout controls structure; config controls branding,
 * copy, visibility, and merge-field text.
 */

import { formatMoney } from "@/lib/utils";
import { renderMergeFields } from "../lib/merge-fields";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "../schema";
import type { InvoiceTemplateConfig } from "../schema";
import type React from "react";

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
  previewMode?: boolean;
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
  const config: InvoiceTemplateConfig = {
    ...DEFAULT_INVOICE_TEMPLATE_CONFIG,
    ...(props.config ?? {}),
  };
  const layout = props.layout ?? "clean";
  const { org, customer, invoice, items } = props;

  const balance = +(+invoice.total - +invoice.amountPaid).toFixed(2);
  const isBold = layout === "bold";
  const isClassic = layout === "classic";
  const isReceipt = layout === "receipt";
  const isModern = layout === "clean" || layout === "minimal";
  const brand = config.brandColor;
  const accent = config.accentColor;
  const accentSoft = `${accent}14`;
  const brandSoft = `${brand}10`;

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

  if (isReceipt) {
    return (
      <InvoiceShell fontClass={fontClass} compact>
        <ReceiptHeader
          org={org}
          invoice={invoice}
          config={config}
          brand={brand}
          previewMode={props.previewMode}
        />
        <div className="px-6 py-5">
          <ReceiptMeta customer={customer} invoice={invoice} config={config} accent={accent} />
          <ItemsTable items={items} org={org} layout={layout} brand={brand} />
          <TotalsBlock
            invoice={invoice}
            balance={balance}
            org={org}
            config={config}
            brand={brand}
            accent={accent}
            layout={layout}
          />
          <InvoiceCopy
            invoice={invoice}
            config={config}
            mergeCtx={mergeCtx}
            accent={accent}
            layout={layout}
          />
        </div>
        <FooterText config={config} mergeCtx={mergeCtx} layout={layout} brand={brand} />
      </InvoiceShell>
    );
  }

  return (
    <InvoiceShell fontClass={fontClass}>
      {isBold ? (
        <BoldHeader
          org={org}
          invoice={invoice}
          config={config}
          brand={brand}
          accent={accent}
          previewMode={props.previewMode}
        />
      ) : (
        <StandardHeader
          org={org}
          invoice={invoice}
          config={config}
          brand={brand}
          accent={accent}
          isClassic={isClassic}
          isModern={isModern}
          previewMode={props.previewMode}
        />
      )}

      {config.headerText && (
        <div className="px-8 pt-5 text-sm text-slate-700">
          {renderMergeFields(config.headerText, mergeCtx)}
        </div>
      )}

      <div className="px-8 py-7">
        <InvoiceMetaGrid
          customer={customer}
          invoice={invoice}
          config={config}
          accent={accent}
          accentSoft={accentSoft}
          brandSoft={brandSoft}
          isClassic={isClassic}
        />

        <ItemsTable items={items} org={org} layout={layout} brand={brand} />

        <div className="mt-6 flex justify-end">
          <TotalsBlock
            invoice={invoice}
            balance={balance}
            org={org}
            config={config}
            brand={brand}
            accent={accent}
            layout={layout}
          />
        </div>

        <InvoiceCopy
          invoice={invoice}
          config={config}
          mergeCtx={mergeCtx}
          accent={accent}
          layout={layout}
        />
      </div>

      <FooterText config={config} mergeCtx={mergeCtx} layout={layout} brand={brand} />
    </InvoiceShell>
  );
}

function InvoiceShell({
  children,
  fontClass,
  compact = false,
}: {
  children: React.ReactNode;
  fontClass: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`invoice-render ${fontClass} ${
        compact ? "mx-auto max-w-md" : "w-full"
      } bg-white text-slate-900 print:mx-0 print:max-w-none print:shadow-none`}
    >
      <style>{`
        @media print {
          .invoice-render { padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}

function StandardHeader({
  org,
  invoice,
  config,
  brand,
  accent,
  isClassic,
  isModern,
  previewMode,
}: {
  org: OrgSnap;
  invoice: InvoiceRenderProps["invoice"];
  config: InvoiceTemplateConfig;
  brand: string;
  accent: string;
  isClassic: boolean;
  isModern: boolean;
  previewMode?: boolean;
}) {
  return (
    <div
      className={`px-8 pt-8 ${isClassic ? "pb-6" : "pb-7"}`}
      style={{
        background: isModern
          ? `linear-gradient(135deg, ${brand}0f, #ffffff 46%, ${accent}10)`
          : "#ffffff",
        borderBottom: isClassic ? `2px solid ${brand}` : "1px solid rgb(226 232 240)",
      }}
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <LogoDisplay
            logoUrl={config.logoUrl}
            showLogo={config.showLogo}
            previewMode={previewMode}
            className="mb-3"
          />
          <div
            className={`${isClassic ? "text-2xl font-semibold" : "text-xl font-bold"}`}
            style={{ color: brand }}
          >
            {org.name}
          </div>
          <AddressBlock addr={org.address} className="mt-2 text-xs leading-5 text-slate-600" />
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase text-slate-500">Invoice</div>
          <div className="mt-1 text-3xl font-bold tracking-tight">{invoice.number}</div>
          <div className="mt-2 flex justify-end">
            <StatusBadge status={invoice.status} accent={accent} />
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Issued {formatDate(invoice.issueDate, config.dateFormat)}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoldHeader({
  org,
  invoice,
  config,
  brand,
  accent,
  previewMode,
}: {
  org: OrgSnap;
  invoice: InvoiceRenderProps["invoice"];
  config: InvoiceTemplateConfig;
  brand: string;
  accent: string;
  previewMode?: boolean;
}) {
  return (
    <div className="px-8 py-10 text-white" style={{ backgroundColor: brand }}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <LogoDisplay
            logoUrl={config.logoUrl}
            showLogo={config.showLogo}
            previewMode={previewMode}
            className="mb-3"
            inverse
          />
          <div className="text-2xl font-bold">{org.name}</div>
          <AddressBlock addr={org.address} className="mt-2 text-sm leading-5 text-white/75" />
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase text-white/70">Invoice</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">{invoice.number}</div>
          <div
            className="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase text-slate-950"
            style={{ backgroundColor: accent }}
          >
            {invoice.status}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptHeader({
  org,
  invoice,
  config,
  brand,
  previewMode,
}: {
  org: OrgSnap;
  invoice: InvoiceRenderProps["invoice"];
  config: InvoiceTemplateConfig;
  brand: string;
  previewMode?: boolean;
}) {
  return (
    <div className="border-b-2 border-dashed border-slate-300 px-6 py-6 text-center">
      <LogoDisplay
        logoUrl={config.logoUrl}
        showLogo={config.showLogo}
        previewMode={previewMode}
        className="mx-auto mb-3"
        compact
      />
      <div className="text-lg font-bold" style={{ color: brand }}>
        {org.name}
      </div>
      <AddressBlock addr={org.address} className="mt-1 text-xs leading-5 text-slate-600" />
      <div className="mt-4 text-xs font-semibold uppercase text-slate-500">
        Receipt / {invoice.number}
      </div>
    </div>
  );
}

function LogoDisplay({
  logoUrl,
  showLogo,
  previewMode,
  className,
  inverse = false,
  compact = false,
}: {
  logoUrl?: string;
  showLogo: boolean;
  previewMode?: boolean;
  className?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  if (!showLogo) return null;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${compact ? "h-10" : "h-12"} object-contain ${className ?? ""}`}
      />
    );
  }
  if (!previewMode) return null;

  return (
    <div
      className={`inline-flex ${compact ? "h-10 w-24" : "h-12 w-32"} items-center justify-center rounded-md border border-dashed text-[10px] font-semibold uppercase ${
        inverse ? "border-white/45 text-white/70" : "border-slate-300 bg-white/70 text-slate-400"
      } ${className ?? ""}`}
    >
      Logo
    </div>
  );
}

function InvoiceMetaGrid({
  customer,
  invoice,
  config,
  accent,
  accentSoft,
  brandSoft,
  isClassic,
}: {
  customer: CustomerSnap;
  invoice: InvoiceRenderProps["invoice"];
  config: InvoiceTemplateConfig;
  accent: string;
  accentSoft: string;
  brandSoft: string;
  isClassic: boolean;
}) {
  return (
    <div className="mb-7 grid gap-4 sm:grid-cols-2">
      <div
        className={`p-4 ${isClassic ? "border-y" : "rounded-md border"}`}
        style={{ backgroundColor: isClassic ? "#ffffff" : brandSoft }}
      >
        <SectionLabel>Bill to</SectionLabel>
        <div className="mt-2 text-sm">
          <div className="text-base font-semibold">{customer?.name ?? "Walk-in customer"}</div>
          {customer?.storeCode && <div className="text-slate-600">Code {customer.storeCode}</div>}
          <AddressBlock addr={customer?.billingAddress} className="mt-2 leading-5 text-slate-700" />
          {customer?.email && <div className="mt-2 text-slate-600">{customer.email}</div>}
        </div>
      </div>

      <div
        className={`p-4 text-left sm:text-right ${isClassic ? "border-y" : "rounded-md border"}`}
        style={{ backgroundColor: isClassic ? "#ffffff" : accentSoft }}
      >
        <SectionLabel>Invoice details</SectionLabel>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          <div>
            <span className="text-slate-500">Issued</span>{" "}
            <span className="font-medium text-slate-900">
              {formatDate(invoice.issueDate, config.dateFormat)}
            </span>
          </div>
          {config.showDueDate && invoice.dueDate && (
            <div>
              <span className="text-slate-500">Due</span>{" "}
              <span className="font-semibold" style={{ color: accent }}>
                {formatDate(invoice.dueDate, config.dateFormat)}
              </span>
            </div>
          )}
          {config.showOrderNumber && invoice.orderNumber && (
            <div>
              <span className="text-slate-500">Order</span>{" "}
              <span className="font-medium text-slate-900">{invoice.orderNumber}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptMeta({
  customer,
  invoice,
  config,
  accent,
}: {
  customer: CustomerSnap;
  invoice: InvoiceRenderProps["invoice"];
  config: InvoiceTemplateConfig;
  accent: string;
}) {
  return (
    <div className="mb-5 space-y-2 border-b border-dashed border-slate-300 pb-4 text-xs">
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">Customer</span>
        <span className="text-right font-semibold">{customer?.name ?? "Walk-in customer"}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">Issued</span>
        <span>{formatDate(invoice.issueDate, config.dateFormat)}</span>
      </div>
      {config.showDueDate && invoice.dueDate && (
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Due</span>
          <span className="font-semibold" style={{ color: accent }}>
            {formatDate(invoice.dueDate, config.dateFormat)}
          </span>
        </div>
      )}
    </div>
  );
}

function ItemsTable({
  items,
  org,
  layout,
  brand,
}: {
  items: InvoiceItem[];
  org: OrgSnap;
  layout: InvoiceRenderProps["layout"];
  brand: string;
}) {
  const isReceipt = layout === "receipt";
  const isClassic = layout === "classic";

  return (
    <table className={`w-full table-fixed ${isReceipt ? "text-xs" : "text-sm"}`}>
      <thead>
        <tr
          className={
            isReceipt
              ? "border-b border-dashed border-slate-400"
              : isClassic
                ? "border-y border-slate-300"
                : "border-b-2"
          }
          style={!isReceipt && !isClassic ? { borderColor: brand } : undefined}
        >
          <th className="py-3 text-left font-semibold">Item</th>
          <th className="w-14 py-3 text-right font-semibold">Qty</th>
          <th className="w-24 py-3 text-right font-semibold">Price</th>
          <th className="w-28 py-3 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr
            key={index}
            className={isReceipt ? "border-b border-dashed border-slate-200" : "border-b border-slate-200"}
          >
            <td className="py-3 pr-2 align-top">
              <div className="font-medium text-slate-900">{item.name}</div>
              {item.sku && <div className="mt-0.5 text-xs text-slate-500">{item.sku}</div>}
            </td>
            <td className="py-3 text-right align-top">{item.quantity}</td>
            <td className="py-3 text-right align-top text-slate-600">
              {formatMoney(item.unitPrice, org.currency)}
            </td>
            <td className="py-3 text-right align-top font-semibold">
              {formatMoney(item.lineTotal, org.currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsBlock({
  invoice,
  balance,
  org,
  config,
  brand,
  accent,
  layout,
}: {
  invoice: InvoiceRenderProps["invoice"];
  balance: number;
  org: OrgSnap;
  config: InvoiceTemplateConfig;
  brand: string;
  accent: string;
  layout: InvoiceRenderProps["layout"];
}) {
  const isReceipt = layout === "receipt";
  const isClassic = layout === "classic";

  return (
    <div
      className={`w-full space-y-2 text-sm ${
        isReceipt ? "" : isClassic ? "max-w-sm border-t pt-4" : "max-w-sm rounded-md border p-4"
      }`}
      style={!isReceipt && !isClassic ? { backgroundColor: `${brand}08` } : undefined}
    >
      <TotalsRow label="Subtotal" value={formatMoney(invoice.subtotal, org.currency)} />
      {+invoice.discountTotal > 0 && (
        <TotalsRow label="Discount" value={`- ${formatMoney(invoice.discountTotal, org.currency)}`} />
      )}
      {config.showTaxBreakdown && +invoice.taxTotal > 0 && (
        <TotalsRow label="Tax" value={formatMoney(invoice.taxTotal, org.currency)} />
      )}
      <div className="border-t pt-3" style={{ borderColor: isReceipt ? undefined : brand }}>
        <TotalsRow label="Total" value={formatMoney(invoice.total, org.currency)} emphasize />
      </div>
      {+invoice.amountPaid > 0 && (
        <TotalsRow label="Paid" value={`- ${formatMoney(invoice.amountPaid, org.currency)}`} />
      )}
      <div
        className={`mt-3 flex items-center justify-between rounded-md px-3 py-2 ${
          isReceipt ? "border border-dashed" : ""
        }`}
        style={{ backgroundColor: `${accent}12`, color: brand }}
      >
        <span className="text-xs font-semibold uppercase">Balance due</span>
        <span className="text-lg font-bold">{formatMoney(balance, org.currency)}</span>
      </div>
    </div>
  );
}

function InvoiceCopy({
  invoice,
  config,
  mergeCtx,
  accent,
  layout,
}: {
  invoice: InvoiceRenderProps["invoice"];
  config: InvoiceTemplateConfig;
  mergeCtx: Record<string, unknown>;
  accent: string;
  layout: InvoiceRenderProps["layout"];
}) {
  const isReceipt = layout === "receipt";

  return (
    <div className={isReceipt ? "mt-5 space-y-4" : "mt-7 grid gap-4 md:grid-cols-2"}>
      {invoice.notes && (
        <CopyBlock title="Notes" compact={isReceipt}>
          {invoice.notes}
        </CopyBlock>
      )}

      {config.showPaymentInstructions && config.paymentInstructions && (
        <CopyBlock title="Payment instructions" accent={accent} compact={isReceipt}>
          {renderMergeFields(config.paymentInstructions, mergeCtx)}
        </CopyBlock>
      )}

      {(invoice.terms || config.termsText) && (
        <CopyBlock title="Terms" compact={isReceipt}>
          {invoice.terms ?? renderMergeFields(config.termsText, mergeCtx)}
        </CopyBlock>
      )}
    </div>
  );
}

function CopyBlock({
  title,
  children,
  accent,
  compact = false,
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${compact ? "text-xs" : "text-sm"}`}
      style={accent ? { borderColor: accent } : undefined}
    >
      <div
        className="mb-1 text-xs font-semibold uppercase text-slate-500"
        style={accent ? { color: accent } : undefined}
      >
        {title}
      </div>
      <div className="whitespace-pre-wrap leading-5 text-slate-700">{children}</div>
    </div>
  );
}

function FooterText({
  config,
  mergeCtx,
  layout,
  brand,
}: {
  config: InvoiceTemplateConfig;
  mergeCtx: Record<string, unknown>;
  layout: InvoiceRenderProps["layout"];
  brand: string;
}) {
  if (!config.footerText) return null;

  return (
    <div
      className={`px-8 py-4 text-center text-xs ${
        layout === "bold" ? "text-white" : "border-t text-slate-600"
      }`}
      style={layout === "bold" ? { backgroundColor: brand } : undefined}
    >
      {renderMergeFields(config.footerText, mergeCtx)}
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
    <div className={`flex justify-between gap-4 ${emphasize ? "text-base font-bold" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase text-slate-500">{children}</div>;
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

function StatusBadge({ status, accent }: { status: string; accent: string }) {
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
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
        colors[status] ?? "bg-slate-100 text-slate-700"
      }`}
      style={status === "draft" ? { border: `1px solid ${accent}` } : undefined}
    >
      {status}
    </span>
  );
}
