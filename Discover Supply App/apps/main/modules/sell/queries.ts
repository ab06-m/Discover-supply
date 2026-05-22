import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function listSellProducts(orgId: string, limit = 180) {
  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      barcode: schema.products.barcode,
      categoryId: schema.products.categoryId,
      unit: schema.products.unit,
      packSize: schema.products.packSize,
      price: schema.products.price,
      onHand: schema.products.onHand,
      committed: schema.products.committed,
      lowStockThreshold: schema.products.lowStockThreshold,
      trackStock: schema.products.trackStock,
      imageUrl: schema.products.imageUrl,
    })
    .from(schema.products)
    .where(and(eq(schema.products.orgId, orgId), eq(schema.products.isActive, true)))
    .orderBy(desc(schema.products.updatedAt))
    .limit(limit);
}

export async function listSellProductsPaginated(
  orgId: string,
  opts: {
    query?: string;
    categoryId?: string;
    onlyAvailable?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { query, categoryId, onlyAvailable, limit = 40, offset = 0 } = opts;

  const conditions = [
    eq(schema.products.orgId, orgId),
    eq(schema.products.isActive, true),
  ];

  if (categoryId) {
    conditions.push(eq(schema.products.categoryId, categoryId));
  }

  if (onlyAvailable) {
    // If tracking stock is enabled, available stock (onHand - committed) must be > 0.
    // If trackStock is false, they are always available.
    conditions.push(
      or(
        eq(schema.products.trackStock, false),
        sql`${schema.products.onHand} - ${schema.products.committed} > 0`
      )!
    );
  }

  if (query && query.trim().length > 0) {
    const searchPattern = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(schema.products.name, searchPattern),
        ilike(schema.products.sku, searchPattern),
        ilike(schema.products.barcode, searchPattern)
      )!
    );
  }

  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      barcode: schema.products.barcode,
      categoryId: schema.products.categoryId,
      unit: schema.products.unit,
      packSize: schema.products.packSize,
      price: schema.products.price,
      onHand: schema.products.onHand,
      committed: schema.products.committed,
      lowStockThreshold: schema.products.lowStockThreshold,
      trackStock: schema.products.trackStock,
      imageUrl: schema.products.imageUrl,
    })
    .from(schema.products)
    .where(and(...conditions))
    .orderBy(desc(schema.products.updatedAt))
    .limit(limit)
    .offset(offset);
}

