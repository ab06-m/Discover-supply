import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listCustomers } from "@/modules/customers/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground">{rows.length} store{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Button asChild>
          <Link href="/customers/new"><Plus className="mr-2 h-4 w-4" /> Add store</Link>
        </Button>
      </div>

      <form className="max-w-sm">
        <Input name="q" placeholder="Search name, code, or email…" defaultValue={q ?? ""} />
      </form>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Store</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead className="text-right">Open orders</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No stores yet. <Link className="underline" href="/customers/new">Add your first store</Link>.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.storeCode ?? "—"}</TableCell>
                <TableCell>
                  <div className="text-sm">{c.email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>
                </TableCell>
                <TableCell className="text-muted-foreground uppercase text-xs">{c.paymentTerms}</TableCell>
                <TableCell className="text-right">{c.openOrders}</TableCell>
                <TableCell>{!c.isActive && <Badge variant="secondary">inactive</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
