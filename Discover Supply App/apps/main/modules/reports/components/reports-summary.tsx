import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, FileText, Package, ReceiptText, Wallet } from "lucide-react";

type SummaryFormat = "money" | "number";

type SummaryTile = {
  key: string;
  label: string;
  format: SummaryFormat;
  icon: LucideIcon;
  accent: string;
};

const summaryConfig: Record<string, Record<string, SummaryTile>> = {
  "total-sales": {
    orderCount: {
      key: "orderCount",
      label: "Orders",
      format: "number",
      icon: FileText,
      accent: "bg-sky-100 text-sky-800",
    },
    totalItems: {
      key: "totalItems",
      label: "Total items",
      format: "number",
      icon: Package,
      accent: "bg-violet-100 text-violet-800",
    },
    totalSales: {
      key: "totalSales",
      label: "Total sales",
      format: "money",
      icon: CircleDollarSign,
      accent: "bg-emerald-100 text-emerald-800",
    },
    totalPaid: {
      key: "totalPaid",
      label: "Total paid",
      format: "money",
      icon: Wallet,
      accent: "bg-indigo-100 text-indigo-800",
    },
    totalOutstanding: {
      key: "totalOutstanding",
      label: "Outstanding",
      format: "money",
      icon: ReceiptText,
      accent: "bg-amber-100 text-amber-800",
    },
  },
};

function formatNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number)
    : "0";
}

function formatMoney(value: unknown, currency: string) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(number)
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
}

function formatValue(value: unknown, format: SummaryFormat, currency: string) {
  return format === "money" ? formatMoney(value, currency) : formatNumber(value);
}

type Props = {
  reportId: string;
  summary: Record<string, unknown>;
  currency: string;
};

export function ReportsSummary({ reportId, summary, currency }: Props) {
  const config = summaryConfig[reportId];
  if (!config) return null;

  const tiles = Object.values(config).filter((tile) => summary[tile.key] !== undefined);
  if (!tiles.length) return null;

  return (
    <section
      aria-label="Report totals"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.key}
            className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-card"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${tile.accent}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tile.label}
              </p>
              <p className="truncate text-lg font-semibold text-foreground">
                {formatValue(summary[tile.key], tile.format, currency)}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
