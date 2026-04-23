"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import { generateDocNumber } from "@/modules/inventory/lib/generate-number";
import { applyStageEffect } from "./lib/apply-stage-effect";
import { getInitialStage, searchProductsForOrder } from "./queries";

const lineSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(64).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(1).default(0),
});

const createOrderSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  internalNotes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(lineSchema).min(1),
});

function computeTotals(items: z.infer<typeof lineSchema>[]) {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;
  const lines = items.map((it) => {
    const gross = it.unitPrice * it.quantity;
    const afterDiscount = Math.max(0, gross - it.discount);
    const tax = +(afterDiscount * it.taxRate).toFixed(2);
    const lineTotal = +(afterDiscount + tax).toFixed(2);
    subtotal += gross;
    discountTotal += it.discount;
    taxTotal += tax;
    return { ...it, lineTotal };
  });
  const total = +(subtotal - discountTotal + taxTotal).toFixed(2);
  return {
    lines,
    subtotal: +subtotal.toFixed(2),
    taxTotal: +taxTotal.toFixed(2),
    discountTotal: +discountTotal.toFixed(2),
    total,
  };
}

export async function createOrder(input: z.input<typeof createOrderSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "order.create");
  const parsed = createOrderSchema.parse(input);

  const initialStage = await getInitialStage(org.id);
  if (!initialStage) throw new Error("No order stages configured for this workspace.");

  const number = await generateDocNumber({
    table: schema.orders,
    orgId: org.id,
    prefix: "SO",
  });

  const totals = computeTotals(parsed.items);

  let shippingAddress: unknown = null;
  if (parsed.customerId) {
    const cust = await db
      .select({ shippingAddress: schema.customers.shippingAddress })
      .from(schema.customers)
      .where(and(eq(schema.customers.orgId, org.id), eq(schema.customers.id, parsed.customerId)))
      .limit(1);
    shippingAddress = cust[0]?.shippingAddress ?? null;
  }

  const [order] = await db
    .insert(schema.orders)
    .values({
      orgId: org.id,
      number,
      customerId: parsed.customerId || null,
      stageId: initialStage.id,
      shippingAddress: shippingAddress as any,
      subtotal: String(totals.subtotal),
      taxTotal: String(totals.taxTotal),
      discountTotal: String(totals.discountTotal),
      total: String(totals.total),
      notes: parsed.notes || null,
      internalNotes: parsed.internalNotes || null,
      createdBy: user.id,
      source: "staff",
    })
    .returning({ id: schema.orders.id, number: schema.orders.number });

  await db.insert(schema.orderItems).values(
    totals.lines.map((l) => ({
      orgId: org.id,
      orderId: order.id,
      productId: l.productId || null,
      name: l.name,
      sku: l.sku || null,
      quantity: l.quantity,
      unitPrice: String(l.unitPrice),
      discount: String(l.discount),
      taxRate: String(l.taxRate),
      lineTotal: String(l.lineTotal),
    })),
  );

  await db.insert(schema.orderStageHistory).values({
    orgId: org.id,
    orderId: order.id,
    fromStageId: null,
    toStageId: initialStage.id,
    changedBy: user.id,
    note: "Order created",
  });

  // If the initial stage already has an effect (unusual but allowed), run it.
  if (initialStage.effect !== "none") {
    await applyStageEffect({
      orgId: org.id,
      orderId: order.id,
      effect: initialStage.effect,
      userId: user.id,
    });
  }

  revalidatePath("/orders");
  return { id: order.id, number: order.number };
}

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  toStageId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export async function transitionOrderStage(input: z.input<typeof transitionSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "order.advance_stage");
  const parsed = transitionSchema.parse(input);

  const current = await db
    .select({ id: schema.orders.id, stageId: schema.orders.stageId })
    .from(schema.orders)
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)))
    .limit(1);
  if (!current.length) throw new Error("Order not found");
  const fromStageId = current[0].stageId;

  const target = await db
    .select()
    .from(schema.orderStages)
    .where(and(eq(schema.orderStages.orgId, org.id), eq(schema.orderStages.id, parsed.toStageId)))
    .limit(1);
  if (!target.length) throw new Error("Target stage not found");
  const toStage = target[0];

  if (fromStageId === toStage.id) return;

  await db
    .update(schema.orders)
    .set({ stageId: toStage.id, updatedAt: new Date() })
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)));

  await db.insert(schema.orderStageHistory).values({
    orgId: org.id,
    orderId: parsed.orderId,
    fromStageId,
    toStageId: toStage.id,
    changedBy: user.id,
    note: parsed.note ?? null,
  });

  await applyStageEffect({
    orgId: org.id,
    orderId: parsed.orderId,
    effect: toStage.effect,
    userId: user.id,
  });

  revalidatePath(`/orders/${parsed.orderId}`);
  revalidatePath("/orders");
}

const editItemsSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(lineSchema).min(1),
});

export async function replaceOrderItems(input: z.input<typeof editItemsSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "order.edit");
  const parsed = editItemsSchema.parse(input);

  // Guard: don't allow edit after stock has been committed/consumed.
  const order = await db
    .select({
      id: schema.orders.id,
      effect: schema.orderStages.effect,
    })
    .from(schema.orders)
    .leftJoin(schema.orderStages, eq(schema.orderStages.id, schema.orders.stageId))
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)))
    .limit(1);
  if (!order.length) throw new Error("Order not found");
  const effect = order[0].effect;
  if (effect === "commit" || effect === "consume") {
    throw new Error(
      "Cannot edit items after the order has reserved or shipped stock. Move it back to Draft first.",
    );
  }

  const totals = computeTotals(parsed.items);

  await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, parsed.orderId));
  await db.insert(schema.orderItems).values(
    totals.lines.map((l) => ({
      orgId: org.id,
      orderId: parsed.orderId,
      productId: l.productId || null,
      name: l.name,
      sku: l.sku || null,
      quantity: l.quantity,
      unitPrice: String(l.unitPrice),
      discount: String(l.discount),
      taxRate: String(l.taxRate),
      lineTotal: String(l.lineTotal),
    })),
  );

  await db
    .update(schema.orders)
    .set({
      subtotal: String(totals.subtotal),
      taxTotal: String(totals.taxTotal),
      discountTotal: String(totals.discountTotal),
      total: String(totals.total),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)));

  revalidatePath(`/orders/${parsed.orderId}`);
}

const notesSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export async function updateOrderNotes(input: z.input<typeof notesSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "order.edit");
  const parsed = notesSchema.parse(input);
  await db
    .update(schema.orders)
    .set({
      notes: parsed.notes ?? null,
      internalNotes: parsed.internalNotes ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.orders.orgId, org.id), eq(schema.orders.id, parsed.orderId)));
  revalidatePath(`/orders/${parsed.orderId}`);
}

export async function searchOrderProducts(query: string) {
  const { org } = await requireActiveOrg();
  return searchProductsForOrder(org.id, query);
}
