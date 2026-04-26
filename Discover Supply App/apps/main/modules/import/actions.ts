"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";
import type { ProductImportRow, CustomerImportRow, ImportResult } from "./types";

const CHUNK = 100;

type ProductUnit = "each" | "case" | "box" | "pack" | "kg" | "lb" | "liter" | "gallon";

const UNIT_MAP: Record<string, ProductUnit> = {
  unit: "each",
  each: "each",
  case: "case",
  box: "box",
  pack: "pack",
  kg: "kg",
  lb: "lb",
  liter: "liter",
  gallon: "gallon",
};

function mapUnit(raw?: string): ProductUnit {
  return UNIT_MAP[(raw ?? "").toLowerCase().trim()] ?? "each";
}

function parseOptionalThreshold(raw?: string) {
  if (!raw?.trim()) return null;
  return Math.max(0, Math.round(parseFloat(raw) || 0));
}

type ParsedAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

function parseAddress(raw?: string): ParsedAddress {
  if (!raw?.trim()) return {};
  const parts = raw.split(", ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return { line1: parts[0] };
  if (parts.length === 2) return { line1: parts[0], city: parts[1] };

  const country = parts[parts.length - 1];
  const stateZip = parts[parts.length - 2];
  const city = parts[parts.length - 3] ?? "";
  const line1 = parts.slice(0, parts.length - 3).join(", ") || parts[0];

  const spaceIdx = stateZip.indexOf(" ");
  const state = spaceIdx > -1 ? stateZip.slice(0, spaceIdx) : stateZip;
  const postalCode = spaceIdx > -1 ? stateZip.slice(spaceIdx + 1) : "";

  return { line1, city, state, postalCode, country };
}

export async function importProducts(rows: ProductImportRow[]): Promise<ImportResult> {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "product.write");

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  // Fetch existing products and categories in parallel — 2 DB calls total
  const [existingProducts, existingCats] = await Promise.all([
    db
      .select({ barcode: schema.products.barcode, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.orgId, org.id)),
    db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.orgId, org.id)),
  ]);

  const existingBarcodes = new Set(existingProducts.map((p) => p.barcode).filter(Boolean) as string[]);
  const existingNames = new Set(existingProducts.map((p) => p.name.toLowerCase()));
  const categoryMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));

  // Batch-create all missing categories in a single INSERT — 1 DB call
  const allCategoryNames = [
    ...new Set(rows.map((r) => r.Category?.trim()).filter((n): n is string => !!n)),
  ];
  const missingCategories = allCategoryNames.filter((n) => !categoryMap.has(n.toLowerCase()));
  if (missingCategories.length > 0) {
    const created = await db
      .insert(schema.categories)
      .values(missingCategories.map((name) => ({ orgId: org.id, name })))
      .returning({ id: schema.categories.id, name: schema.categories.name });
    for (const cat of created) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    }
  }

  // Build insert list entirely in-memory — 0 DB calls
  const toInsert: (typeof schema.products.$inferInsert)[] = [];
  for (const row of rows) {
    if (!row.Name?.trim()) continue;

    const rawCode = row.Code?.trim() ?? "";
    const barcode = rawCode && rawCode.toLowerCase() !== "null" ? rawCode : null;
    const name = row.Name.trim();

    if (barcode && existingBarcodes.has(barcode)) {
      result.skipped++;
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      result.skipped++;
      continue;
    }

    toInsert.push({
      orgId: org.id,
      categoryId: row.Category?.trim() ? (categoryMap.get(row.Category.trim().toLowerCase()) ?? null) : null,
      name,
      barcode,
      unit: mapUnit(row.Unit),
      price: String(Math.max(0, parseFloat(row.Price ?? "0") || 0)),
      cost: String(Math.max(0, parseFloat(row.Cost ?? "0") || 0)),
      onHand: Math.max(0, Math.round(parseFloat(row["Current Stock"] ?? "0") || 0)),
      lowStockThreshold: parseOptionalThreshold(row["Minimum Stock"]),
      trackStock: true,
    });

    // Track within-batch dedup
    if (barcode) existingBarcodes.add(barcode);
    existingNames.add(name.toLowerCase());
  }

  // Bulk insert in chunks of 100 — ~ceil(n/100) DB calls
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    try {
      const chunk = toInsert.slice(i, i + CHUNK);
      await db.insert(schema.products).values(chunk);
      result.imported += chunk.length;
    } catch (err) {
      result.errors.push(
        `Rows ${i + 1}–${Math.min(i + CHUNK, toInsert.length)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  revalidatePath("/products");
  return result;
}

export async function importCustomers(rows: CustomerImportRow[]): Promise<ImportResult> {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "customer.write");

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  // Fetch existing customers — 1 DB call
  const existing = await db
    .select({ storeCode: schema.customers.storeCode, name: schema.customers.name })
    .from(schema.customers)
    .where(eq(schema.customers.orgId, org.id));

  const existingCodes = new Set(existing.map((c) => c.storeCode).filter(Boolean) as string[]);
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  // Build insert list in-memory — 0 DB calls
  const toInsert: (typeof schema.customers.$inferInsert)[] = [];
  for (const row of rows) {
    if (!row.Name?.trim()) continue;

    const storeCode = row.ID?.trim() || null;
    const name = row.Name.trim();

    if (storeCode && existingCodes.has(storeCode)) {
      result.skipped++;
      continue;
    }
    if (existingNames.has(name.toLowerCase())) {
      result.skipped++;
      continue;
    }

    const billing = parseAddress(row.Address);
    if (row["Address Line 2"]?.trim()) billing.line2 = row["Address Line 2"].trim();

    let notes = row.Notes?.trim() || null;
    if (row["Work Phone"]?.trim()) {
      const wp = `Work phone: ${row["Work Phone"].trim()}`;
      notes = notes ? `${notes}\n${wp}` : wp;
    }

    const addr = Object.keys(billing).length ? billing : undefined;
    toInsert.push({
      orgId: org.id,
      name,
      storeCode,
      email: row.Email?.trim() || null,
      phone: row.Phone?.toString().trim() || null,
      notes,
      billingAddress: addr,
      shippingAddress: addr,
    });

    if (storeCode) existingCodes.add(storeCode);
    existingNames.add(name.toLowerCase());
  }

  // Bulk insert in chunks of 100
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    try {
      const chunk = toInsert.slice(i, i + CHUNK);
      await db.insert(schema.customers).values(chunk);
      result.imported += chunk.length;
    } catch (err) {
      result.errors.push(
        `Rows ${i + 1}–${Math.min(i + CHUNK, toInsert.length)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  revalidatePath("/customers");
  return result;
}
