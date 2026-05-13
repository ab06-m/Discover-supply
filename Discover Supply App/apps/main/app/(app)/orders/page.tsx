import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listOrders, listStages } from "@/modules/orders/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { OrdersList, type OrdersListRow } from "@/modules/orders/components/orders-list";
import { can, type Role } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  const { q, stage } = await searchParams;
  const [rows, stages] = await Promise.all([
    listOrders(org.id, { search: q, stageId: stage }),
    listStages(org.id),
  ]);

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

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search order # or store..."
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <div className="w-48">
          <Select name="stage" defaultValue={stage ?? ""}>
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={q || stage ? "No orders match your filters" : "No orders yet"}
          description={
            q || stage
              ? "Clear or adjust the search and stage filters to widen the list."
              : "Create an order to reserve inventory, produce paperwork, and coordinate delivery."
          }
          action={
            !q && !stage ? (
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
          stages={stages}
          canAdvance={can(role as Role, "order.advance_stage")}
        />
      )}
    </div>
  );
}
