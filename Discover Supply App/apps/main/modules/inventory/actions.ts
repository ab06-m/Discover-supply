"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateDocNumber } from "./lib/generate-number";
import type { Role } from "@/lib/permissions";

const productSchema = z.object({
  categoryId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  kind: z.enum(["goods", "service"]).default("goods"),
  name: z.string().min(1).max(200),
  brand: z.string().max(120).optional().or(z.literal("")),
  vendor: z.string().max(200).optional().or(z.literal("")),
  sku: z.string().max(64).optional().or(z.literal("")),
  barcode: z.string().max(64).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  salesDescription: z.string().max(2000).optional().or(z.literal("")),
  purchaseDescription: z.string().max(2000).optional().or(z.literal("")),
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
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  returnable: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  showInOnlineStore: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
});

export async function createProduct(formData: FormData) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");

  const input = productSchema.parse({
    categoryId: formData.get("categoryId") ?? "",
    kind: formData.get("kind") ?? "goods",
    name: formData.get("name"),
    brand: formData.get("brand") ?? "",
    vendor: formData.get("vendor") ?? "",
    sku: formData.get("sku") ?? "",
    barcode: formData.get("barcode") ?? "",
    description: formData.get("description") ?? "",
    salesDescription: formData.get("salesDescription") ?? "",
    purchaseDescription: formData.get("purchaseDescription") ?? "",
    unit: formData.get("unit") ?? "each",
    packSize: formData.get("packSize") ?? 1,
    price: formData.get("price") ?? 0,
    cost: formData.get("cost") ?? 0,
    lowStockThreshold: formData.get("lowStockThreshold"),
    trackStock: formData.get("trackStock") ?? false,
    returnable: formData.get("returnable") ?? false,
    showInOnlineStore: formData.get("showInOnlineStore") ?? false,
  });
  const isService = input.kind === "service";

  const [row] = await db
    .insert(schema.products)
    .values({
      orgId: org.id,
      categoryId: input.categoryId,
      kind: input.kind,
      name: input.name,
      brand: input.brand || null,
      vendor: input.vendor || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      description: input.description || null,
      salesDescription: input.salesDescription || null,
      purchaseDescription: input.purchaseDescription || null,
      unit: isService ? "each" : input.unit,
      packSize: isService ? 1 : input.packSize,
      price: String(input.price),
      cost: String(input.cost),
      lowStockThreshold: isService ? null : input.lowStockThreshold,
      trackStock: isService ? false : input.trackStock,
      returnable: input.returnable,
      showInOnlineStore: input.showInOnlineStore,
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
    categoryId: formData.get("categoryId") ?? "",
    kind: formData.get("kind") ?? "goods",
    name: formData.get("name"),
    brand: formData.get("brand") ?? "",
    vendor: formData.get("vendor") ?? "",
    sku: formData.get("sku") ?? "",
    barcode: formData.get("barcode") ?? "",
    description: formData.get("description") ?? "",
    salesDescription: formData.get("salesDescription") ?? "",
    purchaseDescription: formData.get("purchaseDescription") ?? "",
    unit: formData.get("unit") ?? "each",
    packSize: formData.get("packSize") ?? 1,
    price: formData.get("price") ?? 0,
    cost: formData.get("cost") ?? 0,
    lowStockThreshold: formData.get("lowStockThreshold"),
    trackStock: formData.get("trackStock") ?? false,
    returnable: formData.get("returnable") ?? false,
    showInOnlineStore: formData.get("showInOnlineStore") ?? false,
  });
  const isService = input.kind === "service";

  await db
    .update(schema.products)
    .set({
      categoryId: input.categoryId,
      kind: input.kind,
      name: input.name,
      brand: input.brand || null,
      vendor: input.vendor || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      description: input.description || null,
      salesDescription: input.salesDescription || null,
      purchaseDescription: input.purchaseDescription || null,
      unit: isService ? "each" : input.unit,
      packSize: isService ? 1 : input.packSize,
      price: String(input.price),
      cost: String(input.cost),
      lowStockThreshold: isService ? null : input.lowStockThreshold,
      trackStock: isService ? false : input.trackStock,
      returnable: input.returnable,
      showInOnlineStore: input.showInOnlineStore,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.products.orgId, org.id), eq(schema.products.id, id)));

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

const imageSchema = z.object({
  name: z.string(),
  size: z.number().max(5 * 1024 * 1024, "Each image must be 5 MB or less."),
  type: z.string().startsWith("image/", "Only image files are supported."),
});

const checkInItemSchema = productSchema.extend({
  openingQuantity: z.coerce.number().int().min(0).default(0),
  openingUnitOfMeasure: z.enum(["each", "box"]).default("each"),
  openingPackSize: z.coerce.number().int().min(1).default(1),
});

function getFileList(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function uploadProductImage(orgId: string, productId: string, file: File, slot: string) {
  imageSchema.parse({ name: file.name, size: file.size, type: file.type });

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeSlot = slot.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const path = `${orgId}/${productId}/${safeSlot}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function createCheckInItem(formData: FormData) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");

  const input = checkInItemSchema.parse({
    categoryId: formData.get("categoryId") ?? "",
    kind: formData.get("kind") ?? "goods",
    name: formData.get("name"),
    brand: formData.get("brand") ?? "",
    vendor: formData.get("vendor") ?? "",
    sku: formData.get("sku") ?? "",
    barcode: formData.get("barcode") ?? "",
    description: formData.get("description") ?? "",
    salesDescription: formData.get("salesDescription") ?? "",
    purchaseDescription: formData.get("purchaseDescription") ?? "",
    unit: formData.get("unit") ?? "each",
    packSize: formData.get("packSize") ?? 1,
    price: formData.get("price") ?? 0,
    cost: formData.get("cost") ?? 0,
    lowStockThreshold: formData.get("lowStockThreshold"),
    trackStock: formData.get("trackStock") ?? false,
    returnable: formData.get("returnable") ?? false,
    showInOnlineStore: formData.get("showInOnlineStore") ?? false,
    openingQuantity: formData.get("openingQuantity") ?? 0,
    openingUnitOfMeasure: formData.get("openingUnitOfMeasure") ?? "each",
    openingPackSize: formData.get("openingPackSize") ?? 1,
  });

  const primaryFiles = getFileList(formData, "primaryImage");
  if (primaryFiles.length > 1) throw new Error("Only one primary image is allowed.");
  const additionalFiles = getFileList(formData, "additionalImages");
  if (additionalFiles.length > 15) throw new Error("Add up to 15 additional images.");

  const isService = input.kind === "service";
  const trackStock = isService ? false : input.trackStock;
  const openingQuantity = trackStock ? input.openingQuantity : 0;
  if (input.openingQuantity > 0 && (!trackStock || isService)) {
    throw new Error("Opening stock can only be added to goods that track inventory.");
  }

  const productId = randomUUID();
  const imageUrl = primaryFiles[0]
    ? await uploadProductImage(org.id, productId, primaryFiles[0], "primary")
    : null;
  const imageGallery = await Promise.all(
    additionalFiles.map((file, index) =>
      uploadProductImage(org.id, productId, file, `additional-${index + 1}`),
    ),
  );

  const receiptNumber = openingQuantity > 0
    ? await generateDocNumber({
        table: schema.receipts,
        orgId: org.id,
        prefix: "RCV",
      })
    : null;

  let receiptId: string | null = null;
  await db.transaction(async (tx) => {
    await tx.insert(schema.products).values({
      id: productId,
      orgId: org.id,
      categoryId: input.categoryId,
      kind: input.kind,
      name: input.name,
      brand: input.brand || null,
      vendor: input.vendor || null,
      sku: input.sku || null,
      barcode: input.barcode || null,
      description: input.description || null,
      salesDescription: input.salesDescription || null,
      purchaseDescription: input.purchaseDescription || null,
      unit: isService ? "each" : input.unit,
      packSize: isService ? 1 : input.packSize,
      price: String(input.price),
      cost: String(input.cost),
      lowStockThreshold: isService ? null : input.lowStockThreshold,
      trackStock,
      imageUrl,
      imageGallery,
      returnable: input.returnable,
      showInOnlineStore: input.showInOnlineStore,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (openingQuantity > 0 && receiptNumber) {
      const [receipt] = await tx
        .insert(schema.receipts)
        .values({
          orgId: org.id,
          number: receiptNumber,
          supplierName: input.vendor || null,
          supplierRef: null,
          notes: "Opening stock from item check-in",
          createdBy: user.id,
        })
        .returning({ id: schema.receipts.id });

      receiptId = receipt.id;
      const packSize =
        input.openingUnitOfMeasure === "box" ? input.openingPackSize : 1;
      const baseQty = openingQuantity * packSize;

      await tx.insert(schema.stockMovements).values({
        orgId: org.id,
        productId,
        kind: "receive",
        onHandDelta: baseQty,
        committedDelta: 0,
        quantityInput: openingQuantity,
        unitOfMeasure: input.openingUnitOfMeasure,
        packSize,
        referenceType: "receipt",
        referenceId: receipt.id,
        unitCost: String(input.cost),
        note: "Opening stock",
        createdBy: user.id,
      });

      await tx
        .update(schema.products)
        .set({
          onHand: sql`${schema.products.onHand} + ${baseQty}`,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.products.orgId, org.id), eq(schema.products.id, productId)));
    }
  });

  revalidatePath("/check-in");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/shop");

  return { id: productId, receiptId, receiptNumber };
}

// ─── Stock check-in (receive) ────────────────────────────────────────────────
// `quantity` is whatever the user typed (e.g. 2). `unitOfMeasure` is "each" or
// "box"; `packSize` is the multiplier when receiving by the box. The action
// converts to base units before touching `on_hand`. Defaults to plain eaches
// so existing callers that haven't been updated keep working.
const receiveItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitOfMeasure: z.enum(["each", "box"]).default("each"),
  packSize: z.coerce.number().int().min(1).default(1),
  unitCost: z.coerce.number().min(0).optional(),
  currentPrice: z.coerce.number().min(0).optional(),
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
  const productIds = Array.from(new Set(parsed.items.map((item) => item.productId)));

  const number = await generateDocNumber({
    table: schema.receipts,
    orgId: org.id,
    prefix: "RCV",
  });

  const receipt = await db.transaction(async (tx) => {
    const products = await tx
      .select({
        id: schema.products.id,
        name: schema.products.name,
        kind: schema.products.kind,
        trackStock: schema.products.trackStock,
        isActive: schema.products.isActive,
      })
      .from(schema.products)
      .where(and(eq(schema.products.orgId, org.id), inArray(schema.products.id, productIds)));

    const productById = new Map(products.map((product) => [product.id, product]));
    const missingProduct = productIds.find((id) => !productById.has(id));
    if (missingProduct) throw new Error("One or more products could not be found.");

    const notReceivable = products.find(
      (product) => product.kind !== "goods" || !product.trackStock || !product.isActive,
    );
    if (notReceivable) {
      throw new Error(`${notReceivable.name} cannot receive stock because it is inactive or not inventory-tracked.`);
    }

    const [createdReceipt] = await tx
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
      const packSize = item.unitOfMeasure === "box" ? item.packSize : 1;
      const baseQty = item.quantity * packSize;

      await tx.insert(schema.stockMovements).values({
        orgId: org.id,
        productId: item.productId,
        kind: "receive",
        onHandDelta: baseQty,
        committedDelta: 0,
        quantityInput: item.quantity,
        unitOfMeasure: item.unitOfMeasure,
        packSize,
        referenceType: "receipt",
        referenceId: createdReceipt.id,
        unitCost: item.unitCost != null ? String(item.unitCost) : null,
        createdBy: user.id,
      });

      await tx
        .update(schema.products)
        .set({
          onHand: sql`${schema.products.onHand} + ${baseQty}`,
          ...(item.unitCost != null ? { cost: String(item.unitCost) } : {}),
          ...(item.currentPrice != null ? { price: String(item.currentPrice) } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.products.orgId, org.id), eq(schema.products.id, item.productId)));
    }

    return createdReceipt;
  });

  revalidatePath("/products");
  revalidatePath("/check-in");
  revalidatePath("/shop");
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

// Barcode lookup for scanner — returns minimal info plus the case-pack
// metadata so receive/order forms can default the unit + box size.
export async function lookupByBarcode(barcode: string) {
  const { org } = await requireActiveOrg();
  const rows = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      barcode: schema.products.barcode,
      unit: schema.products.unit,
      packSize: schema.products.packSize,
      imageUrl: schema.products.imageUrl,
      price: schema.products.price,
      cost: schema.products.cost,
      onHand: schema.products.onHand,
      committed: schema.products.committed,
      kind: schema.products.kind,
      trackStock: schema.products.trackStock,
      isActive: schema.products.isActive,
    })
    .from(schema.products)
    .where(and(eq(schema.products.orgId, org.id), eq(schema.products.barcode, barcode)))
    .limit(1);
  return rows[0] ?? null;
}
