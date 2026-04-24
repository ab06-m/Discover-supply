import { db, schema } from "@/lib/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export async function listCustomers(
  orgId: string,
  opts: { search?: string; includeInactive?: boolean } = {},
) {
  const { search, includeInactive = false } = opts;

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

  return db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
      storeCode: schema.customers.storeCode,
      email: schema.customers.email,
      phone: schema.customers.phone,
      paymentTerms: schema.customers.paymentTerms,
      isActive: schema.customers.isActive,
      openOrders: sql<number>`(
        select count(*)::int from ${schema.orders}
        where ${schema.orders.customerId} = ${schema.customers.id}
          and ${schema.orders.stageId} in (
            select id from ${schema.orderStages}
            where ${schema.orderStages.orgId} = ${orgId}
              and ${schema.orderStages.isTerminal} = false
          )
      )`,
    })
    .from(schema.customers)
    .where(and(...conditions))
    .orderBy(desc(schema.customers.createdAt));
}

export async function getCustomer(orgId: string, id: string) {
  const rows = await db
    .select()
    .from(schema.customers)
    .where(and(eq(schema.customers.orgId, orgId), eq(schema.customers.id, id)))
    .limit(1);
  return rows[0] ?? null;
}
