export function isMissingOrderTemplatesTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "42P01" ||
    err.message?.includes('relation "order_templates" does not exist') === true ||
    err.message?.includes("order_templates") === true
  );
}

export const ORDER_TEMPLATES_MIGRATION_MESSAGE =
  "Sales order templates are not available until the order_templates migration is applied.";
