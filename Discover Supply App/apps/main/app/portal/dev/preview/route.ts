import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { safeInternalPath } from "@/lib/redirects";
import { PORTAL_DEV_CONTACT_COOKIE } from "@/modules/customers/portal-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  const url = new URL(request.url);
  const nextPath = safeInternalPath(url.searchParams.get("next"), "/portal");

  if (url.searchParams.get("clear")) {
    const response = NextResponse.redirect(
      new URL(`/portal/login?next=${encodeURIComponent(nextPath)}`, request.url),
    );
    response.cookies.delete(PORTAL_DEV_CONTACT_COOKIE);
    return response;
  }

  let contactId = url.searchParams.get("contactId");
  const customerId = url.searchParams.get("customerId");

  if (!contactId && customerId) {
    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, customerId))
      .limit(1);

    if (customer) {
      const email = customer.email?.trim().toLowerCase() || `dev+${customer.id}@portal.local`;
      const [existing] = await db
        .select()
        .from(schema.customerContacts)
        .where(
          and(
            eq(schema.customerContacts.orgId, customer.orgId),
            eq(schema.customerContacts.email, email),
          ),
        )
        .limit(1);

      const contact =
        existing ??
        (
          await db
            .insert(schema.customerContacts)
            .values({
              orgId: customer.orgId,
              customerId: customer.id,
              email,
              fullName: customer.name,
              isPrimary: true,
            })
            .returning()
        )[0];

      contactId = contact.id;
    }
  }

  if (!contactId) {
    return NextResponse.redirect(
      new URL(`/portal/dev?next=${encodeURIComponent(nextPath)}`, request.url),
    );
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(PORTAL_DEV_CONTACT_COOKIE, contactId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
