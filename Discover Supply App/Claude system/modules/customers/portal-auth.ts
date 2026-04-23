import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * Resolve the currently signed-in user to a customer-portal identity.
 * Separate from staff memberships by design — an email can only be ONE kind
 * of user per workspace, and we look them up via customer_contacts.
 */
export const getCustomerIdentity = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;

  const contacts = await db
    .select({
      contact: schema.customerContacts,
      customer: schema.customers,
      org: schema.organizations,
    })
    .from(schema.customerContacts)
    .innerJoin(
      schema.customers,
      eq(schema.customers.id, schema.customerContacts.customerId),
    )
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.customerContacts.orgId),
    )
    .where(eq(schema.customerContacts.userId, user.id));
  if (!contacts.length) return null;
  return { user, contacts };
});

export async function requireCustomer() {
  const identity = await getCustomerIdentity();
  if (!identity) redirect("/portal/login");
  // For now, pick first contact (single-tenant portal per user).
  return { ...identity, active: identity.contacts[0] };
}
