import { db, schema } from "@/lib/db";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";

// Public-ish catalog — requires portal login for pricing but the product list
// itself could be shown to anon users. We go with "portal-only" for MVP.
export async function listCatalog(
  orgId: string,
  opts: { search?: string; category?: string } = {},
) {
  const conds = [
    eq(schema.products.orgId, orgId),
    eq(schema.products.isActive, true),
    eq(schema.products.showInOnlineStore, true),
  ];
  if (opts.category) conds.push(eq(schema.products.categoryId, opts.category));
  if (opts.search) {
    const w = or(
      ilike(schema.products.name, `%${opts.search}%`),
      ilike(schema.products.sku, `%${opts.search}%`),
      ilike(schema.products.barcode, `%${opts.search}%`),
    );
    if (w) conds.push(w);
  }

  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      description: schema.products.description,
      price: schema.products.price,
      unit: schema.products.unit,
      imageUrl: schema.products.imageUrl,
      available: sql<number>`${schema.products.onHand} - ${schema.products.committed}`,
      trackStock: schema.products.trackStock,
    })
    .from(schema.products)
    .where(and(...conds))
    .orderBy(asc(schema.products.name));
}

export async function getCatalogItem(orgId: string, id: string) {
  const rows = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      description: schema.products.description,
      price: schema.products.price,
      unit: schema.products.unit,
      imageUrl: schema.products.imageUrl,
      available: sql<number>`${schema.products.onHand} - ${schema.products.committed}`,
      trackStock: schema.products.trackStock,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.orgId, orgId),
        eq(schema.products.id, id),
        eq(schema.products.isActive, true),
        eq(schema.products.showInOnlineStore, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
