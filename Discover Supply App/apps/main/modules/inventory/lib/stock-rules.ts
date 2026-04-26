import { z } from "zod";

const orgSettingsSchema = z
  .object({
    inventory: z
      .object({
        lowStockThreshold: z.coerce.number().int().min(0).optional(),
      })
      .optional(),
  })
  .passthrough();

export type StockStatus = "good" | "low" | "out";

export function getInventorySettings(settings: Record<string, unknown> | null | undefined) {
  const parsed = orgSettingsSchema.safeParse(settings ?? {});
  const lowStockThreshold =
    parsed.success ? parsed.data.inventory?.lowStockThreshold ?? 0 : 0;

  return {
    defaultLowStockThreshold: lowStockThreshold,
  };
}

export function resolveLowStockThreshold(
  productLowStockThreshold: number | null | undefined,
  defaultLowStockThreshold: number,
) {
  return productLowStockThreshold ?? defaultLowStockThreshold;
}

export function getStockStatus(
  available: number,
  lowStockThreshold: number,
): StockStatus {
  if (available <= 0) return "out";
  if (available <= lowStockThreshold) return "low";
  return "good";
}
