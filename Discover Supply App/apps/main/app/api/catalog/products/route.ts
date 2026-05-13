import { NextResponse } from "next/server";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { getCatalogOrg } from "@/lib/catalog-org";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 96;

function numberParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const org = await getCatalogOrg();
  const url = new URL(request.url);
  const page = numberParam(url.searchParams.get("page"), 1);
  const limit = Math.min(numberParam(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const offset = (page - 1) * limit;

  const conditions = [
    eq(schema.products.orgId, org.id),
    eq(schema.products.isActive, true),
    eq(schema.products.showInOnlineStore, true),
  ];

  if (search) {
    const where = or(
      ilike(schema.products.name, `%${search}%`),
      ilike(schema.products.sku, `%${search}%`),
      ilike(schema.products.barcode, `%${search}%`),
      ilike(schema.products.brand, `%${search}%`),
    );
    if (where) conditions.push(where);
  }

  const where = and(...conditions);
  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        sku: schema.products.sku,
        barcode: schema.products.barcode,
        description: schema.products.description,
        brand: schema.products.brand,
        price: schema.products.price,
        unit: schema.products.unit,
        imageUrl: schema.products.imageUrl,
        available: sql<number>`${schema.products.onHand} - ${schema.products.committed}`,
        trackStock: schema.products.trackStock,
      })
      .from(schema.products)
      .where(where)
      .orderBy(asc(schema.products.name))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(schema.products).where(where),
  ]);

  return NextResponse.json({
    items,
    pageContext: {
      hasMorePage: page * limit < (totalRow?.total ?? 0),
      total: totalRow?.total ?? 0,
    },
    org: { currency: org.currency },
  });
}
