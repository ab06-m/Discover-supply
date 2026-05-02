import { db, schema } from "@/lib/db";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

export async function countProducts(orgId: string, search?: string) {
  const where = search
    ? and(
        eq(schema.products.orgId, orgId),
        or(
          ilike(schema.products.name, `%${search}%`),
          ilike(schema.products.sku, `%${search}%`),
          ilike(schema.products.barcode, `%${search}%`),
        ),
      )
    : eq(schema.products.orgId, orgId);

  const [row] = await db.select({ total: count() }).from(schema.products).where(where);
  return row?.total ?? 0;
}

export async function listProducts(
  orgId: string,
  opts: { search?: string; limit?: number; offset?: number } = {},
) {
  const { search, limit = 50, offset = 0 } = opts;
  const where = search
    ? and(
        eq(schema.products.orgId, orgId),
        or(
          ilike(schema.products.name, `%${search}%`),
          ilike(schema.products.sku, `%${search}%`),
          ilike(schema.products.barcode, `%${search}%`),
        ),
      )
    : eq(schema.products.orgId, orgId);

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
      available: sql<number>`${schema.products.onHand} - ${schema.products.committed}`,
      lowStockThreshold: schema.products.lowStockThreshold,
      trackStock: schema.products.trackStock,
      isActive: schema.products.isActive,
      imageUrl: schema.products.imageUrl,
      imageGallery: schema.products.imageGallery,
      returnable: schema.products.returnable,
      showInOnlineStore: schema.products.showInOnlineStore,
    })
    .from(schema.products)
    .where(where)
    .orderBy(desc(schema.products.createdAt))
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

  const [row] = await db
    .select({
      totalInStock: sql<string>`coalesce(sum(case when ${schema.products.trackStock} then ${available} * ${schema.products.price} else 0 end), 0)`,
      costOfStock: sql<string>`coalesce(sum(case when ${schema.products.trackStock} then ${available} * ${schema.products.cost} else 0 end), 0)`,
      projectedProfit: sql<string>`coalesce(sum(case when ${schema.products.trackStock} then ${available} * (${schema.products.price} - ${schema.products.cost}) else 0 end), 0)`,
      lowInStock: sql<number>`coalesce(sum(case when ${schema.products.trackStock} and ${rawAvailable} > 0 and ${rawAvailable} <= ${lowStockThreshold} then 1 else 0 end), 0)::int`,
      outOfStock: sql<number>`coalesce(sum(case when ${schema.products.trackStock} and ${rawAvailable} <= 0 then 1 else 0 end), 0)::int`,
      inStock: sql<number>`coalesce(sum(case when ${schema.products.trackStock} then ${available} else 0 end), 0)::int`,
    })
    .from(schema.products)
    .where(eq(schema.products.orgId, orgId));

  return {
    totalInStock: row?.totalInStock ?? "0",
    costOfStock: row?.costOfStock ?? "0",
    projectedProfit: row?.projectedProfit ?? "0",
    lowInStock: row?.lowInStock ?? 0,
    outOfStock: row?.outOfStock ?? 0,
    inStock: row?.inStock ?? 0,
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
