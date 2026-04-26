"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { generateDocNumber } from "./lib/generate-number";
import type { Role } from "@/lib/permissions";

const productSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(64).optional().or(z.literal("")),
  barcode: z.string().max(64).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  unit: z.enum(["each", "case", "box", "pack", "kg", "lb", "liter", "gallon"]).default("each"),
  packSize: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  lowStockThreshold: z.preprocess(
    (value) => {
      if (value == null) return null;
      const text = String(value).trim();
      return text === "" ? null : text;
    },
    z.coerce.number().int().min(0).nullable(),
  ),
  trackStock: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? false : Boolean(v))),
});

export async function createProduct(formData: FormData) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");

  const input = productSchema.parse({
    name: formData.get("name"),
    sku: formData.get("sku") ?? "",
    barcode: formData.get("barcode") ?? "",
    description: formData.get("description") ?? "",
    unit: formData.get("unit") ?? "each",
    packSize: formData.get("packSize") ?? 1,
    price: formData.get("price") ?? 0,
    cost: formData.get("cost") ?? 0,
    lowStockThreshold: formData.get("lowStockThreshold"),
    trackStock: formData.get("trackStock") ?? false,
  });

  const [row] = await db
    .insert(schema.products)
    .values({
      orgId: org.id,
      name: input.name,
      sku: input.sku || null,
      barcode: input.barcode || null,
      description: input.description || null,
      unit: input.unit,
      packSize: input.packSize,
      price: String(input.price),
      cost: String(input.cost),
      lowStockThreshold: input.lowStockThreshold,
      trackStock: input.trackStock,
    })
    .returning({ id: schema.products.id });

  void user;
  revalidatePath("/products");
  return { id: row.id };
}

export async function updateProduct(formData: FormData) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing product id");

  const input = productSchema.parse({
    name: formData.get("name"),
    sku: formData.get("sku") ?? "",
    barcode: formData.get("barcode") ?? "",
    description: formData.get("description") ?? "",
    unit: formData.get("unit") ?? "each",
    packSize: formData.get("packSize") ?? 1,
    price: formData.get("price") ?? 0,
    cost: formData.get("cost") ?? 0,
    lowStockThreshold: formData.get("lowStockThreshold"),
    trackStock: formData.get("trackStock") ?? false,
  });

  await db
    .update(schema.products)
    .set({
      name: input.name,
      sku: input.sku || null,
      barcode: input.barcode || null,
      description: input.description || null,
      unit: input.unit,
      packSize: input.packSize,
      price: String(input.price),
      cost: String(input.cost),
      lowStockThreshold: input.lowStockThreshold,
      trackStock: input.trackStock,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.products.orgId, org.id), eq(schema.products.id, id)));

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

// ─── Stock check-in (receive) ────────────────────────────────────────────────
const receiveItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitCost: z.coerce.number().min(0).optional(),
});

const receiveBatchSchema = z.object({
  supplierName: z.string().max(200).optional().or(z.literal("")),
  supplierRef: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(receiveItemSchema).min(1),
});

export async function receiveStock(input: z.input<typeof receiveBatchSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "stock.receive");
  const parsed = receiveBatchSchema.parse(input);

  const number = await generateDocNumber({
    table: schema.receipts,
    orgId: org.id,
    prefix: "RCV",
  });

  const [receipt] = await db
    .insert(schema.receipts)
    .values({
      orgId: org.id,
      number,
      supplierName: parsed.supplierName || null,
      supplierRef: parsed.supplierRef || null,
      notes: parsed.notes || null,
      createdBy: user.id,
    })
    .returning({ id: schema.receipts.id, number: schema.receipts.number });

  for (const item of parsed.items) {
    await db.insert(schema.stockMovements).values({
      orgId: org.id,
      productId: item.productId,
      kind: "receive",
      onHandDelta: item.quantity,
      committedDelta: 0,
      referenceType: "receipt",
      referenceId: receipt.id,
      unitCost: item.unitCost != null ? String(item.unitCost) : null,
      createdBy: user.id,
    });

    await db
      .update(schema.products)
      .set({
        onHand: sql`${schema.products.onHand} + ${item.quantity}`,
        ...(item.unitCost != null ? { cost: String(item.unitCost) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.products.orgId, org.id), eq(schema.products.id, item.productId)));
  }

  revalidatePath("/products");
  revalidatePath("/check-in");
  return { id: receipt.id, number: receipt.number };
}

const adjustSchema = z.object({
  productId: z.string().uuid(),
  delta: z.coerce.number().int(), // +/-
  note: z.string().max(500).optional(),
});

export async function adjustStock(input: z.input<typeof adjustSchema>) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "stock.adjust");
  const parsed = adjustSchema.parse(input);

  await db.insert(schema.stockMovements).values({
    orgId: org.id,
    productId: parsed.productId,
    kind: "adjust",
    onHandDelta: parsed.delta,
    committedDelta: 0,
    note: parsed.note ?? null,
    createdBy: user.id,
  });
  await db
    .update(schema.products)
    .set({
      onHand: sql`${schema.products.onHand} + ${parsed.delta}`,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.products.orgId, org.id), eq(schema.products.id, parsed.productId)));

  revalidatePath("/products");
}

// Barcode lookup for scanner — returns minimal info.
export async function lookupByBarcode(barcode: string) {
  const { org } = await requireActiveOrg();
  const rows = await db
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
    .where(and(eq(schema.products.orgId, org.id), eq(schema.products.barcode, barcode)))
    .limit(1);
  return rows[0] ?? null;
}
