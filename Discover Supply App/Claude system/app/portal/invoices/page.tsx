import Link from "next/link";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { db, schema } from "@/lib/db";
import { and, desc, eq, sql } from "drizzle-orm";
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

export default async function PortalInvoices({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { active } = await requireCustomer();
  const { status } = await searchParams;

  const conds = [
    eq(schema.invoices.orgId, active.org.id),
    eq(schema.invoices.customerId, active.contact.customerId),
  ];
  if (status === "unpaid") {
    conds.push(sql`${schema.invoices.status} not in ('paid', 'void', 'draft')`);
  }

  const invoices = await db
    .select()
    .from(schema.invoices)
    .where(and(...conds))
    .orderBy(desc(schema.invoices.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href="/portal/invoices"
            className={`rounded-md px-3 py-1 ${!status ? "bg-secondary" : "hover:bg-secondary"}`}
          >
            All
          </Link>
          <Link
            href="/portal/invoices?status=unpaid"
            className={`rounded-md px-3 py-1 ${status === "unpaid" ? "bg-secondary" : "hover:bg-secondary"}`}
          >
            Unpaid
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No invoices here.
                </TableCell>
              </TableRow>
            )}
            {invoices.map((i) => {
              const balance = parseFloat(i.total) - parseFloat(i.amountPaid);
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link
                      href={`/portal/invoices/${i.id}`}
                      className="font-medium hover:underline"
                    >
                      {i.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(i.issueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="uppercase text-xs">{i.status}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(i.total, active.org.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {balance > 0 ? (
                      <span className="font-medium text-amber-600">
                        {formatMoney(balance, active.org.currency)}
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
