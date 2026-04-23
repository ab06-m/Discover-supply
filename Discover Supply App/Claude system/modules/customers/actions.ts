"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireActiveOrg } from "@/lib/auth";
import { assertCan, type Role } from "@/lib/permissions";

const addressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })
  .partial();

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  storeCode: z.string().max(64).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  taxId: z.string().max(40).optional().or(z.literal("")),
  paymentTerms: z.enum(["cod", "net7", "net15", "net30", "net60"]).default("net30"),
  notes: z.string().max(2000).optional().or(z.literal("")),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  sameAsBilling: z.boolean().optional(),
});

function parseForm(fd: FormData) {
  const get = (k: string) => (fd.get(k) as string | null) ?? "";
  return customerSchema.parse({
    name: get("name"),
    storeCode: get("storeCode"),
    email: get("email"),
    phone: get("phone"),
    taxId: get("taxId"),
    paymentTerms: (get("paymentTerms") || "net30") as "net30",
    notes: get("notes"),
    billingAddress: {
      line1: get("bill_line1"),
      line2: get("bill_line2"),
      city: get("bill_city"),
      state: get("bill_state"),
      postalCode: get("bill_postalCode"),
      country: get("bill_country"),
    },
    shippingAddress: {
      line1: get("ship_line1"),
      line2: get("ship_line2"),
      city: get("ship_city"),
      state: get("ship_state"),
      postalCode: get("ship_postalCode"),
      country: get("ship_country"),
    },
    sameAsBilling: fd.get("sameAsBilling") === "on",
  });
}

export async function createCustomer(fd: FormData) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "customer.write");
  const input = parseForm(fd);

  const shipping = input.sameAsBilling ? input.billingAddress : input.shippingAddress;

  const [row] = await db
    .insert(schema.customers)
    .values({
      orgId: org.id,
      name: input.name,
      storeCode: input.storeCode || null,
      email: input.email || null,
      phone: input.phone || null,
      taxId: input.taxId || null,
      paymentTerms: input.paymentTerms,
      notes: input.notes || null,
      billingAddress: input.billingAddress,
      shippingAddress: shipping,
    })
    .returning({ id: schema.customers.id });

  revalidatePath("/customers");
  return { id: row.id };
}

export async function updateCustomer(fd: FormData) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "customer.write");
  const id = String(fd.get("id") ?? "");
  if (!id) throw new Error("Missing customer id");
  const input = parseForm(fd);
  const shipping = input.sameAsBilling ? input.billingAddress : input.shippingAddress;

  await db
    .update(schema.customers)
    .set({
      name: input.name,
      storeCode: input.storeCode || null,
      email: input.email || null,
      phone: input.phone || null,
      taxId: input.taxId || null,
      paymentTerms: input.paymentTerms,
      notes: input.notes || null,
      billingAddress: input.billingAddress,
      shippingAddress: shipping,
    })
    .where(and(eq(schema.customers.orgId, org.id), eq(schema.customers.id, id)));

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const { org, role } = await requireActiveOrg();
  assertCan(role as Role, "customer.write");
  await db
    .update(schema.customers)
    .set({ isActive })
    .where(and(eq(schema.customers.orgId, org.id), eq(schema.customers.id, id)));
  revalidatePath("/customers");
}
