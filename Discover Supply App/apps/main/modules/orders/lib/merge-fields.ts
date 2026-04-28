/**
 * Merge-field engine for sales-order templates. Mirrors the invoice merge engine.
 * Missing keys render as empty strings (no leaked braces).
 */

type Ctx = Record<string, unknown>;

function lookup(path: string, ctx: Ctx): string {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return "";
    }
  }
  if (cur == null) return "";
  if (cur instanceof Date) return cur.toLocaleDateString();
  return String(cur);
}

export function renderOrderMergeFields(template: string | undefined | null, ctx: Ctx): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => lookup(key, ctx));
}

export const AVAILABLE_ORDER_MERGE_FIELDS = [
  { key: "org.name", label: "Workspace name" },
  { key: "org.currency", label: "Currency" },
  { key: "customer.name", label: "Customer name" },
  { key: "customer.storeCode", label: "Customer store code" },
  { key: "customer.email", label: "Customer email" },
  { key: "order.number", label: "Order number" },
  { key: "order.date", label: "Order date" },
  { key: "order.subtotal", label: "Order subtotal" },
  { key: "order.total", label: "Order total" },
  { key: "order.notes", label: "Order notes" },
  { key: "order.stage", label: "Order stage" },
] as const;
