import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getReportDefinition, reportIds } from "./catalog";

export type ReportFilters = {
  start?: string;
  end?: string;
  sku?: string;
  categoryId?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
  inactivityDays?: number;
  sort?: string;
  direction?: "asc" | "desc";
};

export type ReportResult = {
  report: string;
  filters: ReportFilters;
  data: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
};

function parseDateRange(filters: ReportFilters) {
  const end = filters.end ? new Date(`${filters.end}T23:59:59.999Z`) : new Date();
  const start = filters.start
    ? new Date(`${filters.start}T00:00:00.000Z`)
    : new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  return { start, end };
}

function paginate(filters: ReportFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function normalizeDirection(filters: ReportFilters): "asc" | "desc" {
  return filters.direction === "asc" ? "asc" : "desc";
}

function sortBy(filters: ReportFilters, sortSql: Record<string, SQL>, fallback: string) {
  const key = filters.sort && sortSql[filters.sort] ? filters.sort : fallback;
  const expression = sortSql[key] ?? sortSql[fallback];
  return normalizeDirection(filters) === "asc" ? asc(expression) : desc(expression);
}

function productFilters(orgId: string, filters: ReportFilters) {
  const conditions: SQL[] = [eq(schema.products.orgId, orgId)];
  if (filters.sku) {
    conditions.push(
      sql`(${schema.products.sku} ilike ${`%${filters.sku}%`} or ${schema.products.name} ilike ${`%${filters.sku}%`})`,
    );
  }
  if (filters.categoryId) conditions.push(eq(schema.products.categoryId, filters.categoryId));
  return conditions;
}

function orderDateFilters(orgId: string, range: { start: Date; end: Date }, filters: ReportFilters) {
  const conditions: SQL[] = [
    eq(schema.orders.orgId, orgId),
    gte(schema.orders.createdAt, range.start),
    lte(schema.orders.createdAt, range.end),
  ];
  if (filters.customerId) conditions.push(eq(schema.orders.customerId, filters.customerId));
  return conditions;
}

function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => esc(row[header])).join(","))].join("\n");
}

export async function runReport(
  orgId: string,
  report: string,
  filters: ReportFilters,
  format: "json" | "csv" = "json",
) {
  const out = await getReportResult(orgId, report, filters);
  if (format === "csv") {
    return { contentType: "text/csv", body: csv(out.data) };
  }
  return { contentType: "application/json", body: JSON.stringify(out) };
}

export async function getReportResult(orgId: string, report: string, filters: ReportFilters): Promise<ReportResult> {
  if (!reportIds.includes(report)) {
    return { report, filters, data: [], summary: { error: "Unsupported report" } };
  }

  const definition = getReportDefinition(report);
  const range = parseDateRange(filters);
  const { pageSize, offset, page } = paginate(filters);
  const normalizedFilters: ReportFilters = {
    ...filters,
    page,
    pageSize,
    sort: filters.sort ?? definition.defaultSort,
    direction: normalizeDirection(filters),
  };

  if (report === "inventory-turnover") {
    const unitsSold = sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`;
    const cogs = sql<string>`coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost}, 0)), 0)::text`;
    const avgInventory = sql<string>`coalesce(avg(${schema.products.onHand}), 0)::text`;
    const turnoverRatio = sql<string>`case when coalesce(avg(${schema.products.onHand} * coalesce(${schema.products.cost}, 0)), 0) = 0 then '0' else (coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost}, 0)), 0) / avg(${schema.products.onHand} * coalesce(${schema.products.cost}, 0)))::text end`;
    const month = sql<string>`to_char(date_trunc('month', ${schema.orders.createdAt}), 'YYYY-MM')`;
    const conditions = [...orderDateFilters(orgId, range, filters), ...productFilters(orgId, filters).slice(1)];
    const sortSql = {
      month: sql`date_trunc('month', ${schema.orders.createdAt})`,
      unitsSold: sql`sum(${schema.orderItems.quantity})`,
      turnoverRatio,
      product: sql`${schema.products.name}`,
    };
    const data = await db
      .select({
        sku: schema.products.sku,
        product: schema.products.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        month,
        unitsSold,
        cogs,
        avgInventory,
        turnoverRatio,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .innerJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(...conditions))
      .groupBy(schema.products.sku, schema.products.name, schema.categories.name, sql`date_trunc('month', ${schema.orders.createdAt})`)
      .orderBy(sortBy(normalizedFilters, sortSql, "month"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "inventory-aging") {
    const lastMovementAt = sql<Date | null>`max(${schema.stockMovements.createdAt})`;
    const daysIdle = sql<number>`floor(extract(epoch from (now() - coalesce(max(${schema.stockMovements.createdAt}), ${schema.products.createdAt}))) / 86400)::int`;
    const inventoryValue = sql<string>`(${schema.products.onHand} * coalesce(${schema.products.cost}, 0))::text`;
    const minimumDaysIdle = sql`floor(extract(epoch from (now() - coalesce(max(${schema.stockMovements.createdAt}), ${schema.products.createdAt}))) / 86400)::int >= ${filters.inactivityDays ?? 0}`;
    const sortSql = {
      daysIdle,
      inventoryValue: sql`${schema.products.onHand} * coalesce(${schema.products.cost}, 0)`,
      onHand: sql`${schema.products.onHand}`,
      product: sql`${schema.products.name}`,
    };
    const data = await db
      .select({
        sku: schema.products.sku,
        product: schema.products.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        onHand: schema.products.onHand,
        committed: schema.products.committed,
        availableStock: sql<number>`(${schema.products.onHand} - ${schema.products.committed})::int`,
        inventoryValue,
        lastMovementAt,
        daysIdle,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .leftJoin(schema.stockMovements, eq(schema.stockMovements.productId, schema.products.id))
      .where(and(...productFilters(orgId, filters), eq(schema.products.isActive, true)))
      .groupBy(schema.products.id, schema.categories.name)
      .having(minimumDaysIdle)
      .orderBy(sortBy(normalizedFilters, sortSql, "daysIdle"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "stock-movement") {
    const conditions = [
      eq(schema.stockMovements.orgId, orgId),
      gte(schema.stockMovements.createdAt, range.start),
      lte(schema.stockMovements.createdAt, range.end),
      ...productFilters(orgId, filters).slice(1),
    ];
    const sortSql = {
      createdAt: sql`${schema.stockMovements.createdAt}`,
      product: sql`${schema.products.name}`,
      kind: sql`${schema.stockMovements.kind}`,
      onHandDelta: sql`${schema.stockMovements.onHandDelta}`,
    };
    const data = await db
      .select({
        createdAt: schema.stockMovements.createdAt,
        sku: schema.products.sku,
        product: schema.products.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        kind: schema.stockMovements.kind,
        onHandDelta: schema.stockMovements.onHandDelta,
        committedDelta: schema.stockMovements.committedDelta,
        referenceType: schema.stockMovements.referenceType,
        note: schema.stockMovements.note,
      })
      .from(schema.stockMovements)
      .innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(...conditions))
      .orderBy(sortBy(normalizedFilters, sortSql, "createdAt"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "low-stock") {
    const salesQty = sql<number>`coalesce(sum(case when ${schema.orders.id} is not null then ${schema.orderItems.quantity} else 0 end), 0)::int`;
    const dayCount = sql<number>`greatest(1, extract(day from (${range.end.toISOString()}::timestamptz - ${range.start.toISOString()}::timestamptz)))`;
    const avgDailySales = sql<string>`(${salesQty}::numeric / ${dayCount})::text`;
    const suggestedReorderQty = sql<string>`greatest(0, ((${salesQty}::numeric / ${dayCount}) * 14) - ${schema.products.onHand})::text`;
    const conditions = [
      ...productFilters(orgId, filters),
      eq(schema.products.isActive, true),
      sql`${schema.products.lowStockThreshold} is not null`,
      sql`${schema.products.onHand} <= ${schema.products.lowStockThreshold}`,
    ];
    const sortSql = {
      currentStock: sql`${schema.products.onHand}`,
      reorderPoint: sql`${schema.products.lowStockThreshold}`,
      avgDailySales,
      product: sql`${schema.products.name}`,
    };
    const data = await db
      .select({
        sku: schema.products.sku,
        product: schema.products.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        currentStock: schema.products.onHand,
        reorderPoint: schema.products.lowStockThreshold,
        avgDailySales,
        suggestedReorderQty,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .leftJoin(schema.orderItems, eq(schema.orderItems.productId, schema.products.id))
      .leftJoin(
        schema.orders,
        and(eq(schema.orders.id, schema.orderItems.orderId), gte(schema.orders.createdAt, range.start), lte(schema.orders.createdAt, range.end)),
      )
      .where(and(...conditions))
      .groupBy(schema.products.id, schema.categories.name)
      .orderBy(sortBy(normalizedFilters, sortSql, "currentStock"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { alerts: data.length } };
  }

  if (report === "total-sales") {
    const conditions = orderDateFilters(orgId, range, filters);
    const balanceDue = sql<string>`greatest(${schema.orders.total} - ${schema.orders.amountPaid}, 0)::text`;
    const paymentStatus = sql<string>`case
      when ${schema.orders.amountPaid} >= ${schema.orders.total} then 'Paid'
      when ${schema.orders.amountPaid} > 0 then 'Partially paid'
      else 'Unpaid'
    end`;
    const customer = sql<string>`coalesce(${schema.customers.name}, 'Unknown customer')`;
    const stage = sql<string>`coalesce(${schema.orderStages.name}, 'Unstaged')`;
    const sortSql = {
      date: sql`${schema.orders.createdAt}`,
      customer,
      orderTotal: sql`${schema.orders.total}`,
      amountPaid: sql`${schema.orders.amountPaid}`,
      balanceDue: sql`greatest(${schema.orders.total} - ${schema.orders.amountPaid}, 0)`,
      orderNumber: sql`${schema.orders.number}`,
    };
    const data = await db
      .select({
        date: schema.orders.createdAt,
        orderNumber: schema.orders.number,
        customer,
        storeCode: schema.customers.storeCode,
        orderTotal: sql<string>`${schema.orders.total}::text`,
        amountPaid: sql<string>`${schema.orders.amountPaid}::text`,
        balanceDue,
        paymentStatus,
        stage,
      })
      .from(schema.orders)
      .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
      .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
      .where(and(...conditions))
      .orderBy(sortBy(normalizedFilters, sortSql, "date"))
      .limit(pageSize)
      .offset(offset);

    const [orderSummary] = await db
      .select({
        orderCount: sql<number>`count(*)::int`,
        totalSales: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
        totalPaid: sql<string>`coalesce(sum(${schema.orders.amountPaid}), 0)::text`,
        totalOutstanding: sql<string>`coalesce(sum(greatest(${schema.orders.total} - ${schema.orders.amountPaid}, 0)), 0)::text`,
      })
      .from(schema.orders)
      .where(and(...conditions));

    const [itemSummary] = await db
      .select({
        totalItems: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(...conditions));

    const summary = {
      ...(orderSummary ?? { orderCount: 0, totalSales: "0", totalPaid: "0", totalOutstanding: "0" }),
      totalItems: itemSummary?.totalItems ?? 0,
    };

    return { report, filters: normalizedFilters, data, summary };
  }

  if (report === "top-selling-products" || report === "gross-margin-by-product") {
    const unitsSold = sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`;
    const orderCount = sql<number>`count(distinct ${schema.orders.id})::int`;
    const revenue = sql<string>`coalesce(sum(${schema.orderItems.lineTotal}), 0)::text`;
    const cogs = sql<string>`coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost}, 0)), 0)::text`;
    const grossProfit = sql<string>`(coalesce(sum(${schema.orderItems.lineTotal}), 0) - coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost}, 0)), 0))::text`;
    const grossMarginPct = sql<string>`case when coalesce(sum(${schema.orderItems.lineTotal}), 0) = 0 then '0' else ((coalesce(sum(${schema.orderItems.lineTotal}), 0) - coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost}, 0)), 0)) / coalesce(sum(${schema.orderItems.lineTotal}), 0))::text end`;
    const avgPrice = sql<string>`coalesce(avg(${schema.orderItems.unitPrice}), 0)::text`;
    const conditions = [...orderDateFilters(orgId, range, filters), ...productFilters(orgId, filters).slice(1)];
    const sortSql = {
      revenue: sql`sum(${schema.orderItems.lineTotal})`,
      unitsSold: sql`sum(${schema.orderItems.quantity})`,
      orderCount: sql`count(distinct ${schema.orders.id})`,
      lastSoldAt: sql`max(${schema.orders.createdAt})`,
      grossProfit: sql`coalesce(sum(${schema.orderItems.lineTotal}), 0) - coalesce(sum(${schema.orderItems.quantity} * coalesce(${schema.products.cost}, 0)), 0)`,
      grossMarginPct,
    };
    const data = await db
      .select({
        sku: schema.orderItems.sku,
        product: schema.orderItems.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        unitsSold,
        ...(report === "top-selling-products"
          ? { orderCount, revenue, avgPrice, lastSoldAt: sql<Date>`max(${schema.orders.createdAt})` }
          : { revenue, cogs, grossProfit, grossMarginPct }),
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(...conditions))
      .groupBy(schema.orderItems.sku, schema.orderItems.name, schema.categories.name)
      .orderBy(sortBy(normalizedFilters, sortSql, report === "top-selling-products" ? "revenue" : "grossProfit"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "slow-dead-inventory") {
    const days = filters.inactivityDays ?? 60;
    const lastSoldAt = sql<Date | null>`max(${schema.stockMovements.createdAt})`;
    const daysSinceLastSale = sql<number>`floor(extract(epoch from (now() - coalesce(max(${schema.stockMovements.createdAt}), ${schema.products.createdAt}))) / 86400)::int`;
    const inventoryValue = sql<string>`(${schema.products.onHand} * coalesce(${schema.products.cost}, 0))::text`;
    const sortSql = {
      daysSinceLastSale,
      inventoryValue: sql`${schema.products.onHand} * coalesce(${schema.products.cost}, 0)`,
      onHand: sql`${schema.products.onHand}`,
      product: sql`${schema.products.name}`,
    };
    const data = await db
      .select({
        sku: schema.products.sku,
        product: schema.products.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        onHand: schema.products.onHand,
        inventoryValue,
        lastSoldAt,
        daysSinceLastSale,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .leftJoin(schema.stockMovements, and(eq(schema.stockMovements.productId, schema.products.id), eq(schema.stockMovements.kind, "consume")))
      .where(and(...productFilters(orgId, filters), eq(schema.products.isActive, true), sql`${schema.products.onHand} > 0`))
      .groupBy(schema.products.id, schema.categories.name)
      .having(sql`coalesce(max(${schema.stockMovements.createdAt}), ${schema.products.createdAt}) <= now() - (${days} || ' days')::interval`)
      .orderBy(sortBy(normalizedFilters, sortSql, "daysSinceLastSale"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length, inactivityDays: days } };
  }

  if (report === "customer-purchase-behavior") {
    const city = sql<string>`coalesce(${schema.customers.shippingAddress}->>'city', ${schema.customers.billingAddress}->>'city', 'Unspecified')`;
    const conditions = orderDateFilters(orgId, range, filters);
    const sortSql = {
      revenue: sql`sum(${schema.orders.total})`,
      orderCount: sql`count(*)`,
      avgOrder: sql`avg(${schema.orders.total})`,
      lastOrderAt: sql`max(${schema.orders.createdAt})`,
    };
    const data = await db
      .select({
        customer: sql<string>`coalesce(${schema.customers.name}, 'Unknown customer')`,
        storeCode: schema.customers.storeCode,
        city,
        orderCount: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
        avgOrder: sql<string>`coalesce(avg(${schema.orders.total}), 0)::text`,
        lastOrderAt: sql<Date>`max(${schema.orders.createdAt})`,
      })
      .from(schema.orders)
      .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
      .where(and(...conditions))
      .groupBy(schema.customers.name, schema.customers.storeCode, city)
      .orderBy(sortBy(normalizedFilters, sortSql, "revenue"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "sales-by-category") {
    const category = sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`;
    const conditions = [...orderDateFilters(orgId, range, filters), ...productFilters(orgId, filters).slice(1)];
    const sortSql = {
      revenue: sql`sum(${schema.orderItems.lineTotal})`,
      unitsSold: sql`sum(${schema.orderItems.quantity})`,
      orderCount: sql`count(distinct ${schema.orders.id})`,
      category,
    };
    const data = await db
      .select({
        category,
        unitsSold: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
        orderCount: sql<number>`count(distinct ${schema.orders.id})::int`,
        revenue: sql<string>`coalesce(sum(${schema.orderItems.lineTotal}), 0)::text`,
        avgLineValue: sql<string>`coalesce(avg(${schema.orderItems.lineTotal}), 0)::text`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(...conditions))
      .groupBy(category)
      .orderBy(sortBy(normalizedFilters, sortSql, "revenue"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "inventory-valuation") {
    const inventoryValue = sql<string>`(${schema.products.onHand} * coalesce(${schema.products.cost}, 0))::text`;
    const retailValue = sql<string>`(${schema.products.onHand} * coalesce(${schema.products.price}, 0))::text`;
    const sortSql = {
      inventoryValue: sql`${schema.products.onHand} * coalesce(${schema.products.cost}, 0)`,
      retailValue: sql`${schema.products.onHand} * coalesce(${schema.products.price}, 0)`,
      onHand: sql`${schema.products.onHand}`,
      product: sql`${schema.products.name}`,
    };
    const data = await db
      .select({
        sku: schema.products.sku,
        product: schema.products.name,
        category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
        onHand: schema.products.onHand,
        committed: schema.products.committed,
        availableStock: sql<number>`(${schema.products.onHand} - ${schema.products.committed})::int`,
        unitCost: schema.products.cost,
        unitPrice: schema.products.price,
        inventoryValue,
        retailValue,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(and(...productFilters(orgId, filters), eq(schema.products.isActive, true)))
      .orderBy(sortBy(normalizedFilters, sortSql, "inventoryValue"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  if (report === "customer-reorder-prediction") {
    const orderCount = sql<number>`count(${schema.orders.id})::int`;
    const revenue = sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`;
    const lastOrderAt = sql<Date | null>`max(${schema.orders.createdAt})`;
    const avgCycleDays = sql<string>`case when count(${schema.orders.id}) <= 1 then null else (extract(epoch from (max(${schema.orders.createdAt}) - min(${schema.orders.createdAt}))) / 86400 / greatest(1, count(${schema.orders.id}) - 1))::numeric(12,2)::text end`;
    const nextExpectedOrderAt = sql<Date | null>`case when count(${schema.orders.id}) <= 1 then null else max(${schema.orders.createdAt}) + ((extract(epoch from (max(${schema.orders.createdAt}) - min(${schema.orders.createdAt}))) / greatest(1, count(${schema.orders.id}) - 1)) || ' seconds')::interval end`;
    const daysUntilExpected = sql<number | null>`case when count(${schema.orders.id}) <= 1 then null else ceil(extract(epoch from ((max(${schema.orders.createdAt}) + ((extract(epoch from (max(${schema.orders.createdAt}) - min(${schema.orders.createdAt}))) / greatest(1, count(${schema.orders.id}) - 1)) || ' seconds')::interval) - now())) / 86400)::int end`;
    const conditions: SQL[] = [eq(schema.customers.orgId, orgId), eq(schema.customers.isActive, true)];
    if (filters.customerId) conditions.push(eq(schema.customers.id, filters.customerId));
    const sortSql = {
      daysUntilExpected,
      lastOrderAt,
      revenue: sql`sum(${schema.orders.total})`,
      orderCount: sql`count(${schema.orders.id})`,
    };
    const data = await db
      .select({
        customer: schema.customers.name,
        storeCode: schema.customers.storeCode,
        orderCount,
        revenue,
        lastOrderAt,
        avgCycleDays,
        nextExpectedOrderAt,
        daysUntilExpected,
      })
      .from(schema.customers)
      .leftJoin(
        schema.orders,
        and(eq(schema.orders.customerId, schema.customers.id), gte(schema.orders.createdAt, range.start), lte(schema.orders.createdAt, range.end)),
      )
      .where(and(...conditions))
      .groupBy(schema.customers.id)
      .having(sql`count(${schema.orders.id}) > 0`)
      .orderBy(sortBy(normalizedFilters, sortSql, "daysUntilExpected"))
      .limit(pageSize)
      .offset(offset);
    return { report, filters: normalizedFilters, data, summary: { count: data.length } };
  }

  return { report, filters: normalizedFilters, data: [], summary: { count: 0 } };
}
