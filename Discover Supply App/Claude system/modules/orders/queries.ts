import { db, schema } from "@/lib/db";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

export async function listOrders(
  orgId: string,
  opts: { search?: string; stageId?: string; customerId?: string } = {},
) {
  const { search, stageId, customerId } = opts;

  const conditions = [eq(schema.orders.orgId, orgId)];
  if (stageId) conditions.push(eq(schema.orders.stageId, stageId));
  if (customerId) conditions.push(eq(schema.orders.customerId, customerId));
  if (search) {
    const w = or(
      ilike(schema.orders.number, `%${search}%`),
      ilike(schema.customers.name, `%${search}%`),
    );
    if (w) conditions.push(w);
  }

  return db
    .select({
      id: schema.orders.id,
      number: schema.orders.number,
      total: schema.orders.total,
      amountPaid: schema.orders.amountPaid,
      createdAt: schema.orders.createdAt,
      source: schema.orders.source,
      stageId: schema.orders.stageId,
      stageName: schema.orderStages.name,
      stageColor: schema.orderStages.color,
      stageEffect: schema.orderStages.effect,
      customerId: schema.orders.customerId,
      customerName: schema.customers.name,
      storeCode: schema.customers.storeCode,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
    .where(and(...conditions))
    .orderBy(desc(schema.orders.createdAt));
}

export async function getOrder(orgId: string, id: string) {
  const rows = await db
    .select({
      order: schema.orders,
      stage: schema.orderStages,
      customer: schema.customers,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
    .where(and(eq(schema.orders.orgId, orgId), eq(schema.orders.id, id)))
    .limit(1);
  if (!rows.length) return null;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, id))
    .orderBy(asc(schema.orderItems.id));

  const history = await db
    .select({
      id: schema.orderStageHistory.id,
      createdAt: schema.orderStageHistory.createdAt,
      note: schema.orderStageHistory.note,
      fromStageId: schema.orderStageHistory.fromStageId,
      toStageId: schema.orderStageHistory.toStageId,
    })
    .from(schema.orderStageHistory)
    .where(eq(schema.orderStageHistory.orderId, id))
    .orderBy(desc(schema.orderStageHistory.createdAt));

  return { ...rows[0], items, history };
}

export async function listStages(orgId: string) {
  return db
    .select()
    .from(schema.orderStages)
    .where(eq(schema.orderStages.orgId, orgId))
    .orderBy(asc(schema.orderStages.sortOrder));
}

export async function getInitialStage(orgId: string) {
  const rows = await db
    .select()
    .from(schema.orderStages)
    .where(and(eq(schema.orderStages.orgId, orgId), eq(schema.orderStages.isInitial, true)))
    .orderBy(asc(schema.orderStages.sortOrder))
    .limit(1);
  if (rows.length) return rows[0];
  const fallback = await db
    .select()
    .from(schema.orderStages)
    .where(eq(schema.orderStages.orgId, orgId))
    .orderBy(asc(schema.orderStages.sortOrder))
    .limit(1);
  return fallback[0] ?? null;
}

export async function searchProductsForOrder(orgId: string, query: string, limit = 10) {
  if (!query || query.length < 2) return [];
  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      barcode: schema.products.barcode,
      price: schema.products.price,
      onHand: schema.products.onHand,
      committed: schema.products.committed,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.orgId, orgId),
        eq(schema.products.isActive, true),
        or(
          ilike(schema.products.name, `%${query}%`),
          ilike(schema.products.sku, `%${query}%`),
          ilike(schema.products.barcode, `%${query}%`),
        )!,
      ),
    )
    .limit(limit);
}
