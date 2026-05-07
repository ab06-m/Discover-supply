import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { cookies } from "next/headers";

export const PORTAL_DEV_CONTACT_COOKIE = "portal_dev_contact_id";
const DEV_REVIEW_USER_ID = "00000000-0000-0000-0000-000000000000";

async function getDevCustomerIdentity() {
  if (process.env.NODE_ENV !== "development") return null;

  const cookieStore = await cookies();
  const contactId = cookieStore.get(PORTAL_DEV_CONTACT_COOKIE)?.value;
  if (!contactId) return null;

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
    .where(eq(schema.customerContacts.id, contactId))
    .limit(1);

  if (!contacts.length) return null;

  return {
    user: {
      id: contacts[0].contact.userId ?? DEV_REVIEW_USER_ID,
      email: contacts[0].contact.email,
    },
    contacts,
  };
}

/**
 * Resolve the currently signed-in user to a customer-portal identity.
 * Separate from staff memberships by design — an email can only be ONE kind
 * of user per workspace, and we look them up via customer_contacts.
 */
export const getCustomerIdentity = cache(async () => {
  const user = await getAuthUser();
  if (!user) return getDevCustomerIdentity();

  const userEmail = user.email?.trim().toLowerCase() ?? "";
  const contactMatcher = userEmail
    ? or(
        eq(schema.customerContacts.userId, user.id),
        and(
          sql`lower(${schema.customerContacts.email}) = ${userEmail}`,
          or(
            isNull(schema.customerContacts.userId),
            eq(schema.customerContacts.userId, user.id),
          ),
        ),
      )
    : eq(schema.customerContacts.userId, user.id);

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
    .where(contactMatcher);
  if (!contacts.length) return getDevCustomerIdentity();

  const claimableContactIds = contacts
    .filter(({ contact }) => !contact.userId)
    .map(({ contact }) => contact.id);

  if (claimableContactIds.length) {
    await db
      .update(schema.customerContacts)
      .set({ userId: user.id })
      .where(
        and(
          inArray(schema.customerContacts.id, claimableContactIds),
          isNull(schema.customerContacts.userId),
        ),
      );
  }

  return {
    user,
    contacts: contacts.map((row) => ({
      ...row,
      contact: { ...row.contact, userId: row.contact.userId ?? user.id },
    })),
  };
});

export async function requireCustomer(nextPath = "/portal") {
  const identity = await getCustomerIdentity();
  if (!identity) redirect(`/portal/login?next=${encodeURIComponent(nextPath)}`);
  // For now, pick first contact (single-tenant portal per user).
  return { ...identity, active: identity.contacts[0] };
}
