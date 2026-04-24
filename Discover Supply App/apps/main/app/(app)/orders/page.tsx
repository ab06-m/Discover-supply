import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listOrders, listStages } from "@/modules/orders/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q, stage } = await searchParams;
  const [rows, stages] = await Promise.all([
    listOrders(org.id, { search: q, stageId: stage }),
    listStages(org.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} order{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="mr-2 h-4 w-4" /> New order
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search order # or store…"
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <select
          name="stage"
          defaultValue={stage ?? ""}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No orders yet.{" "}
                  <Link className="underline" href="/orders/new">
                    Create your first order
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
            {rows.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <Link href={`/orders/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                </TableCell>
                <TableCell>
                  {o.customerName ? (
                    <>
                      <div>{o.customerName}</div>
                      {o.storeCode && (
                        <div className="text-xs text-muted-foreground">{o.storeCode}</div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {o.stageName && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: o.stageColor ?? "#64748b" }}
                    >
                      {o.stageName}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatMoney(o.total, org.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
