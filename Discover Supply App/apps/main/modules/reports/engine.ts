import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type ReportFilters = {
  start?: string;
  end?: string;
  sku?: string;
  categoryId?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
  inactivityDays?: number;
};

function parseDateRange(filters: ReportFilters) {
  const end = filters.end ? new Date(`${filters.end}T23:59:59.999Z`) : new Date();
  const start = filters.start ? new Date(`${filters.start}T00:00:00.000Z`) : new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  return { start, end };
}

function paginate(filters: ReportFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function runReport(orgId: string, report: string, filters: ReportFilters, format: "json" | "csv" = "json") {
  const out = await getReport(orgId, report, filters);
  if (format === "csv") return { contentType: "text/csv", body: csv(out.data as Array<Record<string, unknown>>) };
  return { contentType: "application/json", body: JSON.stringify(out) };
}

async function getReport(orgId: string, report: string, filters: ReportFilters) {
  const range = parseDateRange(filters);
  const { pageSize, offset, page } = paginate(filters);

  if (report === "inventory-turnover") {
    const data = await db.select({
      sku: schema.products.sku,
      product: schema.products.name,
      category: schema.categories.name,
      month: sql<string>`to_char(date_trunc('month', ${schema.orders.createdAt}), 'YYYY-MM')`,
      unitsSold: sql<number>`coalesce(sum(${schema.orderItems.quantity}),0)::int`,
      cogs: sql<string>`coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost},0)),0)`,
      avgInventory: sql<string>`coalesce(avg(${schema.products.onHand}),0)`,
      turnoverRatio: sql<string>`case when coalesce(avg(${schema.products.onHand} * coalesce(${schema.products.cost},0)),0)=0 then '0' else (coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost},0)),0)/avg(${schema.products.onHand} * coalesce(${schema.products.cost},0)))::text end`,
    }).from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .innerJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(eq(schema.orders.orgId, orgId), gte(schema.orders.createdAt, range.start), lte(schema.orders.createdAt, range.end)))
      .groupBy(schema.products.sku, schema.products.name, schema.categories.name, sql`date_trunc('month', ${schema.orders.createdAt})`)
      .orderBy(asc(sql`date_trunc('month', ${schema.orders.createdAt})`), desc(sql`sum(${schema.orderItems.quantity})`))
      .limit(pageSize).offset(offset);
    return { report, filters: { ...filters, page }, data, summary: { count: data.length } };
  }

  if (report === "low-stock") {
    const data = await db.select({
      sku: schema.products.sku,
      product: schema.products.name,
      currentStock: schema.products.onHand,
      reorderPoint: schema.products.lowStockThreshold,
      avgDailySales: sql<string>`coalesce(sum(${schema.orderItems.quantity})::numeric / greatest(1, extract(day from (${range.end.toISOString()}::timestamptz - ${range.start.toISOString()}::timestamptz))), 0)`,
      suggestedReorderQty: sql<string>`greatest(0, (coalesce(sum(${schema.orderItems.quantity})::numeric / greatest(1, extract(day from (${range.end.toISOString()}::timestamptz - ${range.start.toISOString()}::timestamptz))), 0) * 14) - ${schema.products.onHand})`,
    }).from(schema.products)
      .leftJoin(schema.orderItems, eq(schema.orderItems.productId, schema.products.id))
      .leftJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(eq(schema.products.orgId, orgId), eq(schema.products.isActive, true)))
      .groupBy(schema.products.id)
      .having(sql`${schema.products.lowStockThreshold} is not null and ${schema.products.onHand} <= ${schema.products.lowStockThreshold}`)
      .orderBy(asc(schema.products.onHand)).limit(pageSize).offset(offset);
    return { report, filters: { ...filters, page }, data, summary: { alerts: data.length } };
  }

  const data: Record<string, unknown>[] = [];
  return { report, filters: { ...filters, page }, data, summary: { message: "Report scaffolded. Map this report to organization-specific tables as needed." } };
}
