import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { resolveReportDateRange, type DateRange } from "./date-ranges";

export function resolveDateRange(params: { preset?: string; start?: string; end?: string }): DateRange {
  return resolveReportDateRange(params);
}

export async function getReportSnapshot(orgId: string, dateRange: DateRange) {
  const dateFilter = and(
    eq(schema.orders.orgId, orgId),
    gte(schema.orders.createdAt, dateRange.start),
    lte(schema.orders.createdAt, dateRange.end),
  );

  const [summaryRow] = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)`,
      amountPaid: sql<string>`coalesce(sum(${schema.orders.amountPaid}), 0)`,
      avgOrder: sql<string>`coalesce(avg(${schema.orders.total}), 0)`,
      uniqueCustomers: sql<number>`count(distinct ${schema.orders.customerId})::int`,
    })
    .from(schema.orders)
    .where(dateFilter);

  const salesByCustomer = await db
    .select({
      customerId: schema.orders.customerId,
      customerName: sql<string>`coalesce(${schema.customers.name}, 'Unknown customer')`,
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)`,
    })
    .from(schema.orders)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
    .where(dateFilter)
    .groupBy(schema.orders.customerId, schema.customers.name)
    .orderBy(desc(sql`sum(${schema.orders.total})`))
    .limit(10);

  const topProducts = await db
    .select({
      productId: schema.orderItems.productId,
      productName: sql<string>`coalesce(${schema.orderItems.name}, 'Unknown product')`,
      qtySold: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${schema.orderItems.lineTotal}), 0)`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(dateFilter)
    .groupBy(schema.orderItems.productId, schema.orderItems.name)
    .orderBy(desc(sql`sum(${schema.orderItems.lineTotal})`))
    .limit(10);

  const salesByCity = await db
    .select({
      city: sql<string>`coalesce(${schema.customers.shippingAddress}->>'city', ${schema.customers.billingAddress}->>'city', 'Unspecified')`,
      orderCount: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)`,
    })
    .from(schema.orders)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
    .where(dateFilter)
    .groupBy(sql`coalesce(${schema.customers.shippingAddress}->>'city', ${schema.customers.billingAddress}->>'city', 'Unspecified')`)
    .orderBy(desc(sql`sum(${schema.orders.total})`))
    .limit(10);

  const inventory = await db
    .select({
      activeSkus: sql<number>`count(*)::int`,
      inventoryValue: sql<string>`coalesce(sum(${schema.products.onHand} * coalesce(${schema.products.cost}, 0)), 0)`,
      lowStockCount: sql<number>`coalesce(sum(case when ${schema.products.lowStockThreshold} is not null and ${schema.products.onHand} <= ${schema.products.lowStockThreshold} then 1 else 0 end), 0)::int`,
    })
    .from(schema.products)
    .where(and(eq(schema.products.orgId, orgId), eq(schema.products.isActive, true)));

  return {
    summary: summaryRow,
    salesByCustomer,
    topProducts,
    salesByCity,
    inventory: inventory[0],
  };
}
