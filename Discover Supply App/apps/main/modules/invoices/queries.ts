import { db, schema } from "@/lib/db";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";

export async function listInvoices(
  orgId: string,
  opts: { search?: string; status?: string; customerId?: string } = {},
) {
  const { search, status, customerId } = opts;
  const conditions = [eq(schema.invoices.orgId, orgId)];
  if (status) conditions.push(eq(schema.invoices.status, status as any));
  if (customerId) conditions.push(eq(schema.invoices.customerId, customerId));
  if (search) {
    const w = or(
      ilike(schema.invoices.number, `%${search}%`),
      ilike(schema.customers.name, `%${search}%`),
    );
    if (w) conditions.push(w);
  }

  return db
    .select({
      id: schema.invoices.id,
      number: schema.invoices.number,
      status: schema.invoices.status,
      total: schema.invoices.total,
      amountPaid: schema.invoices.amountPaid,
      issueDate: schema.invoices.issueDate,
      dueDate: schema.invoices.dueDate,
      customerId: schema.invoices.customerId,
      customerName: schema.customers.name,
      storeCode: schema.customers.storeCode,
    })
    .from(schema.invoices)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.invoices.customerId))
    .where(and(...conditions))
    .orderBy(desc(schema.invoices.createdAt));
}

export async function getInvoice(orgId: string, id: string) {
  const rows = await db
    .select({
      invoice: schema.invoices,
      customer: schema.customers,
      template: schema.invoiceTemplates,
    })
    .from(schema.invoices)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.invoices.customerId))
    .leftJoin(schema.invoiceTemplates, eq(schema.invoiceTemplates.id, schema.invoices.templateId))
    .where(and(eq(schema.invoices.orgId, orgId), eq(schema.invoices.id, id)))
    .limit(1);
  if (!rows.length) return null;
  const payments = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.invoiceId, id))
    .orderBy(desc(schema.payments.receivedAt));
  return { ...rows[0], payments };
}

export async function listTemplates(orgId: string) {
  return db
    .select()
    .from(schema.invoiceTemplates)
    .where(eq(schema.invoiceTemplates.orgId, orgId))
    .orderBy(desc(schema.invoiceTemplates.isDefault), asc(schema.invoiceTemplates.createdAt));
}

export async function getInvoiceByToken(token: string) {
  const t = await db
    .select()
    .from(schema.accessTokens)
    .where(eq(schema.accessTokens.token, token))
    .limit(1);
  if (!t.length) return null;
  const row = t[0];
  if (row.entityType !== "invoice") return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;
  if (row.maxUses != null && row.uses >= row.maxUses) return null;

  const invoice = await db
    .select({
      invoice: schema.invoices,
      customer: schema.customers,
      template: schema.invoiceTemplates,
      org: schema.organizations,
    })
    .from(schema.invoices)
    .leftJoin(schema.customers, eq(schema.customers.id, schema.invoices.customerId))
    .leftJoin(schema.invoiceTemplates, eq(schema.invoiceTemplates.id, schema.invoices.templateId))
    .leftJoin(schema.organizations, eq(schema.organizations.id, schema.invoices.orgId))
    .where(eq(schema.invoices.id, row.entityId))
    .limit(1);
  if (!invoice.length) return null;
  return { ...invoice[0], tokenId: row.id };
}
