import {
  Package,
  AlertTriangle,
  Truck,
  ShoppingCart,
  Wallet,
  ListChecks,
} from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { formatMoney } from "@/lib/utils";

export default async function DashboardPage() {
  const { org } = await requireActiveOrg();

  const [[productsAgg], [ordersAgg], [dispatchAgg]] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        lowStock: sql<number>`sum(case when (on_hand - committed) <= low_stock_threshold and track_stock then 1 else 0 end)::int`,
        committed: sql<number>`coalesce(sum(committed), 0)::int`,
      })
      .from(schema.products)
      .where(eq(schema.products.orgId, org.id)),
    db
      .select({
        open: sql<number>`count(*) filter (
          where ${schema.orders.stageId} in (
            select id from order_stages
            where org_id = ${org.id} and is_terminal = false
          )
        )::int`,
        revenue: sql<string>`coalesce(sum(case
          when ${schema.orders.stageId} in (
            select id from order_stages
            where org_id = ${org.id} and effect in ('consume','mark_paid')
          )
          then ${schema.orders.total} else 0 end), 0)`,
      })
      .from(schema.orders)
      .where(eq(schema.orders.orgId, org.id)),
    db
      .select({
        active: sql<number>`sum(case when status in ('pending','assigned','loaded','in_transit') then 1 else 0 end)::int`,
      })
      .from(schema.dispatches)
      .where(eq(schema.dispatches.orgId, org.id)),
  ]);

  const stats = [
    { label: "Products", value: productsAgg?.count ?? 0, icon: Package },
    {
      label: "Low-stock alerts",
      value: productsAgg?.lowStock ?? 0,
      icon: AlertTriangle,
    },
    { label: "Units committed", value: productsAgg?.committed ?? 0, icon: ListChecks },
    { label: "Open orders", value: ordersAgg?.open ?? 0, icon: ShoppingCart },
    {
      label: "Revenue (shipped)",
      value: formatMoney(ordersAgg?.revenue ?? "0", org.currency),
      icon: Wallet,
    },
    { label: "Active deliveries", value: dispatchAgg?.active ?? 0, icon: Truck },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Welcome to ${org.name}.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
        ))}
      </div>
    </div>
  );
}
