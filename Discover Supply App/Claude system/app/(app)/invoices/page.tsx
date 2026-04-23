import Link from "next/link";
import { requireActiveOrg } from "@/lib/auth";
import { listInvoices } from "@/modules/invoices/queries";
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

const STATUS_OPTIONS = ["draft", "sent", "viewed", "partial", "paid", "overdue", "void"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q, status } = await searchParams;
  const rows = await listInvoices(org.id, { search: q, status });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} invoice{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search invoice # or store…"
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
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
              <TableHead>Invoice</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No invoices yet. Create one from an order.
                </TableCell>
              </TableRow>
            )}
            {rows.map((i) => {
              const balance = parseFloat(i.total) - parseFloat(i.amountPaid);
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link href={`/invoices/${i.id}`} className="font-medium hover:underline">
                      {i.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {i.customerName ? (
                      <>
                        <div>{i.customerName}</div>
                        {i.storeCode && (
                          <div className="text-xs text-muted-foreground">{i.storeCode}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase">
                      {i.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(i.issueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(i.total, org.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {balance > 0 ? (
                      <span className="font-medium text-amber-600">
                        {formatMoney(balance, org.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
