import Link from "next/link";
import { Plus, Store } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listCustomers } from "@/modules/customers/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q } = await searchParams;
  const rows = await listCustomers(org.id, { search: q });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} customer${rows.length === 1 ? "" : "s"}`}
        actions={
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" /> Add customer
            </Link>
          </Button>
        }
      />

      <form className="max-w-sm">
        <Input name="q" placeholder="Search name, code, or email..." defaultValue={q ?? ""} />
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title={q ? "No customers match your search" : "No customers yet"}
          description={
            q
              ? "Try a different name, store code, email, or phone number."
              : "Add customer records so orders, invoices, and deliveries have a destination."
          }
          action={
            !q ? (
              <Button asChild>
                <Link href="/customers/new">Add your first customer</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead className="text-right">Open orders</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.storeCode ?? "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm">{c.email ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">
                    {c.paymentTerms}
                  </TableCell>
                  <TableCell className="text-right">{c.openOrders}</TableCell>
                  <TableCell>{!c.isActive && <Badge variant="secondary">inactive</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
