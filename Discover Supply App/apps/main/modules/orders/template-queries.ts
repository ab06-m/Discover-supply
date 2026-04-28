import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isMissingOrderTemplatesTable } from "./template-db";

export async function listOrderTemplates(orgId: string) {
  try {
    return await db
      .select()
      .from(schema.orderTemplates)
      .where(eq(schema.orderTemplates.orgId, orgId))
      .orderBy(desc(schema.orderTemplates.isDefault), asc(schema.orderTemplates.createdAt));
  } catch (error) {
    if (isMissingOrderTemplatesTable(error)) return [];
    throw error;
  }
}

export async function getOrderTemplate(orgId: string, id: string) {
  try {
    const rows = await db
      .select()
      .from(schema.orderTemplates)
      .where(and(eq(schema.orderTemplates.orgId, orgId), eq(schema.orderTemplates.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingOrderTemplatesTable(error)) return null;
    throw error;
  }
}

export async function getDefaultOrderTemplate(orgId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.orderTemplates)
      .where(and(eq(schema.orderTemplates.orgId, orgId), eq(schema.orderTemplates.isDefault, true)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingOrderTemplatesTable(error)) return null;
    throw error;
  }
}
