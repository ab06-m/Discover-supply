import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Package, PackagePlus, Plus } from "lucide-react";
import { requireActiveOrg } from "@/lib/auth";
import { countProducts, listProducts } from "@/modules/inventory/queries";
import {
  getInventorySettings,
  getStockStatus,
  resolveLowStockThreshold,
} from "@/modules/inventory/lib/stock-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PaginationControls } from "@/components/app/pagination-controls";
import { ProductSearchInput } from "@/components/app/product-search-input";
import { EmptyState } from "@/components/app/empty-state";
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
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle={`${total} product${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/check-in">
                <PackagePlus className="mr-2 h-4 w-4" /> Check in stock
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <Plus className="mr-2 h-4 w-4" /> New product
              </Link>
            </Button>
          </>
        }
      />

      {received && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Received stock logged as <strong>{received}</strong>.
        </div>
      )}

      <form>
        <ProductSearchInput defaultValue={q ?? ""} />
      </form>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q ? "No products match your search" : "No products yet"}
          description={
            q
              ? "Try searching by product name, SKU, or barcode."
              : "Create products before receiving stock, building orders, or importing inventory."
          }
          action={
            !q ? (
              <Button asChild>
                <Link href="/products/new">Add your first product</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden shadow-card">
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
                    <TableCell className="text-muted-foreground">{p.sku ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(p.price, org.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        {p.trackStock ? (
                          <>
                            {stockStatus === "good" ? (
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <AlertTriangle
                                className={`h-3.5 w-3.5 ${
                                  stockStatus === "out" ? "text-destructive" : "text-warning"
                                }`}
                              />
                            )}
                            <span
                              className={
                                stockStatus === "out"
                                  ? "text-destructive"
                                  : stockStatus === "low"
                                    ? "text-warning"
                                    : ""
                              }
                            >
                              {p.available}
                            </span>
                          </>
                        ) : (
                          "-"
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.trackStock ? p.onHand : "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.trackStock ? p.committed : "-"}
                    </TableCell>
                    <TableCell>
                      {!p.isActive && <Badge variant="secondary">inactive</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Suspense>
        <PaginationControls total={total} page={safePage} perPage={perPage} />
      </Suspense>
    </div>
  );
}
