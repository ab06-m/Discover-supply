import { Suspense } from "react";
import Link from "next/link";
import { Plus, PackagePlus, AlertTriangle, Package } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { listProducts, countProducts } from "@/modules/inventory/queries";
import {
  getInventorySettings,
  getStockStatus,
  resolveLowStockThreshold,
} from "@/modules/inventory/lib/stock-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationControls } from "@/components/app/pagination-controls";
import { ProductSearchInput } from "@/components/app/product-search-input";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEFAULT_PER_PAGE = 50;
const ALLOWED_PER_PAGE = [25, 50, 100, 250];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; received?: string; page?: string; per_page?: string }>;
}) {
  const { org } = await requireActiveOrg();
  const { q, received, page: pageParam, per_page: perPageParam } = await searchParams;

  const perPage = ALLOWED_PER_PAGE.includes(Number(perPageParam))
    ? Number(perPageParam)
    : DEFAULT_PER_PAGE;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * perPage;

  const [products, total] = await Promise.all([
    listProducts(org.id, { search: q, limit: perPage, offset }),
    countProducts(org.id, q),
  ]);

  const { defaultLowStockThreshold } = getInventorySettings(org.settings);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {total} product{total === 1 ? "" : "s"}
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

      <form>
        <ProductSearchInput defaultValue={q ?? ""} />
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
                  {q
                    ? "No products match your search."
                    : <>No products yet. <Link className="underline" href="/products/new">Add your first product</Link>.</>}
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => {
              const effectiveLowStockThreshold = resolveLowStockThreshold(
                p.lowStockThreshold,
                defaultLowStockThreshold,
              );
              const stockStatus = p.trackStock
                ? getStockStatus(Number(p.available), effectiveLowStockThreshold)
                : null;
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
                    <span className="inline-flex items-center justify-end gap-1">
                      {p.trackStock ? (
                        <>
                          {stockStatus === "good" ? (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <AlertTriangle
                              className={`h-3.5 w-3.5 ${stockStatus === "out" ? "text-rose-600" : "text-amber-500"}`}
                            />
                          )}
                          <span>{p.available}</span>
                        </>
                      ) : "—"}
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

      <Suspense>
        <PaginationControls total={total} page={safePage} perPage={perPage} />
      </Suspense>
    </div>
  );
}
