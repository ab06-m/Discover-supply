import Link from "next/link";
import { FileText } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listInvoices } from "@/modules/invoices/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["draft", "sent", "viewed", "partial", "paid", "overdue", "void"];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  viewed: "bg-accent text-accent-foreground",
  partial: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  void: "bg-secondary text-secondary-foreground",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q, status } = await searchParams;
  const rows = await listInvoices(org.id, { search: q, status });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${rows.length} invoice${rows.length === 1 ? "" : "s"}`}
      />

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search invoice # or store..."
          defaultValue={q ?? ""}
          className="max-w-xs"
        />
        <div className="w-48">
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
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
          icon={FileText}
          title={q || status ? "No invoices match your filters" : "No invoices yet"}
          description={
            q || status
              ? "Clear or adjust the search and status filters to widen the list."
              : "Invoices are created from orders once a store is ready to be billed."
          }
        />
      ) : (
        <Card className="overflow-hidden shadow-card">
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
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs uppercase",
                          STATUS_STYLES[i.status] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(i.issueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(i.total, org.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {balance > 0 ? (
                        <span className="font-medium text-warning">
                          {formatMoney(balance, org.currency)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
