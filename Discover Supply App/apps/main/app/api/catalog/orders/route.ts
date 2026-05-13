import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCatalogOrg } from "@/lib/catalog-org";
import { generateDocNumber, withDocumentNumberRetry } from "@/modules/inventory/lib/generate-number";
import { getInitialStage } from "@/modules/orders/queries";

export const dynamic = "force-dynamic";

const catalogOrderSource = "catalog_order";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
});

const matchCustomerSchema = z.object({
  mode: z.literal("match"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
});

const newCustomerSchema = z.object({
  mode: z.literal("new"),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
});

const catalogOrderSchema = z
  .object({
    items: z.array(cartItemSchema).min(1),
    customer: z.discriminatedUnion("mode", [matchCustomerSchema, newCustomerSchema]),
  })
  .superRefine((value, ctx) => {
    if (!value.customer.email && !value.customer.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer"],
        message: "Enter an email or telephone number.",
      });
    }
  });

async function getDraftStage(orgId: string) {
  const [draft] = await db
    .select()
    .from(schema.orderStages)
    .where(and(eq(schema.orderStages.orgId, orgId), eq(schema.orderStages.slug, "draft")))
    .limit(1);

  return draft ?? (await getInitialStage(orgId));
}

function toMoney(value: number) {
  return value.toFixed(2);
}

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

async function findCatalogCustomer(
  orgId: string,
  input: { email?: string | null; phone?: string | null },
) {
  const email = cleanEmail(input.email ?? undefined);
  const phone = cleanPhone(input.phone ?? undefined);
  const digits = phoneDigits(phone);
  const matchers = [];

  if (email) {
    matchers.push(sql`lower(${schema.customers.email}) = ${email}`);
  }

  if (digits) {
    matchers.push(
      sql`regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g') = ${digits}`,
    );
  }

  const contactMatcher = email
    ? sql`exists (
        select 1 from ${schema.customerContacts}
        where ${schema.customerContacts.orgId} = ${orgId}
          and ${schema.customerContacts.customerId} = ${schema.customers.id}
          and lower(${schema.customerContacts.email}) = ${email}
      )`
    : null;

  if (contactMatcher) {
    matchers.push(contactMatcher);
  }

  if (matchers.length === 0) return null;

  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.orgId, orgId),
        eq(schema.customers.isActive, true),
        or(...matchers),
      ),
    )
    .limit(1);

  return customer ?? null;
}

async function resolveCatalogCustomer(
  orgId: string,
  input: z.infer<typeof catalogOrderSchema>["customer"],
) {
  const email = cleanEmail(input.email);
  const phone = cleanPhone(input.phone);
  const existing = await findCatalogCustomer(orgId, { email, phone });

  if (existing) {
    return { customer: existing, status: "matched" as const };
  }

  if (input.mode === "match") {
    throw new Error("No customer found for that email or telephone. Use New customer to sign up.");
  }

  const [customer] = await db
    .insert(schema.customers)
    .values({
      orgId,
      name: input.name.trim(),
      email,
      phone,
      paymentTerms: "net30",
      notes: "Created from catalog checkout.",
    })
    .returning();

  if (email) {
    await db
      .insert(schema.customerContacts)
      .values({
        orgId,
        customerId: customer.id,
        email,
        fullName: input.name.trim(),
        isPrimary: true,
      })
      .onConflictDoNothing();
  }

  return { customer, status: "created" as const };
}

export async function POST(request: Request) {
  const org = await getCatalogOrg();
  const orgId = org.id;

  const parsed = catalogOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Add at least one valid item to the cart." }, { status: 400 });
  }

  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const productIds = Array.from(quantities.keys());
  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      sku: schema.products.sku,
      price: schema.products.price,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.orgId, orgId),
        eq(schema.products.isActive, true),
        eq(schema.products.showInOnlineStore, true),
        inArray(schema.products.id, productIds),
      ),
    );

  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: "One or more catalog items are no longer available." },
      { status: 409 },
    );
  }

  const stage = await getDraftStage(orgId);
  if (!stage) {
    return NextResponse.json({ error: "Order stages are not configured." }, { status: 503 });
  }

  let subtotal = 0;
  const lines = products.map((product) => {
    const quantity = quantities.get(product.id) ?? 0;
    const unitPrice = Number.parseFloat(product.price);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));
    subtotal += lineTotal;

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice,
      lineTotal,
    };
  });

  const total = Number(subtotal.toFixed(2));
  let customerResult: Awaited<ReturnType<typeof resolveCatalogCustomer>>;
  try {
    customerResult = await resolveCatalogCustomer(orgId, parsed.data.customer);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Customer lookup failed." },
      { status: 404 },
    );
  }

  const order = await withDocumentNumberRetry(async () => {
    const number = await generateDocNumber({
      table: schema.orders,
      orgId,
      prefix: "SO",
    });

    return db.transaction(async (tx) => {
      const [createdOrder] = await tx
        .insert(schema.orders)
        .values({
          orgId,
          number,
          customerId: customerResult.customer.id,
          stageId: stage.id,
          shippingAddress: (customerResult.customer.shippingAddress ?? null) as any,
          subtotal: toMoney(subtotal),
          taxTotal: "0.00",
          discountTotal: "0.00",
          total: toMoney(total),
          amountPaid: "0.00",
          notes: `Catalog order submitted by ${customerResult.customer.name}.`,
          internalNotes:
            customerResult.status === "created"
              ? "Catalog order - new customer created"
              : "Catalog order - existing customer matched",
          createdBy: null,
          source: catalogOrderSource,
        })
        .returning({ id: schema.orders.id, number: schema.orders.number });

      await tx.insert(schema.orderItems).values(
        lines.map((line) => ({
          orgId,
          orderId: createdOrder.id,
          productId: line.productId,
          name: line.name,
          sku: line.sku,
          quantity: line.quantity,
          quantityInput: line.quantity,
          unitOfMeasure: "each" as const,
          packSize: 1,
          unitPrice: toMoney(line.unitPrice),
          discount: "0.00",
          taxRate: "0.0000",
          lineTotal: toMoney(line.lineTotal),
        })),
      );

      await tx.insert(schema.orderStageHistory).values({
        orgId,
        orderId: createdOrder.id,
        fromStageId: null,
        toStageId: stage.id,
        changedBy: null,
        note: "Catalog order created",
      });

      return createdOrder;
    });
  });

  return NextResponse.json(
    {
      id: order.id,
      number: order.number,
      source: catalogOrderSource,
      customerStatus: customerResult.status,
    },
    { status: 201 },
  );
}
