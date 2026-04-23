"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireCustomer } from "@/modules/customers/portal-auth";
import { generateDocNumber } from "@/modules/inventory/lib/generate-number";
import { getInitialStage } from "@/modules/orders/queries";
import { applyStageEffect } from "@/modules/orders/lib/apply-stage-effect";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
});

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function placeStorefrontOrder(input: z.input<typeof checkoutSchema>) {
  const { user, active } = await requireCustomer();
  const parsed = checkoutSchema.parse(input);
  const orgId = active.org.id;

  // Fetch authoritative product data for pricing (never trust client prices).
  const productIds = parsed.items.map((i) => i.productId);
  const products = await db
    .select()
    .from(schema.products)
    .where(
      and(
        eq(schema.products.orgId, orgId),
        eq(schema.products.isActive, true),
        inArray(schema.products.id, productIds),
      ),
    );
  const byId = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const lines = parsed.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new Error("One of the items is no longer available.");
    const unitPrice = parseFloat(p.price);
    const lineTotal = +(unitPrice * i.quantity).toFixed(2);
    subtotal += lineTotal;
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      quantity: i.quantity,
      unitPrice,
      lineTotal,
    };
  });

  const orgTaxRate = parseFloat(active.org.taxRate ?? "0");
  const taxTotal = +(subtotal * orgTaxRate).toFixed(2);
  const total = +(subtotal + taxTotal).toFixed(2);

  const initial = await getInitialStage(orgId);
  if (!initial) throw new Error("Workspace is not ready to accept orders.");

  const number = await generateDocNumber({
    table: schema.orders,
    orgId,
    prefix: "SO",
  });

  const [order] = await db
    .insert(schema.orders)
    .values({
      orgId,
      number,
      customerId: active.contact.customerId,
      stageId: initial.id,
      shippingAddress: (active.customer.shippingAddress ?? null) as any,
      subtotal: String(subtotal),
      taxTotal: String(taxTotal),
      discountTotal: "0",
      total: String(total),
      notes: parsed.notes || null,
      createdBy: user.id,
      source: "storefront",
    })
    .returning({ id: schema.orders.id, number: schema.orders.number });

  await db.insert(schema.orderItems).values(
    lines.map((l) => ({
      orgId,
      orderId: order.id,
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      quantity: l.quantity,
      unitPrice: String(l.unitPrice),
      taxRate: String(orgTaxRate),
      lineTotal: String(l.lineTotal),
    })),
  );

  await db.insert(schema.orderStageHistory).values({
    orgId,
    orderId: order.id,
    fromStageId: null,
    toStageId: initial.id,
    changedBy: user.id,
    note: "Order placed from storefront",
  });

  if (initial.effect !== "none") {
    await applyStageEffect({
      orgId,
      orderId: order.id,
      effect: initial.effect,
      userId: user.id,
    });
  }

  revalidatePath("/portal/orders");
  revalidatePath("/orders");
  return { id: order.id, number: order.number };
}
