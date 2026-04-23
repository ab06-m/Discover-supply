import { db, schema } from "@/lib/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export async function listDispatches(
  orgId: string,
  opts: { status?: string; driverId?: string } = {},
) {
  const conditions = [eq(schema.dispatches.orgId, orgId)];
  if (opts.status) conditions.push(eq(schema.dispatches.status, opts.status as any));
  if (opts.driverId) conditions.push(eq(schema.dispatches.driverId, opts.driverId));

  return db
    .select({
      id: schema.dispatches.id,
      status: schema.dispatches.status,
      scheduledAt: schema.dispatches.scheduledAt,
      deliveredAt: schema.dispatches.deliveredAt,
      routeSequence: schema.dispatches.routeSequence,
      driverId: schema.dispatches.driverId,
      orderId: schema.dispatches.orderId,
      orderNumber: schema.orders.number,
      total: schema.orders.total,
      customerName: schema.customers.name,
      storeCode: schema.customers.storeCode,
      deliveryAddress: schema.dispatches.deliveryAddress,
    })
    .from(schema.dispatches)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.dispatches.orderId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
    .where(and(...conditions))
    .orderBy(
      asc(schema.dispatches.scheduledAt),
      asc(schema.dispatches.routeSequence),
      desc(schema.dispatches.createdAt),
    );
}

export async function getDispatch(orgId: string, id: string) {
  const rows = await db
    .select({
      dispatch: schema.dispatches,
      order: schema.orders,
      customer: schema.customers,
    })
    .from(schema.dispatches)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.dispatches.orderId))
    .leftJoin(schema.customers, eq(schema.customers.id, schema.orders.customerId))
    .where(and(eq(schema.dispatches.orgId, orgId), eq(schema.dispatches.id, id)))
    .limit(1);
  if (!rows.length) return null;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, rows[0].order.id));
  return { ...rows[0], items };
}

export async function listMyRoute(orgId: string, driverId: string) {
  return listDispatches(orgId, { driverId });
}

export async function listDrivers(orgId: string) {
  // Drivers = memberships with role='driver'.
  const members = await db
    .select({
      userId: schema.memberships.userId,
      fullName: schema.profiles.fullName,
      email: schema.profiles.email,
    })
    .from(schema.memberships)
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.memberships.userId))
    .where(
      and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.role, ["driver"])),
    );
  return members;
}
