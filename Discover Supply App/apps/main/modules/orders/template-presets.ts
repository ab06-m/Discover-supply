import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { OrderTemplateConfig } from "./schema";
import { isMissingOrderTemplatesTable } from "./template-db";

export type OrderTemplateLayout = "clean" | "bold" | "classic" | "receipt";

export type OrderTemplatePreset = {
  key: string;
  name: string;
  layout: OrderTemplateLayout;
  isDefault: boolean;
  description: string;
  config: OrderTemplateConfig;
};

export const ORDER_TEMPLATE_LAYOUTS: Array<{ value: OrderTemplateLayout; label: string }> = [
  { value: "clean", label: "Modern" },
  { value: "bold", label: "Bold" },
  { value: "classic", label: "Classic" },
  { value: "receipt", label: "Receipt" },
];

export const ORDER_TEMPLATE_PRESETS: OrderTemplatePreset[] = [
  {
    key: "modern",
    name: "Modern",
    layout: "clean",
    isDefault: true,
    description: "Airy, modern sales order with a strong totals card.",
    config: {
      brandColor: "#1e40af",
      accentColor: "#3b82f6",
      fontFamily: "sans",
      showLogo: true,
      headerText: "Sales order from {{org.name}}.",
      footerText: "Questions about this order? Reach out and we will help.",
      termsText: "Order is valid for 14 days from {{order.date}}.",
      showTaxBreakdown: true,
      dateFormat: "us",
      showOrderNumber: true,
      showCustomerAddress: true,
      showSignatureBlock: false,
    },
  },
  {
    key: "bold",
    name: "Bold",
    layout: "bold",
    isDefault: false,
    description: "High-contrast header for confident, branded sales orders.",
    config: {
      brandColor: "#0f172a",
      accentColor: "#f97316",
      fontFamily: "sans",
      showLogo: true,
      footerText: "{{org.name}} appreciates your business.",
      termsText: "Subject to standard terms and conditions.",
      showTaxBreakdown: true,
      dateFormat: "us",
      showOrderNumber: true,
      showCustomerAddress: true,
      showSignatureBlock: true,
    },
  },
  {
    key: "classic",
    name: "Classic",
    layout: "classic",
    isDefault: false,
    description: "Formal sales order with restrained dividers and serif type.",
    config: {
      brandColor: "#1f2937",
      accentColor: "#2563eb",
      fontFamily: "serif",
      showLogo: true,
      footerText: "Thank you for your business.",
      termsText: "Goods remain property of {{org.name}} until paid in full.",
      showTaxBreakdown: true,
      dateFormat: "us",
      showOrderNumber: true,
      showCustomerAddress: true,
      showSignatureBlock: true,
    },
  },
  {
    key: "receipt",
    name: "Receipt",
    layout: "receipt",
    isDefault: false,
    description: "Compact receipt-style sales order for quick confirmations.",
    config: {
      brandColor: "#334155",
      accentColor: "#059669",
      fontFamily: "mono",
      showLogo: true,
      footerText: "Order confirmed by {{org.name}}.",
      termsText: "",
      showTaxBreakdown: true,
      dateFormat: "us",
      showOrderNumber: true,
      showCustomerAddress: false,
      showSignatureBlock: false,
    },
  },
];

export async function ensureOrderTemplatePresets(orgId: string) {
  let existing: Array<{ id: string; name: string; isDefault: boolean }>;

  try {
    existing = await db
      .select({
        id: schema.orderTemplates.id,
        name: schema.orderTemplates.name,
        isDefault: schema.orderTemplates.isDefault,
      })
      .from(schema.orderTemplates)
      .where(eq(schema.orderTemplates.orgId, orgId));
  } catch (error) {
    if (isMissingOrderTemplatesTable(error)) return false;
    throw error;
  }

  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
  const hasDefault = existing.some((t) => t.isDefault);

  const rowsToInsert = ORDER_TEMPLATE_PRESETS.filter(
    (p) => !existingNames.has(p.name.toLowerCase()),
  ).map((p) => ({
    orgId,
    name: p.name,
    layout: p.layout,
    isDefault: p.isDefault && !hasDefault,
    config: p.config,
  }));

  if (rowsToInsert.length > 0) {
    await db.insert(schema.orderTemplates).values(rowsToInsert);
  }

  if (!hasDefault && !rowsToInsert.some((r) => r.isDefault)) {
    const modern = await db
      .select({ id: schema.orderTemplates.id })
      .from(schema.orderTemplates)
      .where(
        and(eq(schema.orderTemplates.orgId, orgId), eq(schema.orderTemplates.name, "Modern")),
      )
      .limit(1);
    if (modern[0]) {
      await db
        .update(schema.orderTemplates)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(schema.orderTemplates.orgId, orgId),
            eq(schema.orderTemplates.id, modern[0].id),
          ),
        );
    }
  }

  return true;
}
