import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { db, schema } from "@/lib/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function PortalOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await requireCustomer();
  const { id } = await params;

  const rows = await db
    .select({
      order: schema.orders,
      stage: schema.orderStages,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(
      and(
        eq(schema.orders.orgId, active.org.id),
        eq(schema.orders.id, id),
        eq(schema.orders.customerId, active.contact.customerId),
      ),
    )
    .limit(1);
  if (!rows.length) notFound();
  const { order, stage } = rows[0];

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, id))
    .orderBy(asc(schema.orderItems.id));

  const history = await db
    .select({
      id: schema.orderStageHistory.id,
      createdAt: schema.orderStageHistory.createdAt,
      note: schema.orderStageHistory.note,
      toStageId: schema.orderStageHistory.toStageId,
    })
    .from(schema.orderStageHistory)
    .where(eq(schema.orderStageHistory.orderId, id))
    .orderBy(desc(schema.orderStageHistory.createdAt));

  const invoices = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.orgId, active.org.id), eq(schema.invoices.orderId, id)));

  const currency = active.org.currency;

  return (
    <div className="space-y-4">
      <Link
        href="/portal/orders"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        {stage && (
          <span
            className="rounded-full px-3 py-1 text-sm font-medium text-white"
            style={{ backgroundColor: stage.color }}
          >
            {stage.name}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-16">Qty</TableHead>
                <TableHead className="w-24 text-right">Price</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>
                    <div className="font-medium">{it.name}</div>
                    {it.sku && <div className="text-xs text-muted-foreground">{it.sku}</div>}
                  </TableCell>
                  <TableCell>{it.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(it.unitPrice, currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(it.lineTotal, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotal, currency)} />
              {parseFloat(order.taxTotal) > 0 && (
                <Row label="Tax" value={formatMoney(order.taxTotal, currency)} />
              )}
              <Row label="Total" value={formatMoney(order.total, currency)} emphasize />
            </div>
          </div>
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2">
                  <div>
                    <Link
                      href={`/portal/invoices/${inv.id}`}
                      className="font-medium hover:underline"
                    >
                      {inv.number}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {inv.status.toUpperCase()}
                    </div>
                  </div>
                  <span className="font-medium">
                    {formatMoney(inv.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between">
                  <span>{h.note ?? "Stage changed"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasize ? "text-base font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
