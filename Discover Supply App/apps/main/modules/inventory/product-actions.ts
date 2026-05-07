"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { productSchema } from "./product-schema";

function parseProductForm(formData: FormData) {
  return productSchema.parse({
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
}

export async function createProduct(formData: FormData) {
  const { org, user, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");

  const input = parseProductForm(formData);
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

  const input = parseProductForm(formData);
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
