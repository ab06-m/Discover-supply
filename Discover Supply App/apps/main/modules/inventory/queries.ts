import { db, schema } from "@/lib/db";
import { and, asc, count, desc, eq, gt, gte, ilike, lte, or, sql } from "drizzle-orm";

export type ProductListRow = {
  id: string;
  name: string;
  kind: string;
  brand: string | null;
  vendor: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  packSize: number;
  price: string;
  cost: string;
  onHand: number;
  committed: number;
  available: number;
  soldLast30: number;
  lowStockThreshold: number | null;
  trackStock: boolean;
  isActive: boolean;
  imageUrl: string | null;
  imageGallery: string[];
  returnable: boolean;
  showInOnlineStore: boolean;
};

export type ProductStockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
export type ProductSortOption =
  | "newest"
  | "most_sales"
  | "least_sales"
  | "highest_inventory"
  | "lowest_inventory"
  | "highest_value"
  | "lowest_value";

function buildProductsWhere(
  orgId: string,
  {
    search,
    stockFilter = "all",
    defaultLowStockThreshold,
  }: {
    search?: string;
    stockFilter?: ProductStockFilter;
    defaultLowStockThreshold?: number;
  },
) {
  const available = sql<number>`${schema.products.onHand} - ${schema.products.committed}`;
  const lowStockThreshold = sql<number>`coalesce(${schema.products.lowStockThreshold}, ${defaultLowStockThreshold ?? 10})`;
  const searchTerm = search?.trim();
  const filters = [eq(schema.products.orgId, orgId)];

  if (searchTerm) {
    filters.push(
      or(
        ilike(schema.products.name, `%${searchTerm}%`),
        ilike(schema.products.sku, `%${searchTerm}%`),
        ilike(schema.products.barcode, `%${searchTerm}%`),
      )!,
    );
  }

  if (stockFilter === "out_of_stock") {
    filters.push(and(eq(schema.products.trackStock, true), lte(available, 0))!);
  } else if (stockFilter === "low_stock") {
    filters.push(and(eq(schema.products.trackStock, true), gt(available, 0), lte(available, lowStockThreshold))!);
  } else if (stockFilter === "in_stock") {
    filters.push(and(eq(schema.products.trackStock, true), gt(available, lowStockThreshold))!);
  }

  return and(...filters);
}

export async function countProducts(
  orgId: string,
  opts: { search?: string; stockFilter?: ProductStockFilter; defaultLowStockThreshold?: number } = {},
) {
  const where = buildProductsWhere(orgId, opts);

  const [row] = await db.select({ total: count() }).from(schema.products).where(where);
  return row?.total ?? 0;
}

export async function listProducts(
  orgId: string,
  opts: {
    search?: string;
    limit?: number;
    offset?: number;
    stockFilter?: ProductStockFilter;
    defaultLowStockThreshold?: number;
    sortBy?: ProductSortOption;
  } = {},
) {
  const {
    search,
    limit = 50,
    offset = 0,
    stockFilter = "all",
    defaultLowStockThreshold,
    sortBy = "newest",
  } = opts;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const where = buildProductsWhere(orgId, { search, stockFilter, defaultLowStockThreshold });
  const available = sql<number>`${schema.products.onHand} - ${schema.products.committed}`;
  const inventoryValue = sql<number>`${available} * ${schema.products.cost}`;
  const salesLast30Subquery = db
    .select({
      productId: schema.stockMovements.productId,
      sold_last_30:
        sql<number>`coalesce(sum(abs(${schema.stockMovements.onHandDelta})), 0)::int`.as(
          "sold_last_30",
        ),
    })
    .from(schema.stockMovements)
    .where(
      and(
        eq(schema.stockMovements.orgId, orgId),
        eq(schema.stockMovements.kind, "consume"),
        gte(schema.stockMovements.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(schema.stockMovements.productId)
    .as("sales_last_30");
  const soldLast30Metric = sql<number>`coalesce(${salesLast30Subquery.sold_last_30}, 0)::int`.as(
    "sold_last_30_metric",
  );

  const orderBy =
    sortBy === "most_sales"
      ? [desc(soldLast30Metric), desc(available), desc(schema.products.updatedAt)]
      : sortBy === "least_sales"
        ? [asc(soldLast30Metric), asc(available), desc(schema.products.updatedAt)]
        : sortBy === "highest_inventory"
          ? [desc(available), desc(soldLast30Metric), desc(schema.products.updatedAt)]
          : sortBy === "lowest_inventory"
            ? [asc(available), asc(soldLast30Metric), desc(schema.products.updatedAt)]
            : sortBy === "highest_value"
              ? [desc(inventoryValue), desc(available), desc(schema.products.updatedAt)]
              : sortBy === "lowest_value"
                ? [asc(inventoryValue), asc(available), desc(schema.products.updatedAt)]
                : [desc(schema.products.createdAt)];

  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      kind: schema.products.kind,
      brand: schema.products.brand,
      vendor: schema.products.vendor,
      sku: schema.products.sku,
      barcode: schema.products.barcode,
      unit: schema.products.unit,
      packSize: schema.products.packSize,
      price: schema.products.price,
      cost: schema.products.cost,
      onHand: schema.products.onHand,
      committed: schema.products.committed,
      available,
      soldLast30: soldLast30Metric,
      lowStockThreshold: schema.products.lowStockThreshold,
      trackStock: schema.products.trackStock,
      isActive: schema.products.isActive,
      imageUrl: schema.products.imageUrl,
      imageGallery: schema.products.imageGallery,
      returnable: schema.products.returnable,
      showInOnlineStore: schema.products.showInOnlineStore,
    })
    .from(schema.products)
    .leftJoin(salesLast30Subquery, eq(schema.products.id, salesLast30Subquery.productId))
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);
}

export async function getProductInventorySummary(
  orgId: string,
  defaultLowStockThreshold: number,
) {
  const available = sql`greatest(${schema.products.onHand} - ${schema.products.committed}, 0)`;
  const rawAvailable = sql`${schema.products.onHand} - ${schema.products.committed}`;
  const lowStockThreshold = sql`coalesce(${schema.products.lowStockThreshold}, ${defaultLowStockThreshold})`;
  const soldQuantity = sql<number>`coalesce(sum(abs(${schema.stockMovements.onHandDelta})), 0)::int`;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [[row], [soldRow], [winnerRow]] = await Promise.all([
    db
      .select({
        totalInStock: sql<string>`coalesce(sum(case when ${schema.products.trackStock} then ${available} * ${schema.products.price} else 0 end), 0)`,
        costOfStock: sql<string>`coalesce(sum(case when ${schema.products.trackStock} then ${available} * ${schema.products.cost} else 0 end), 0)`,
        projectedProfit: sql<string>`coalesce(sum(case when ${schema.products.trackStock} then ${available} * (${schema.products.price} - ${schema.products.cost}) else 0 end), 0)`,
        lowInStock: sql<number>`coalesce(sum(case when ${schema.products.trackStock} and ${rawAvailable} > 0 and ${rawAvailable} <= ${lowStockThreshold} then 1 else 0 end), 0)::int`,
        outOfStock: sql<number>`coalesce(sum(case when ${schema.products.trackStock} and ${rawAvailable} <= 0 then 1 else 0 end), 0)::int`,
        inStock: sql<number>`coalesce(sum(case when ${schema.products.trackStock} then ${available} else 0 end), 0)::int`,
      })
      .from(schema.products)
      .where(eq(schema.products.orgId, orgId)),
    db
      .select({
        stockSoldLast30: soldQuantity,
      })
      .from(schema.stockMovements)
      .where(
        and(
          eq(schema.stockMovements.orgId, orgId),
          eq(schema.stockMovements.kind, "consume"),
          gte(schema.stockMovements.createdAt, thirtyDaysAgo),
        ),
      ),
    db
      .select({
        productName: schema.products.name,
        stockSoldLast30: soldQuantity,
      })
      .from(schema.stockMovements)
      .innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
      .where(
        and(
          eq(schema.stockMovements.orgId, orgId),
          eq(schema.stockMovements.kind, "consume"),
          gte(schema.stockMovements.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(schema.products.id, schema.products.name)
      .orderBy(desc(soldQuantity))
      .limit(1),
  ]);

  return {
    totalInStock: row?.totalInStock ?? "0",
    costOfStock: row?.costOfStock ?? "0",
    projectedProfit: row?.projectedProfit ?? "0",
    lowInStock: row?.lowInStock ?? 0,
    outOfStock: row?.outOfStock ?? 0,
    inStock: row?.inStock ?? 0,
    stockSoldLast30: soldRow?.stockSoldLast30 ?? 0,
    last30WinnerName: winnerRow?.productName ?? null,
    last30WinnerSold: winnerRow?.stockSoldLast30 ?? 0,
  };
}

export async function searchProductSuggestions(orgId: string, query: string, limit = 8) {
  const search = query.trim();
  if (search.length < 1) return [];

  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      barcode: schema.products.barcode,
      unit: schema.products.unit,
      packSize: schema.products.packSize,
      imageUrl: schema.products.imageUrl,
      price: schema.products.price,
      onHand: schema.products.onHand,
      committed: schema.products.committed,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.orgId, orgId),
        eq(schema.products.isActive, true),
        or(
          ilike(schema.products.name, `%${search}%`),
          ilike(schema.products.sku, `%${search}%`),
          ilike(schema.products.barcode, `%${search}%`),
        ),
      ),
    )
    .orderBy(desc(schema.products.updatedAt))
    .limit(limit);
}

export async function getProduct(orgId: string, id: string) {
  const rows = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.orgId, orgId), eq(schema.products.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findProductByBarcode(orgId: string, barcode: string) {
  const rows = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.orgId, orgId), eq(schema.products.barcode, barcode)))
    .limit(1);
  return rows[0] ?? null;
}

export async function recentStockMovements(orgId: string, limit = 25) {
  return db
    .select({
      id: schema.stockMovements.id,
      productId: schema.stockMovements.productId,
      productName: schema.products.name,
      kind: schema.stockMovements.kind,
      onHandDelta: schema.stockMovements.onHandDelta,
      committedDelta: schema.stockMovements.committedDelta,
      note: schema.stockMovements.note,
      createdAt: schema.stockMovements.createdAt,
    })
    .from(schema.stockMovements)
    .leftJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
    .where(eq(schema.stockMovements.orgId, orgId))
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(limit);
}
