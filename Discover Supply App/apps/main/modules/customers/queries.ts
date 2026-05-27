import { db, schema } from "@/lib/db";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { normalizePhoneDigits } from "@/modules/customers/lib/phone-normalization";

const DEFAULT_LIST_LIMIT = 100;

export type CustomerListSort = "latest" | "name";

export async function listCustomers(
  orgId: string,
  opts: {
    search?: string;
    includeInactive?: boolean;
    limit?: number;
    sort?: CustomerListSort;
  } = {},
) {
  const { search, includeInactive = false, limit = DEFAULT_LIST_LIMIT, sort = "latest" } = opts;
  const searchPhoneDigits = normalizePhoneDigits(search);

  const conditions = [eq(schema.customers.orgId, orgId)];
  if (!includeInactive) conditions.push(eq(schema.customers.isActive, true));
  if (search) {
    const w = or(
      ilike(schema.customers.name, `%${search}%`),
      ilike(schema.customers.storeCode, `%${search}%`),
      ilike(schema.customers.email, `%${search}%`),
      ilike(schema.customers.phone, `%${search}%`),
      searchPhoneDigits
        ? sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') like ${`%${searchPhoneDigits}%`}`
        : undefined,
    );
    if (w) conditions.push(w);
  }

  const openOrders = db
    .select({
      customerId: schema.orders.customerId,
      total: count().as("total"),
    })
    .from(schema.orders)
    .innerJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(and(eq(schema.orders.orgId, orgId), eq(schema.orderStages.isTerminal, false)))
    .groupBy(schema.orders.customerId)
    .as("open_orders");

  const orderStats = db
    .select({
      customerId: schema.orders.customerId,
      totalOrders: count().as("total_orders"),
      totalSpent: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`.as("total_spent"),
      lastOrderAt: sql<Date | null>`max(${schema.orders.createdAt})`.as("last_order_at"),
    })
    .from(schema.orders)
    .where(eq(schema.orders.orgId, orgId))
    .groupBy(schema.orders.customerId)
    .as("order_stats");

  const accountBalances = db
    .select({
      customerId: schema.invoices.customerId,
      balance: sql<string>`coalesce(sum(${schema.invoices.total} - ${schema.invoices.amountPaid}), 0)::text`.as(
        "balance",
      ),
    })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.orgId, orgId),
        sql`${schema.invoices.status} not in ('paid', 'void', 'draft')`,
      ),
    )
    .groupBy(schema.invoices.customerId)
    .as("account_balances");

  return db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      storeCode: schema.customers.storeCode,
      email: schema.customers.email,
      phone: schema.customers.phone,
      billingAddress: schema.customers.billingAddress,
      shippingAddress: schema.customers.shippingAddress,
      taxId: schema.customers.taxId,
      paymentTerms: schema.customers.paymentTerms,
      notes: schema.customers.notes,
      isActive: schema.customers.isActive,
      openOrders: sql<number>`coalesce(${openOrders.total}, 0)::int`,
      totalOrders: sql<number>`coalesce(${orderStats.totalOrders}, 0)::int`,
      totalSpent: sql<string>`coalesce(${orderStats.totalSpent}, '0')`,
      lastOrderAt: orderStats.lastOrderAt,
      accountBalance: sql<string>`coalesce(${accountBalances.balance}, '0')`,
    })
    .from(schema.customers)
    .leftJoin(openOrders, eq(openOrders.customerId, schema.customers.id))
    .leftJoin(orderStats, eq(orderStats.customerId, schema.customers.id))
    .leftJoin(accountBalances, eq(accountBalances.customerId, schema.customers.id))
    .where(and(...conditions))
    .orderBy(sort === "name" ? asc(schema.customers.name) : desc(schema.customers.createdAt))
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
