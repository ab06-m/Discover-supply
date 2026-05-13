import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCatalogOrg } from "@/lib/catalog-org";

export const dynamic = "force-dynamic";

const lookupSchema = z
  .object({
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(40).optional().or(z.literal("")),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Enter an email or telephone number.",
  });

function cleanEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return email || null;
}

function cleanPhone(value: string | undefined) {
  const phone = value?.trim() ?? "";
  return phone || null;
}

function phoneDigits(value: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function POST(request: Request) {
  const org = await getCatalogOrg();
  const orgId = org.id;

  const parsed = lookupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an email or telephone number." }, { status: 400 });
  }

  const email = cleanEmail(parsed.data.email);
  const phone = cleanPhone(parsed.data.phone);
  const digits = phoneDigits(phone);
  const matchers = [];

  if (email) {
    matchers.push(sql`lower(${schema.customers.email}) = ${email}`);
    matchers.push(sql`exists (
      select 1 from ${schema.customerContacts}
      where ${schema.customerContacts.orgId} = ${orgId}
        and ${schema.customerContacts.customerId} = ${schema.customers.id}
        and lower(${schema.customerContacts.email}) = ${email}
    )`);
  }

  if (digits) {
    matchers.push(
      sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') = ${digits}`,
    );
  }

  const [customer] = await db
    .select({
      id: schema.customers.id,
      name: schema.customers.name,
    })
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.orgId, orgId),
        eq(schema.customers.isActive, true),
        or(...matchers),
      ),
    )
    .limit(1);

  if (!customer) {
    return NextResponse.json(
      { error: "No customer found for that email or telephone." },
      { status: 404 },
    );
  }

  return NextResponse.json({ customer });
}
