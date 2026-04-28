import { db, schema } from "@/lib/db";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

const DEFAULT_LIST_LIMIT = 100;

export async function listCustomers(
  orgId: string,
  opts: { search?: string; includeInactive?: boolean; limit?: number } = {},
) {
  const { search, includeInactive = false, limit = DEFAULT_LIST_LIMIT } = opts;

  const conditions = [eq(schema.customers.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(schema.customers.isActive, true));
  if (search) {
    const w = or(
      ilike(schema.customers.name, `%${search}%`),
      ilike(schema.customers.storeCode, `%${search}%`),
      ilike(schema.customers.email, `%${search}%`),
    );
    if (w) conditions.push(w);
  }

  const openOrders = db
    .select({
      customerId: schema.orders.customerId,
      total: count(),
    })
    .from(schema.orders)
    .innerJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(and(eq(schema.orders.orgId, orgId), eq(schema.orderStages.isTerminal, false)))
    .groupBy(schema.orders.customerId)
    .as("open_orders");

  return db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      storeCode: schema.customers.storeCode,
      email: schema.customers.email,
      phone: schema.customers.phone,
      paymentTerms: schema.customers.paymentTerms,
      isActive: schema.customers.isActive,
      openOrders: sql<number>`coalesce(${openOrders.total}, 0)::int`,
    })
    .from(schema.customers)
    .leftJoin(openOrders, eq(openOrders.customerId, schema.customers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.customers.createdAt))
    .limit(limit);
}

export async function listCustomerSummaries(
  orgId: string,
  opts: { includeInactive?: boolean; limit?: number } = {},
) {
  const { includeInactive = false, limit = 250 } = opts;
  const conditions = [eq(schema.customers.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(schema.customers.isActive, true));

  return db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      storeCode: schema.customers.storeCode,
      email: schema.customers.email,
      phone: schema.customers.phone,
      paymentTerms: schema.customers.paymentTerms,
      isActive: schema.customers.isActive,
    })
    .from(schema.customers)
    .where(and(...conditions))
    .orderBy(desc(schema.customers.createdAt))
    .limit(limit);
}

export async function getCustomer(orgId: string, id: string) {
  const rows = await db
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.orgId, orgId), eq(schema.customers.id, id)))
    .limit(1);
  return rows[0] ?? null;
}
