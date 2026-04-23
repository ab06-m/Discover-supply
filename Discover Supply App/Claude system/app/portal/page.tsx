import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { db, schema } from "@/lib/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const { active } = await requireCustomer();
  const customerId = active.contact.customerId;
  const orgId = active.org.id;

  const recentOrders = await db
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      total: schema.orders.total,
      createdAt: schema.orders.createdAt,
      stageName: schema.orderStages.name,
      stageColor: schema.orderStages.color,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(and(eq(schema.orders.orgId, orgId), eq(schema.orders.customerId, customerId)))
    .orderBy(desc(schema.orders.createdAt))
    .limit(5);

  const [openBalance] = await db
    .select({
      total: sql<string>`coalesce(sum(${schema.invoices.total}) - sum(${schema.invoices.amountPaid}), 0)::text`,
    })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.orgId, orgId),
        eq(schema.invoices.customerId, customerId),
        sql`${schema.invoices.status} not in ('paid', 'void', 'draft')`,
      ),
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hi {active.contact.fullName ?? active.contact.email}
        </h1>
        <p className="text-sm text-muted-foreground">{active.customer.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatMoney(openBalance.total, active.org.currency)}
            </div>
            <Link
              href="/portal/invoices?status=unpaid"
              className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
            >
              View invoices <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Place an order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Browse the catalog and add items to your cart.
            </p>
            <Link
              href="/shop"
              className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
            >
              Go to shop <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent orders</CardTitle>
          <Link href="/portal/orders" className="text-sm text-primary hover:underline">
            See all
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link
                      href={`/portal/orders/${o.id}`}
                      className="font-medium hover:underline"
                    >
                      {o.number}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {o.stageName && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: o.stageColor ?? "#64748b" }}
                      >
                        {o.stageName}
                      </span>
                    )}
                    <span className="font-medium">
                      {formatMoney(o.total, active.org.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
