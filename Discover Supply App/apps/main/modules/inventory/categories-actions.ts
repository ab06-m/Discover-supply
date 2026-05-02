"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";

export type CategoryNode = {
  id: string;
  name: string;
  parentId: string | null;
};

// Returns every category in the org sorted by name. The dialog is responsible
// for assembling the indented tree from `parentId`. Categories are typically
// few (<200), so flat fetch + client tree-build is simpler than recursive SQL.
export async function listCategories(): Promise<CategoryNode[]> {
  const { org } = await requireActiveOrg();
  return db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      parentId: schema.categories.parentId,
    })
    .from(schema.categories)
    .where(eq(schema.categories.orgId, org.id))
    .orderBy(asc(schema.categories.name));
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  // The form sends "" when no parent is selected. Coerce to null so the
  // category lives at the tree root.
  parentId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});

export async function createCategory(input: z.input<typeof upsertSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "category.write");
  const parsed = upsertSchema.parse(input);

  if (parsed.parentId) {
    await assertParentBelongsToOrg(org.id, parsed.parentId);
  }

  const [row] = await db
    .insert(schema.categories)
    .values({
      orgId: org.id,
      name: parsed.name,
      parentId: parsed.parentId,
    })
    .returning({ id: schema.categories.id });

  revalidatePath("/products");
  revalidatePath("/check-in");
  return { id: row.id };
}

export async function updateCategory(input: z.input<typeof upsertSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "category.write");
  const parsed = upsertSchema.parse(input);
  if (!parsed.id) throw new Error("Missing category id");

  // Cycle prevention: a category cannot become its own descendant. Walk up
  // from the proposed parent and abort if we reach the category being edited.
  if (parsed.parentId) {
    if (parsed.parentId === parsed.id) {
      throw new Error("A category cannot be its own parent.");
    }
    await assertParentBelongsToOrg(org.id, parsed.parentId);

    const all = await listCategoriesRaw(org.id);
    const byId = new Map(all.map((c) => [c.id, c.parentId]));
    let cursor: string | null = parsed.parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === parsed.id) {
        throw new Error("Cannot move a category under one of its descendants.");
      }
      if (seen.has(cursor)) break; // defensive — pre-existing cycle
      seen.add(cursor);
      cursor = byId.get(cursor) ?? null;
    }
  }

  await db
    .update(schema.categories)
    .set({ name: parsed.name, parentId: parsed.parentId })
    .where(and(eq(schema.categories.orgId, org.id), eq(schema.categories.id, parsed.id)));

  revalidatePath("/products");
  revalidatePath("/check-in");
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteCategory(input: z.input<typeof deleteSchema>) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "category.write");
  const parsed = deleteSchema.parse(input);

  // Re-parent direct children to this category's parent (or null) before
  // deleting so the subtree is preserved at the next level up. Without this
  // the children would survive as orphans pointing at a now-missing id.
  const [self] = await db
    .select({ parentId: schema.categories.parentId })
    .from(schema.categories)
    .where(and(eq(schema.categories.orgId, org.id), eq(schema.categories.id, parsed.id)))
    .limit(1);
  if (!self) throw new Error("Category not found");

  await db
    .update(schema.categories)
    .set({ parentId: self.parentId })
    .where(and(eq(schema.categories.orgId, org.id), eq(schema.categories.parentId, parsed.id)));

  // products.categoryId already nulls out via `onDelete: "set null"`, so
  // affected products gracefully become uncategorised.
  await db
    .delete(schema.categories)
    .where(and(eq(schema.categories.orgId, org.id), eq(schema.categories.id, parsed.id)));

  revalidatePath("/products");
  revalidatePath("/check-in");
}

async function listCategoriesRaw(orgId: string) {
  return db
    .select({
      id: schema.categories.id,
      parentId: schema.categories.parentId,
    })
    .from(schema.categories)
    .where(eq(schema.categories.orgId, orgId));
}

async function assertParentBelongsToOrg(orgId: string, parentId: string) {
  const rows = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(and(eq(schema.categories.orgId, orgId), eq(schema.categories.id, parentId)))
    .limit(1);
  if (!rows.length) throw new Error("Parent category not found");
}
