import { and, desc, eq } from "drizzle-orm";
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
