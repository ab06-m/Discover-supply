import Link from "next/link";
import { Plus, Search, ShoppingCart, X } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listOrders, listStages } from "@/modules/orders/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ListFiltersDialog } from "@/components/app/list-filters-dialog";
import { OrdersList, type OrdersListRow } from "@/modules/orders/components/orders-list";
import { can, type Role } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; from?: string; to?: string; preset?: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  const { q, stage, from, to, preset } = await searchParams;
  const [rows, stages] = await Promise.all([
    listOrders(org.id, { search: q, stageId: stage, from, to }),
    listStages(org.id),
  ]);
  const stageOptions = stages.filter((s) => s.effect !== "mark_paid");
  const clearSearchParams = new URLSearchParams();
  if (stage) clearSearchParams.set("stage", stage);
  if (from) clearSearchParams.set("from", from);
  if (to) clearSearchParams.set("to", to);
  if (preset) clearSearchParams.set("preset", preset);
  const clearSearchHref = clearSearchParams.toString()
    ? `/orders?${clearSearchParams.toString()}`
    : "/orders";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle={`${rows.length} order${rows.length === 1 ? "" : "s"}`}
        actions={
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="mr-2 h-4 w-4" /> New order
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <form className="flex flex-wrap gap-2" action="/orders">
          {stage ? <input type="hidden" name="stage" value={stage} /> : null}
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {to ? <input type="hidden" name="to" value={to} /> : null}
          {preset ? <input type="hidden" name="preset" value={preset} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search order # or store..."
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
          title="Order filters"
          basePath="/orders"
          query={q}
          preset={preset}
          from={from}
          to={to}
          selectName="stage"
          selectLabel="Stage"
          selectValue={stage}
          selectAllLabel="All stages"
          selectOptions={stageOptions.map((option) => ({ value: option.id, label: option.name }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={q || stage || from || to ? "No orders match your filters" : "No orders yet"}
          description={
            q || stage || from || to
              ? "Clear or adjust the search, stage, and period filters to widen the list."
              : "Create an order to reserve inventory, produce paperwork, and coordinate delivery."
          }
          action={
            !q && !stage && !from && !to ? (
              <Button asChild>
                <Link href="/orders/new">Create your first order</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <OrdersList
          rows={rows.map(
            (order): OrdersListRow => ({
              ...order,
              createdAt: order.createdAt.toISOString(),
            }),
          )}
          currency={org.currency}
          stages={stageOptions}
          canAdvance={can(role as Role, "order.advance_stage")}
        />
      )}
    </div>
  );
}
