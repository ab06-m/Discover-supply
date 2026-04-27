import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const ACTIVE_ORG_COOKIE = "active_org_id";

export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

export const getUserMemberships = cache(async (userId: string) => {
  return db
    .select({
      orgId: schema.memberships.orgId,
      role: schema.memberships.role,
      org: schema.organizations,
    })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(eq(schema.memberships.userId, userId));
});

export const getActiveOrg = cache(async () => {
  const user = await requireUser();
  const memberships = await getUserMemberships(user.id);
  if (memberships.length === 0) return { user, org: null, role: null, memberships };

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.orgId === cookieOrgId) ?? memberships[0];
  return { user, org: active.org, role: active.role, memberships };
});

export async function requireActiveOrg() {
  const result = await getActiveOrg();
  if (!result.org) redirect("/onboarding");
  return result as typeof result & { org: NonNullable<typeof result.org> };
}
