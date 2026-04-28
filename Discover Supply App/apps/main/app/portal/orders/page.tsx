import Link from "next/link";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalOrders() {
  const { active } = await requireCustomer();
  const orders = await db
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
    .where(
      and(
        eq(schema.orders.orgId, active.org.id),
        eq(schema.orders.customerId, active.contact.customerId),
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            )}
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link
                    href={`/portal/orders/${o.id}`}
                    className="font-medium hover:underline"
                  >
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {o.stageName && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs text-white"
                      style={{ backgroundColor: o.stageColor ?? "#64748b" }}
                    >
                      {o.stageName}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(o.total, active.org.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
