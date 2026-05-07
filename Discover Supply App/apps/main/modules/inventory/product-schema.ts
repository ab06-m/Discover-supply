import { z } from "zod";

export const productSchema = z.object({
  categoryId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  kind: z.enum(["goods", "service"]).default("goods"),
  name: z.string().min(1).max(200),
  brand: z.string().max(120).optional().or(z.literal("")),
  vendor: z.string().max(200).optional().or(z.literal("")),
  sku: z.string().max(64).optional().or(z.literal("")),
  barcode: z.string().max(64).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  salesDescription: z.string().max(2000).optional().or(z.literal("")),
  purchaseDescription: z.string().max(2000).optional().or(z.literal("")),
  unit: z.enum(["each", "case", "box", "pack", "kg", "lb", "liter", "gallon"]).default("each"),
  packSize: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  lowStockThreshold: z.preprocess(
    (value) => {
      if (value == null) return null;
      const text = String(value).trim();
      return text === "" ? null : text;
    },
    z.coerce.number().int().min(0).nullable(),
  ),
  trackStock: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  returnable: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  showInOnlineStore: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
});
