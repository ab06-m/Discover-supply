import { eq } from "drizzle-orm";
import { getAuthUser, getUserMemberships } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function getCatalogOrg() {
  const configuredOrgId = (
    process.env.STORE_ORG_ID ??
    process.env.NEXT_PUBLIC_STORE_ORG_ID ??
    ""
  ).trim();

  if (configuredOrgId) {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, configuredOrgId))
      .limit(1);

    if (!org) {
      throw new Error("Configured catalog organization was not found.");
    }

    return org;
  }

  const user = await getAuthUser();
  if (user) {
    const memberships = await getUserMemberships(user.id);
    if (memberships[0]?.org) return memberships[0].org;
  }

  throw new Error("Catalog organization is not configured.");
}
