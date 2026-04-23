"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireUser, ACTIVE_ORG_COOKIE, getUserMemberships } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { and, eq } from "drizzle-orm";
import { DEFAULT_STAGES } from "@/modules/orders/lib/stages";
import { DEFAULT_INVOICE_TEMPLATE_CONFIG } from "@/modules/invoices/schema";

export async function setActiveOrg(orgId: string) {
  const user = await requireUser();
  const memberships = await getUserMemberships(user.id);
  if (!memberships.some((m) => m.orgId === orgId)) {
    throw new Error("Not a member of that organization");
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

const createOrgSchema = z.object({
  name: z.string().min(2).max(80),
  currency: z.string().length(3).default("USD"),
});

export async function createOrganization(formData: FormData) {
  const user = await requireUser();
  const parsed = createOrgSchema.parse({
    name: formData.get("name"),
    currency: (formData.get("currency") as string) || "USD",
  });

  const baseSlug = slugify(parsed.name) || `org-${Date.now()}`;
  let slug = baseSlug;
  let attempt = 1;
  // Uniqueness retry for slug
  while (true) {
    const existing = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug))
      .limit(1);
    if (existing.length === 0) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: parsed.name, slug, currency: parsed.currency })
    .returning();

  // Creator becomes super_admin. DB trigger can't do it because the service-role Drizzle
  // connection doesn't set auth.uid().
  await db
    .insert(schema.memberships)
    .values({ orgId: org.id, userId: user.id, role: "super_admin" })
    .onConflictDoNothing();

  // Seed the default order pipeline. Users can rename/reorder/add/remove later.
  await db.insert(schema.orderStages).values(
    DEFAULT_STAGES.map((s) => ({
      orgId: org.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      sortOrder: s.sortOrder,
      effect: s.effect,
      isInitial: s.isInitial ?? false,
      isTerminal: s.isTerminal ?? false,
    })),
  );

  // Seed a default invoice template so the first invoice renders without setup.
  await db.insert(schema.invoiceTemplates).values({
    orgId: org.id,
    name: "Default",
    layout: "clean",
    isDefault: true,
    config: DEFAULT_INVOICE_TEMPLATE_CONFIG,
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}

export async function updateOrganization(formData: FormData) {
  const user = await requireUser();
  const orgId = formData.get("orgId") as string;
  const name = formData.get("name") as string;
  const currency = (formData.get("currency") as string) || "USD";
  const taxRate = formData.get("taxRate") as string;

  const isAdmin = await db
    .select()
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.orgId, orgId),
        eq(schema.memberships.userId, user.id),
      ),
    )
    .limit(1);
  if (!isAdmin.length || !["super_admin", "admin"].includes(isAdmin[0].role)) {
    throw new Error("Not authorized");
  }

  await db
    .update(schema.organizations)
    .set({ name, currency, taxRate, updatedAt: new Date() })
    .where(eq(schema.organizations.id, orgId));
}
