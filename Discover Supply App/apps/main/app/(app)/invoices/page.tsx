import Link from "next/link";
import { FileText, Search, X } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listInvoices } from "@/modules/invoices/queries";
import { InvoicesList } from "@/modules/invoices/components/invoices-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ListFiltersDialog } from "@/components/app/list-filters-dialog";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Voided" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; preset?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q, status, from, to, preset } = await searchParams;
  const rows = await listInvoices(org.id, { search: q, status, from, to });
  const clearSearchParams = new URLSearchParams();
  if (status) clearSearchParams.set("status", status);
  if (from) clearSearchParams.set("from", from);
  if (to) clearSearchParams.set("to", to);
  if (preset) clearSearchParams.set("preset", preset);
  const clearSearchHref = clearSearchParams.toString()
    ? `/invoices?${clearSearchParams.toString()}`
    : "/invoices";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${rows.length} invoice${rows.length === 1 ? "" : "s"}`}
      />

      <div className="flex flex-wrap gap-2">
        <form className="flex flex-wrap gap-2" action="/invoices">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {to ? <input type="hidden" name="to" value={to} /> : null}
          {preset ? <input type="hidden" name="preset" value={preset} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search invoice # or store..."
              defaultValue={q ?? ""}
              className="w-72 max-w-xs pl-9 pr-9"
            />
            {q ? (
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
              >
                <Link href={clearSearchHref} aria-label="Clear search">
                  <X className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </form>
        <ListFiltersDialog
          title="Invoice filters"
          basePath="/invoices"
          query={q}
          preset={preset}
          from={from}
          to={to}
          selectName="status"
          selectLabel="Status"
          selectValue={status}
          selectAllLabel="Any status"
          selectOptions={STATUS_OPTIONS}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={q || status || from || to ? "No invoices match your filters" : "No invoices yet"}
          description={
            q || status || from || to
              ? "Clear or adjust the search, status, and period filters to widen the list."
              : "Invoices are created from orders once a store is ready to be billed."
          }
        />
      ) : (
        <InvoicesList rows={rows} currency={org.currency} />
      )}
    </div>
  );
}
