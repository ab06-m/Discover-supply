import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import {
  BarChart3,
  Download,
  Package,
  Pin,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getReportDefinition, reportDefinitions, type ReportDefinition } from "@/modules/reports/catalog";
import { ReportRunnerDialog } from "@/modules/reports/components/report-runner-dialog";
import { ReportsBrowser } from "@/modules/reports/components/reports-browser";
import { ReportsFilterForm } from "@/modules/reports/components/reports-filter-form";
import { getReportResult, type ReportFilters } from "@/modules/reports/engine";
import { formatDateInput, isReportDatePreset, resolveReportDateRange } from "@/modules/reports/date-ranges";
import { ReportsTable } from "@/modules/reports/components/reports-table";

export const dynamic = "force-dynamic";

type SearchParams = {
  report?: string;
  q?: string;
  group?: string;
  preset?: string;
  start?: string;
  end?: string;
  sku?: string;
  categoryId?: string;
  customerId?: string;
  inactivityDays?: string;
  sort?: string;
  direction?: "asc" | "desc";
  pageSize?: string;
};

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

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = value instanceof Date ? value.toISOString() : value;
    }
    return out;
  });
}

function getGroupHref(group: string, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.set("group", group);
  next.delete("report");
  return `/reports?${next.toString()}`;
}

function getCsvHref(report: string, filters: ReportFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") params.set(key, String(value));
  }
  params.set("format", "csv");
  return `/api/reports/${report}?${params.toString()}`;
}

function getReportCloseHref(query: string, activeGroup: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (activeGroup !== "All") params.set("group", activeGroup);
  const search = params.toString();
  return search ? `/reports?${search}` : "/reports";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { org } = await requireActiveOrg();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const activeGroup = params.group && params.group !== "All" ? params.group : "All";
  const selectedReport = params.report ? getReportDefinition(params.report) : undefined;
  const currentParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) currentParams.set(key, String(value));
  }

  const groups = ["All", "Pinned", ...Object.keys(groupConfig)] as const;

  const preset = isReportDatePreset(params.preset) ? params.preset : "ytd";
  const dateRange = resolveReportDateRange({
    preset,
    start: params.start,
    end: params.end,
  });
  const start = formatDateInput(dateRange.start);
  const end = formatDateInput(dateRange.end);
  currentParams.set("preset", preset);
  currentParams.set("start", start);
  currentParams.set("end", end);
  const pageSize = Number(params.pageSize ?? "50");
  const inactivityDays = Number(params.inactivityDays ?? "60");
  const direction = params.direction === "asc" ? "asc" : "desc";

  const [categories, customers] = selectedReport
    ? await Promise.all([
        db
          .select({ id: schema.categories.id, name: schema.categories.name })
          .from(schema.categories)
          .where(eq(schema.categories.orgId, org.id))
          .orderBy(asc(schema.categories.name)),
        db
          .select({ id: schema.customers.id, name: schema.customers.name, storeCode: schema.customers.storeCode })
          .from(schema.customers)
          .where(eq(schema.customers.orgId, org.id))
          .orderBy(asc(schema.customers.name)),
      ])
    : [[], []];

  const filters: ReportFilters | undefined = selectedReport
    ? {
        start,
        end,
        sku: params.sku || undefined,
        categoryId: params.categoryId || undefined,
        customerId: params.customerId || undefined,
        pageSize,
        inactivityDays,
        sort: params.sort ?? selectedReport.defaultSort,
        direction,
      }
    : undefined;
  const result = selectedReport && filters ? await getReportResult(org.id, selectedReport.id, filters) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Inventory, sales, customer, and cash-flow views for distribution teams." />

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <form className="relative" action="/reports">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={query} placeholder="Search reports..." className="pl-9" />
            {activeGroup !== "All" && <input type="hidden" name="group" value={activeGroup} />}
          </form>

          <nav className="hidden rounded-lg border bg-card p-2 shadow-card lg:block">
            {groups.map((group) => {
              const active = group === activeGroup;
              const Icon =
                group === "All" ? BarChart3 : group === "Pinned" ? Pin : groupConfig[group as ReportDefinition["group"]].icon;
              const href = group === "All" ? "/reports" : getGroupHref(group, currentParams);
              return (
                <Link
                  key={group}
                  href={href}
                  className={[
                    "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition hover:bg-muted",
                    active ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {group}
                </Link>
              );
            })}
          </nav>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {groups.map((group) => {
              const active = group === activeGroup;
              const href = group === "All" ? "/reports" : getGroupHref(group, currentParams);
              return (
                <Link
                  key={group}
                  href={href}
                  className={[
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium",
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
                  ].join(" ")}
                >
                  {group}
                </Link>
              );
            })}
          </div>
        </aside>

        <ReportsBrowser
          reports={reportDefinitions}
          activeGroup={activeGroup}
          query={query}
          selectedReportId={selectedReport?.id}
          currentParams={currentParams.toString()}
        />
      </div>

      {selectedReport && filters && result && (
        <ReportRunnerDialog title={selectedReport.name} closeHref={getReportCloseHref(query, activeGroup)}>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{selectedReport.group} Report</p>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{selectedReport.description}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={getCsvHref(selectedReport.id, filters)}>
                  <Download className="h-4 w-4" />
                  CSV
                </a>
              </Button>
            </div>

            <ReportsFilterForm
              key={`${selectedReport.id}:${pageSize}:${inactivityDays}:${filters.sort ?? selectedReport.defaultSort}:${direction}:${params.sku ?? ""}:${params.categoryId ?? ""}:${params.customerId ?? ""}`}
              report={selectedReport}
              query={query}
              activeGroup={activeGroup}
              preset={preset}
              start={start}
              end={end}
              pageSize={pageSize}
              inactivityDays={inactivityDays}
              sort={filters.sort ?? selectedReport.defaultSort}
              direction={direction}
              sku={params.sku}
              categoryId={params.categoryId}
              customerId={params.customerId}
              categories={categories}
              customers={customers}
            />

            <ReportsTable
              reportId={selectedReport.id}
              columns={selectedReport.columns}
              rows={normalizeRows(result.data)}
              currency={org.currency}
              csvHref={getCsvHref(selectedReport.id, filters)}
            />
          </div>
        </ReportRunnerDialog>
      )}
    </div>
  );
}
