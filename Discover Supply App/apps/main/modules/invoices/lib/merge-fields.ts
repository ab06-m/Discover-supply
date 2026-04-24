/**
 * Merge-field engine for invoice templates. User-written header/footer/terms text
 * can reference `{{org.name}}`, `{{customer.name}}`, `{{invoice.number}}`, etc.
 * Missing keys render as empty string (no leaked braces).
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

export function renderMergeFields(template: string | undefined | null, ctx: Ctx): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => lookup(key, ctx));
}

export const AVAILABLE_MERGE_FIELDS = [
  { key: "org.name", label: "Workspace name" },
  { key: "org.currency", label: "Currency" },
  { key: "customer.name", label: "Customer name" },
  { key: "customer.storeCode", label: "Customer store code" },
  { key: "customer.email", label: "Customer email" },
  { key: "invoice.number", label: "Invoice number" },
  { key: "invoice.issueDate", label: "Issue date" },
  { key: "invoice.dueDate", label: "Due date" },
  { key: "invoice.total", label: "Invoice total" },
  { key: "invoice.balance", label: "Balance due" },
  { key: "order.number", label: "Related order number" },
] as const;
