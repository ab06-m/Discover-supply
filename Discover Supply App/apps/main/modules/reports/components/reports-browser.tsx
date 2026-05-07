"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  Clock,
  Package,
  Pin,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportDefinition } from "../catalog";

const STORAGE_KEY = "discover-supply.reports.pinned.v1";
const defaultPinnedReportIds = ["low-stock", "top-selling-products", "customer-reorder-prediction"];

const groupConfig = {
  Inventory: {
    icon: Package,
    accent: "bg-emerald-100 text-emerald-800",
  },
  Sales: {
    icon: ShoppingCart,
    accent: "bg-sky-100 text-sky-800",
  },
  Customers: {
    icon: Users,
    accent: "bg-amber-100 text-amber-800",
  },
} satisfies Record<ReportDefinition["group"], { icon: typeof Package; accent: string }>;

const reportIcons: Record<string, typeof Package> = {
  "inventory-turnover": TrendingUp,
  "inventory-aging": Clock,
  "stock-movement": Activity,
  "low-stock": AlertTriangle,
  "top-selling-products": BarChart3,
  "slow-dead-inventory": Boxes,
  "gross-margin-by-product": TrendingUp,
  "customer-purchase-behavior": Users,
  "sales-by-category": ShoppingCart,
  "inventory-valuation": Package,
  "customer-reorder-prediction": CalendarDays,
};

type Props = {
  reports: readonly ReportDefinition[];
  activeGroup: string;
  query: string;
  selectedReportId?: string;
  currentParams: string;
};

function getReportHref(reportId: string, params: URLSearchParams) {
  const next = new URLSearchParams();
  for (const key of ["q", "group", "preset", "start", "end", "pageSize"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  next.set("report", reportId);
  return `/reports?${next.toString()}`;
}

function matchesReport(report: ReportDefinition, query: string) {
  if (!query) return true;
  const haystack = `${report.name} ${report.group} ${report.description}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function readPinnedReports(validReportIds: Set<string>) {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultPinnedReportIds.filter((id) => validReportIds.has(id));

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && validReportIds.has(id)) : [];
  } catch {
    return defaultPinnedReportIds.filter((id) => validReportIds.has(id));
  }
}

function ReportCard({
  report,
  active,
  href,
  pinned,
  onTogglePin,
}: {
  report: ReportDefinition;
  active: boolean;
  href: string;
  pinned: boolean;
  onTogglePin: (reportId: string) => void;
}) {
  const Icon = reportIcons[report.id] ?? groupConfig[report.group].icon;

  return (
    <article
      className={cn(
        "relative flex min-h-[132px] rounded-lg border bg-card shadow-card transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md",
        active ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <Link
        href={href}
        className="group flex min-w-0 flex-1 flex-col justify-between rounded-lg p-4 pr-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${groupConfig[report.group].accent}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-6 text-foreground">{report.name}</span>
            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-muted-foreground">{report.description}</span>
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{report.group}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            Open
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      <button
        type="button"
        title={pinned ? "Unpin report" : "Pin report"}
        aria-label={pinned ? `Unpin ${report.name}` : `Pin ${report.name}`}
        aria-pressed={pinned}
        onClick={() => onTogglePin(report.id)}
        className={cn(
          "absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          pinned ? "border-primary/30 text-primary" : "border-border text-muted-foreground",
        )}
      >
        <Pin className="h-4 w-4" />
      </button>
    </article>
  );
}

export function ReportsBrowser({ reports, activeGroup, query, selectedReportId, currentParams }: Props) {
  const validReportIds = useMemo(() => new Set(reports.map((report) => report.id)), [reports]);
  const [loaded, setLoaded] = useState(false);
  const [pinnedReportIds, setPinnedReportIds] = useState<string[]>(() =>
    defaultPinnedReportIds.filter((id) => validReportIds.has(id)),
  );

  useEffect(() => {
    setPinnedReportIds(readPinnedReports(validReportIds));
    setLoaded(true);
  }, [validReportIds]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedReportIds));
  }, [loaded, pinnedReportIds]);

  const currentSearchParams = useMemo(() => new URLSearchParams(currentParams), [currentParams]);
  const pinnedSet = useMemo(() => new Set(pinnedReportIds), [pinnedReportIds]);
  const searchedReports = useMemo(() => reports.filter((report) => matchesReport(report, query)), [query, reports]);
  const pinnedReports = searchedReports.filter((report) => pinnedSet.has(report.id));
  const visibleReports =
    activeGroup === "Pinned"
      ? pinnedReports
      : searchedReports.filter((report) => activeGroup === "All" || report.group === activeGroup);
  const groupedReports = Object.keys(groupConfig).map((group) => ({
    group: group as ReportDefinition["group"],
    reports: visibleReports.filter((report) => report.group === group),
  }));

  function togglePin(reportId: string) {
    setPinnedReportIds((current) =>
      current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId],
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      {activeGroup === "All" && pinnedReports.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Pin className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">Pinned Reports</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pinnedReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                pinned
                active={selectedReportId === report.id}
                href={getReportHref(report.id, currentSearchParams)}
                onTogglePin={togglePin}
              />
            ))}
          </div>
        </section>
      )}

      {groupedReports.map(({ group, reports: groupReports }) => {
        if (!groupReports.length) return null;
        const Icon = groupConfig[group].icon;
        return (
          <section key={group} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-md ${groupConfig[group].accent}`}>
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight">{group} Reports</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  active={selectedReportId === report.id}
                  href={getReportHref(report.id, currentSearchParams)}
                  pinned={pinnedSet.has(report.id)}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          </section>
        );
      })}

      {!visibleReports.length && (
        <div className="rounded-lg border bg-card p-8 text-center shadow-card">
          <p className="font-medium">No reports found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
        </div>
      )}
    </div>
  );
}
