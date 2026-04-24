import Link from "next/link";
import { Plus, PackagePlus, AlertTriangle } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listProducts } from "@/modules/inventory/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; received?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q, received } = await searchParams;
  const products = await listProducts(org.id, { search: q });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/check-in"><PackagePlus className="mr-2 h-4 w-4" /> Check in stock</Link>
          </Button>
          <Button asChild>
            <Link href="/products/new"><Plus className="mr-2 h-4 w-4" /> New product</Link>
          </Button>
        </div>
      </div>

      {received && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Received stock logged as <strong>{received}</strong>.
        </div>
      )}

      <form className="max-w-sm">
        <Input name="q" placeholder="Search name, SKU, or barcode…" defaultValue={q ?? ""} />
      </form>

      <div className="overflow-hidden rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No products yet. <Link className="underline" href="/products/new">Add your first product</Link>.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => {
              const low =
                p.trackStock && Number(p.available) <= Number(p.lowStockThreshold ?? 0);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.barcode && (
                      <div className="text-xs text-muted-foreground">#{p.barcode}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.price, org.currency)}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {low && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      {p.trackStock ? p.available : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.trackStock ? p.onHand : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.trackStock ? p.committed : "—"}
                  </TableCell>
                  <TableCell>
                    {!p.isActive && <Badge variant="secondary">inactive</Badge>}
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
