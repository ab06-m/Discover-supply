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
    })
    .from(schema.products)
    .where(where)
    .orderBy(desc(schema.products.createdAt))
    .limit(limit)
    .offset(offset);
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
