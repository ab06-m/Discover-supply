import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Truck } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { getOrder, listStages } from "@/modules/orders/queries";
import { StagePipeline } from "@/modules/orders/components/stage-pipeline";
import { createDispatch } from "@/modules/dispatch/actions";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { can, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, role } = await requireActiveOrg();
  const { id } = await params;

  const [record, stages] = await Promise.all([getOrder(org.id, id), listStages(org.id)]);
  if (!record) notFound();

  const { order, stage, customer, items, history } = record;
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const canAdvance = can(role as Role, "order.advance_stage");
  const canInvoice = can(role as Role, "invoice.create");
  const canDispatch = can(role as Role, "dispatch.assign");

  const existingDispatch = await db
    .select({ id: schema.dispatches.id, status: schema.dispatches.status })
    .from(schema.dispatches)
    .where(and(eq(schema.dispatches.orgId, org.id), eq(schema.dispatches.orderId, id)))
    .limit(1);

  async function scheduleDispatch() {
    "use server";
    const res = await createDispatch({ orderId: id });
    redirect(`/delivery/${res.id}`);
  }

  const balance = parseFloat(order.total) - parseFloat(order.amountPaid);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to orders
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.number}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customer.name}
                {customer.storeCode && ` · ${customer.storeCode}`}
              </Link>
            ) : (
              <span>Walk-in</span>
            )}
            <span>· {new Date(order.createdAt).toLocaleDateString()}</span>
            <Badge variant="outline" className="uppercase">
              {order.source}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {canDispatch &&
            (existingDispatch.length ? (
              <Button asChild variant="outline">
                <Link href={`/delivery/${existingDispatch[0].id}`}>
                  <Truck className="mr-2 h-4 w-4" /> View delivery
                </Link>
              </Button>
            ) : (
              <form action={scheduleDispatch}>
                <Button type="submit" variant="outline">
                  <Truck className="mr-2 h-4 w-4" /> Schedule delivery
                </Button>
              </form>
            ))}
          {canInvoice && (
            <Button asChild variant="outline">
              <Link href={`/invoices/new?order=${order.id}`}>
                <FileText className="mr-2 h-4 w-4" /> Create invoice
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <StagePipeline
            orderId={order.id}
            currentStageId={order.stageId}
            stages={stages}
            canAdvance={canAdvance}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-16">Qty</TableHead>
                  <TableHead className="w-24 text-right">Unit</TableHead>
                  <TableHead className="w-28 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="font-medium">{it.name}</div>
                      {it.sku && (
                        <div className="text-xs text-muted-foreground">{it.sku}</div>
                      )}
                    </TableCell>
                    <TableCell>{it.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(it.unitPrice, org.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(it.lineTotal, org.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {order.notes && (
              <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
                <div className="mb-1 text-xs uppercase text-muted-foreground">Notes</div>
                {order.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotal, org.currency)} />
              {parseFloat(order.discountTotal) > 0 && (
                <Row
                  label="Discount"
                  value={`− ${formatMoney(order.discountTotal, org.currency)}`}
                />
              )}
              {parseFloat(order.taxTotal) > 0 && (
                <Row label="Tax" value={formatMoney(order.taxTotal, org.currency)} />
              )}
              <div className="mt-2 border-t pt-2">
                <Row
                  label="Total"
                  value={formatMoney(order.total, org.currency)}
                  emphasize
                />
                {parseFloat(order.amountPaid) > 0 && (
                  <Row
                    label="Paid"
                    value={`− ${formatMoney(order.amountPaid, org.currency)}`}
                  />
                )}
                {balance > 0 && parseFloat(order.amountPaid) > 0 && (
                  <Row label="Balance" value={formatMoney(balance, org.currency)} emphasize />
                )}
              </div>
              {stage && (
                <div className="pt-2 text-xs text-muted-foreground">
                  Current stage:{" "}
                  <span
                    className="ml-1 rounded-full px-2 py-0.5 text-white"
                    style={{ backgroundColor: stage.color }}
                  >
                    {stage.name}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-xs">
                  {history.map((h) => {
                    const to = stageMap.get(h.toStageId);
                    return (
                      <li key={h.id} className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: to?.color ?? "#64748b" }}
                        />
                        <div>
                          <div className="font-medium">
                            {to?.name ?? "Unknown stage"}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(h.createdAt).toLocaleString()}
                          </div>
                          {h.note && <div className="text-muted-foreground">{h.note}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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
    <div className={`flex justify-between ${emphasize ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
