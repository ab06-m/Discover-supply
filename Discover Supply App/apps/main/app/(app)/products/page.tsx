import { Suspense } from "react";
import Link from "next/link";
import { FolderTree, Package, PackagePlus, SlidersHorizontal } from "lucide-react";
import { ManageCategoriesDialog } from "@/modules/inventory/components/manage-categories-dialog";
import { requireActiveOrg } from "@/lib/auth";
import {
  countProducts,
  getProductInventorySummary,
  listProducts,
  type ProductSortOption,
  type ProductStockFilter,
} from "@/modules/inventory/queries";
import { getInventorySettings } from "@/modules/inventory/lib/stock-rules";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
const STOCK_FILTERS: { value: ProductStockFilter; label: string; helper: string }[] = [
  { value: "all", label: "All Items", helper: "All products" },
  { value: "in_stock", label: "In stock", helper: "Healthy stock only" },
  { value: "low_stock", label: "Low stock", helper: "Needs reorder soon" },
  { value: "out_of_stock", label: "Out of stock", helper: "Replenish now" },
];
const SORT_OPTIONS: { value: ProductSortOption; label: string; helper: string }[] = [
  { value: "newest", label: "Newest items", helper: "Recently created products first" },
  { value: "most_sales", label: "Most sales (30d)", helper: "Best-moving items at the top" },
  { value: "least_sales", label: "Least sales (30d)", helper: "Slow movers to review" },
  { value: "highest_inventory", label: "Highest inventory", helper: "Largest available stock first" },
  { value: "lowest_inventory", label: "Lowest inventory", helper: "Tightest stock first" },
  { value: "highest_value", label: "Highest stock value", helper: "Most capital tied up first" },
  { value: "lowest_value", label: "Lowest stock value", helper: "Least capital tied up first" },
];

function parseStockFilter(value?: string): ProductStockFilter {
  if (value === "in_stock" || value === "low_stock" || value === "out_of_stock") return value;
  return "all";
}

function parseSortOption(value?: string): ProductSortOption {
  if (
    value === "most_sales" ||
    value === "least_sales" ||
    value === "highest_inventory" ||
    value === "lowest_inventory" ||
    value === "highest_value" ||
    value === "lowest_value"
  ) {
    return value;
  }
  return "newest";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    received?: string;
    page?: string;
    per_page?: string;
    stock?: string;
    sort?: string;
  }>;
}) {
  const { org } = await requireActiveOrg();
  const {
    q,
    received,
    page: pageParam,
    per_page: perPageParam,
    stock: stockParam,
    sort: sortParam,
  } = await searchParams;
  const stockFilter = parseStockFilter(stockParam);
  const sortBy = parseSortOption(sortParam);

  const perPage = ALLOWED_PER_PAGE.includes(Number(perPageParam))
    ? Number(perPageParam)
    : DEFAULT_PER_PAGE;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * perPage;
  const { defaultLowStockThreshold } = getInventorySettings(org.settings);

  const [products, total, inventorySummary] = await Promise.all([
    listProducts(org.id, {
      search: q,
      limit: perPage,
      offset,
      stockFilter,
      defaultLowStockThreshold,
      sortBy,
    }),
    countProducts(org.id, { search: q, stockFilter, defaultLowStockThreshold }),
    getProductInventorySummary(org.id, defaultLowStockThreshold),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const activeStockFilter = STOCK_FILTERS.find((option) => option.value === stockFilter) ?? STOCK_FILTERS[0];
  const activeSort = SORT_OPTIONS.find((option) => option.value === sortBy) ?? SORT_OPTIONS[0];
  const subtitle =
    stockFilter === "all"
      ? `${total} product${total === 1 ? "" : "s"} · ${activeSort.label.toLowerCase()}`
      : `${total} product${total === 1 ? "" : "s"} · ${activeStockFilter.label.toLowerCase()} · ${activeSort.label.toLowerCase()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle={subtitle}
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
          </>
        }
      />

      <section className="space-y-3 rounded-xl border bg-card/40 p-3 sm:p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Inventory controls
        </div>
        <form>
          {stockFilter !== "all" && <input type="hidden" name="stock" value={stockFilter} />}
          {sortBy !== "newest" && <input type="hidden" name="sort" value={sortBy} />}
          {perPageParam && <input type="hidden" name="per_page" value={perPageParam} />}
          <ProductSearchInput defaultValue={q ?? ""} />
        </form>
        <form action="/products" className="grid gap-2 border-t pt-3 sm:flex sm:items-end sm:justify-between">
          <div className="text-xs text-muted-foreground sm:pb-0.5">
            More options: prioritize your next inventory action.
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,14rem)_auto]">
            {q && <input type="hidden" name="q" value={q} />}
            {perPageParam && <input type="hidden" name="per_page" value={perPageParam} />}
            <Select
              name="stock"
              defaultValue={stockFilter}
              className="h-9 min-w-44"
              aria-label="Stock status filter"
            >
              {STOCK_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              name="sort"
              defaultValue={sortBy}
              className="h-9 min-w-52"
              aria-label="More inventory sorting options"
              title={activeSort.helper}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline" className="h-9">
              Apply
            </Button>
          </div>
        </form>
      </section>

      {received && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Received stock logged as <strong>{received}</strong>.
        </div>
      )}

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

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q ? "No products match your search" : "No products in this stock view"}
          description={
            q
              ? "Try searching by product name, SKU, or barcode, or switch to another stock filter."
              : "Switch stock filters or create products before receiving stock, building orders, or importing inventory."
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
