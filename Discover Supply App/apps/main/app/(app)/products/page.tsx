import { Suspense } from "react";
import Link from "next/link";
import { FolderTree, Package, PackagePlus, Plus } from "lucide-react";
import { ManageCategoriesDialog } from "@/modules/inventory/components/manage-categories-dialog";
import { requireActiveOrg } from "@/lib/auth";
import {
  countProducts,
  getProductInventorySummary,
  listProducts,
} from "@/modules/inventory/queries";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { PaginationControls } from "@/components/app/pagination-controls";
import { ProductSearchInput } from "@/components/app/product-search-input";
import { EmptyState } from "@/components/app/empty-state";
import { InventorySummaryPanel } from "@/components/app/inventory-summary-panel";
import { ProductsList } from "@/modules/inventory/components/products-list";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DEFAULT_PER_PAGE = 50;
const ALLOWED_PER_PAGE = [25, 50, 100, 250];
const numberFormatter = new Intl.NumberFormat("en-US");

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
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);

  const [products, total, inventorySummary] = await Promise.all([
    listProducts(org.id, { search: q, limit: perPage, offset }),
    countProducts(org.id, q),
    getProductInventorySummary(org.id, defaultLowStockThreshold),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle={`${total} product${total === 1 ? "" : "s"}`}
        actions={
          <>
            <ManageCategoriesDialog
              trigger={
                <Button variant="outline">
                  <FolderTree className="mr-2 h-4 w-4" /> Manage categories
                </Button>
              }
            />
            <Button asChild variant="outline">
              <Link href="/check-in?tab=existing">
                <PackagePlus className="mr-2 h-4 w-4" /> Check in stock
              </Link>
            </Button>
            <Button asChild>
              <Link href="/check-in">
                <Plus className="mr-2 h-4 w-4" /> New item
              </Link>
            </Button>
          </>
        }
      />

      <InventorySummaryPanel
        items={[
          {
            id: "totalInStock",
            label: "Total in stock",
            value: formatMoney(inventorySummary.totalInStock, org.currency),
          },
          {
            id: "costOfStock",
            label: "Cost of stock",
            value: formatMoney(inventorySummary.costOfStock, org.currency),
          },
          {
            id: "projectedProfit",
            label: "Projected profit",
            value: formatMoney(inventorySummary.projectedProfit, org.currency),
          },
          {
            id: "stockSoldLast30",
            label: "Stock sold",
            value: numberFormatter.format(inventorySummary.stockSoldLast30),
          },
          {
            id: "last30Winner",
            label: "Last 30 days winner",
            value: inventorySummary.last30WinnerName
              ? `${inventorySummary.last30WinnerName} (${numberFormatter.format(
                  inventorySummary.last30WinnerSold,
                )})`
              : "-",
          },
          {
            id: "lowInStock",
            label: "Low in stock",
            value: numberFormatter.format(inventorySummary.lowInStock),
            tone: "warning",
          },
          {
            id: "outOfStock",
            label: "Out of stock",
            value: numberFormatter.format(inventorySummary.outOfStock),
            tone: "destructive",
          },
          {
            id: "inStock",
            label: "In stock",
            value: numberFormatter.format(inventorySummary.inStock),
          },
        ]}
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
                <Link href="/products/new">Add your first item</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <ProductsList
          rows={products}
          currency={org.currency}
          defaultLowStockThreshold={defaultLowStockThreshold}
        />
      )}

      <Suspense>
        <PaginationControls total={total} page={safePage} perPage={perPage} />
      </Suspense>
    </div>
  );
}
