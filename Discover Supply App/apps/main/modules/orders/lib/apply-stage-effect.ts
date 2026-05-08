/**
 * When an order moves from one stage to another, this function runs the side effect
 * of the TARGET stage on inventory and payments. It writes stock_movement rows and
 * updates product counters in one transaction so inventory stays consistent.
 *
 * Effect semantics:
 *   commit   → reserve stock (+committed) per line item
 *   release  → free prior reservation (-committed) per line item (idempotent-safe via history)
 *   consume  → ship stock (-on_hand AND -committed) per line item
 *   mark_paid → set amountPaid = total (still allows partial payments before)
 *   none     → no-op
 *
 * Callers must check permissions BEFORE invoking.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { StageEffect } from "../schema";

type DbExecutor = Pick<typeof db, "select" | "update" | "insert">;

export async function applyStageEffect({
  orgId,
  orderId,
  effect,
  userId,
  executor = db,
}: {
  orgId: string;
  orderId: string;
  effect: StageEffect;
  userId: string | null;
  executor?: DbExecutor;
}) {
  if (effect === "none") return;

  if (effect === "mark_paid") {
    await executor
      .update(schema.orders)
      .set({ amountPaid: sql`${schema.orders.total}`, updatedAt: new Date() })
      .where(and(eq(schema.orders.orgId, orgId), eq(schema.orders.id, orderId)));
    return;
  }

  const items = await executor
    .select({
      productId: schema.orderItems.productId,
      quantity: sql<number>`sum(${schema.orderItems.quantity})::int`,
    })
    .from(schema.orderItems)
    .where(and(eq(schema.orderItems.orgId, orgId), eq(schema.orderItems.orderId, orderId)))
    .groupBy(schema.orderItems.productId);

  const productIds = items
    .map((item) => item.productId)
    .filter((productId): productId is string => Boolean(productId));
  if (!productIds.length) return;

  const movementRows = await executor
    .select({
      productId: schema.stockMovements.productId,
      onHandDelta: sql<number>`coalesce(sum(${schema.stockMovements.onHandDelta}), 0)::int`,
      committedDelta: sql<number>`coalesce(sum(${schema.stockMovements.committedDelta}), 0)::int`,
    })
    .from(schema.stockMovements)
    .where(
      and(
        eq(schema.stockMovements.orgId, orgId),
        eq(schema.stockMovements.referenceType, "order"),
        eq(schema.stockMovements.referenceId, orderId),
        inArray(schema.stockMovements.productId, productIds),
      ),
    )
    .groupBy(schema.stockMovements.productId);

  const movementByProductId = new Map(
    movementRows.map((row) => [row.productId, row]),
  );

  for (const item of items) {
    if (!item.productId) continue;

    const qty = Number(item.quantity);
    const current = movementByProductId.get(item.productId);
    const currentOnHandDelta = Number(current?.onHandDelta ?? 0);
    const currentCommittedDelta = Number(current?.committedDelta ?? 0);

    let desiredOnHandDelta = 0;
    let desiredCommittedDelta = 0;
    if (effect === "commit") {
      desiredCommittedDelta = qty;
    } else if (effect === "consume") {
      desiredOnHandDelta = -qty;
    }

    const onHandDelta = desiredOnHandDelta - currentOnHandDelta;
    const committedDelta = desiredCommittedDelta - currentCommittedDelta;
    if (onHandDelta === 0 && committedDelta === 0) continue;

    const updateCondition =
      onHandDelta < 0
        ? and(
            eq(schema.products.orgId, orgId),
            eq(schema.products.id, item.productId),
            sql`${schema.products.onHand} + ${onHandDelta} >= 0`,
          )
        : and(eq(schema.products.orgId, orgId), eq(schema.products.id, item.productId));

    const [updated] = await executor
      .update(schema.products)
      .set({
        onHand: sql`${schema.products.onHand} + ${onHandDelta}`,
        committed: sql`greatest(0, ${schema.products.committed} + ${committedDelta})`,
        updatedAt: new Date(),
      })
      .where(updateCondition)
      .returning({ id: schema.products.id });

    if (!updated) {
      throw new Error("Insufficient stock available for this stage change.");
    }

    await executor.insert(schema.stockMovements).values({
        orgId,
        productId: item.productId,
        kind: effect,
        onHandDelta,
        committedDelta,
        referenceType: "order",
        referenceId: orderId,
        createdBy: userId,
      });
  }
}
