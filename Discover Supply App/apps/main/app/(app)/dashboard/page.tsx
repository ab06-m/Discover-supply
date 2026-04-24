import { requireActiveOrg } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export default async function DashboardPage() {
  const { org } = await requireActiveOrg();

  const [productsAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      lowStock: sql<number>`sum(case when (on_hand - committed) <= low_stock_threshold and track_stock then 1 else 0 end)::int`,
      committed: sql<number>`coalesce(sum(committed), 0)::int`,
    })
    .from(schema.products)
    .where(eq(schema.products.orgId, org.id));

  // Open orders = any order not on a terminal stage.
  const [ordersAgg] = await db
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
    .where(eq(schema.orders.orgId, org.id));

  const [dispatchAgg] = await db
    .select({
      active: sql<number>`sum(case when status in ('pending','assigned','loaded','in_transit') then 1 else 0 end)::int`,
    })
    .from(schema.dispatches)
    .where(eq(schema.dispatches.orgId, org.id));

  const stats = [
    { label: "Products", value: productsAgg?.count ?? 0 },
    { label: "Low-stock alerts", value: productsAgg?.lowStock ?? 0 },
    { label: "Units committed", value: productsAgg?.committed ?? 0 },
    { label: "Open orders", value: ordersAgg?.open ?? 0 },
    { label: "Revenue (shipped)", value: formatMoney(ordersAgg?.revenue ?? "0", org.currency) },
    { label: "Active deliveries", value: dispatchAgg?.active ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to {org.name}.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
