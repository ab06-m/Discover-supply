import { NextResponse } from "next/server";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 96;

function numberParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolveStoreOrgId() {
  const configured = process.env.STORE_ORG_ID ?? process.env.NEXT_PUBLIC_STORE_ORG_ID;
  return configured?.trim() || null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = numberParam(url.searchParams.get("page"), 1);
  const limit = Math.min(numberParam(url.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const offset = (page - 1) * limit;
  const orgId = await resolveStoreOrgId();

  if (!orgId) {
    return NextResponse.json({
      items: [],
      pageContext: { hasMorePage: false },
      org: { currency: "USD" },
    });
  }

  const conditions = [
    eq(schema.products.orgId, orgId),
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
  const [items, [totalRow], [org]] = await Promise.all([
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
    db
      .select({ currency: schema.organizations.currency })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .limit(1),
  ]);

  return NextResponse.json({
    items,
    pageContext: {
      hasMorePage: page * limit < (totalRow?.total ?? 0),
      total: totalRow?.total ?? 0,
    },
    org: { currency: org?.currency ?? "USD" },
  });
}
