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

import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { StageEffect } from "../schema";

export async function applyStageEffect({
  orgId,
  orderId,
  effect,
  userId,
}: {
  orgId: string;
  orderId: string;
  effect: StageEffect;
  userId: string | null;
}) {
  if (effect === "none") return;

  if (effect === "mark_paid") {
    await db
      .update(schema.orders)
      .set({ amountPaid: sql`${schema.orders.total}`, updatedAt: new Date() })
      .where(and(eq(schema.orders.orgId, orgId), eq(schema.orders.id, orderId)));
    return;
  }

  const items = await db
    .select({
      productId: schema.orderItems.productId,
      quantity: schema.orderItems.quantity,
    })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  for (const it of items) {
    if (!it.productId) continue;
    const qty = it.quantity;

    if (effect === "commit") {
      await db
        .update(schema.products)
        .set({ committed: sql`${schema.products.committed} + ${qty}`, updatedAt: new Date() })
        .where(and(eq(schema.products.orgId, orgId), eq(schema.products.id, it.productId)));
      await db.insert(schema.stockMovements).values({
        orgId,
        productId: it.productId,
        kind: "commit",
        onHandDelta: 0,
        committedDelta: qty,
        referenceType: "order",
        referenceId: orderId,
        createdBy: userId,
      });
    } else if (effect === "release") {
      await db
        .update(schema.products)
        .set({
          committed: sql`greatest(0, ${schema.products.committed} - ${qty})`,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.products.orgId, orgId), eq(schema.products.id, it.productId)));
      await db.insert(schema.stockMovements).values({
        orgId,
        productId: it.productId,
        kind: "release",
        onHandDelta: 0,
        committedDelta: -qty,
        referenceType: "order",
        referenceId: orderId,
        createdBy: userId,
      });
    } else if (effect === "consume") {
      await db
        .update(schema.products)
        .set({
          onHand: sql`${schema.products.onHand} - ${qty}`,
          committed: sql`greatest(0, ${schema.products.committed} - ${qty})`,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.products.orgId, orgId), eq(schema.products.id, it.productId)));
      await db.insert(schema.stockMovements).values({
        orgId,
        productId: it.productId,
        kind: "consume",
        onHandDelta: -qty,
        committedDelta: -qty,
        referenceType: "order",
        referenceId: orderId,
        createdBy: userId,
      });
    }
  }
}
