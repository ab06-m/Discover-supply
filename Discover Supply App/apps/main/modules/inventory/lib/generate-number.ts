/**
 * Generate a per-org sequential document number.
 * Format: `<prefix>-<YYYYMM>-<seq>` where seq is the count+1 of rows
 * this month. Good enough for MVP; switch to a per-org sequence table
 * if collisions become an issue under concurrent writes.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { PgTable } from "drizzle-orm/pg-core";

export async function generateDocNumber(params: {
  table: PgTable & { orgId: any; createdAt: any };
  orgId: string;
  prefix: string;
}) {
  const { table, orgId, prefix } = params;
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(and(eq(table.orgId, orgId), gte(table.createdAt, startOfMonth)));
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${ym}-${seq}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  const err = error as { code?: unknown; cause?: unknown; message?: unknown };
  if (err.code === "23505") return true;
  if (typeof err.message === "string" && err.message.includes("duplicate key value")) {
    return true;
  }
  return err.cause ? isUniqueConstraintError(err.cause) : false;
}

export async function withDocumentNumberRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}
