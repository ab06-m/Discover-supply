/**
 * Schema aggregator — Drizzle needs a single schema import.
 * Every module contributes its tables here. Add new modules by re-exporting below.
 */
export * from "@/modules/_core/schema";
export * from "@/modules/inventory/schema";
export * from "@/modules/customers/schema";
export * from "@/modules/orders/schema";
export * from "@/modules/invoices/schema";
export * from "@/modules/dispatch/schema";
