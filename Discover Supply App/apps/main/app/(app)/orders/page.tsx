import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listOrders, listStages } from "@/modules/orders/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
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
        <Card className="overflow-hidden shadow-card">
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
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.stageName && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
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
        </Card>
      )}
    </div>
  );
}
