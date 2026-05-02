/**
 * Centralized authorization. Every business action goes through `can(role, action)`.
 *
 * Roles (fixed for now):
 *   super_admin → everything, including billing/team/settings
 *   admin       → everything inside the org except destructive super-admin actions
 *   office      → sales desk: customers, orders, invoices, reports — no stock ops, no delivery
 *   warehouse   → stock receiving/adjustments, pack orders, assign dispatches
 *   driver      → deliveries: read assigned orders, mark delivered with proof
 */

export type Role = "super_admin" | "admin" | "office" | "warehouse" | "driver";

export type Action =
  // inventory
  | "product.read"
  | "product.write"
  | "category.write"
  | "stock.read"
  | "stock.receive"
  | "stock.adjust"
  // customers
  | "customer.read"
  | "customer.write"
  // orders
  | "order.read"
  | "order.create"
  | "order.edit"
  | "order.advance_stage"
  | "order.cancel"
  // invoices
  | "invoice.read"
  | "invoice.create"
  | "invoice.send"
  | "invoice.record_payment"
  | "invoice.void"
  // dispatch
  | "dispatch.read"
  | "dispatch.assign"
  | "dispatch.deliver"
  // reports
  | "report.read"
  // settings — admin/super_admin-scoped
  | "settings.read"
  | "settings.write"
  | "team.manage"
  | "template.manage"
  | "pipeline.manage"
  // super-admin-only
  | "billing.manage"
  | "org.delete";

const STAFF_READ: Action[] = [
  "product.read",
  "stock.read",
  "customer.read",
  "order.read",
  "invoice.read",
  "dispatch.read",
  "report.read",
];

const ADMIN_ACTIONS: Action[] = [
  ...STAFF_READ,
  "product.write",
  "category.write",
  "stock.receive",
  "stock.adjust",
  "customer.write",
  "order.create",
  "order.edit",
  "order.advance_stage",
  "order.cancel",
  "invoice.create",
  "invoice.send",
  "invoice.record_payment",
  "invoice.void",
  "dispatch.assign",
  "dispatch.deliver",
  "settings.read",
  "settings.write",
  "team.manage",
  "template.manage",
  "pipeline.manage",
];

const MATRIX: Record<Role, Action[] | "*"> = {
  super_admin: "*",
  admin: ADMIN_ACTIONS,
  office: [
    ...STAFF_READ,
    "customer.write",
    "order.create",
    "order.edit",
    "order.advance_stage",
    "order.cancel",
    "invoice.create",
    "invoice.send",
    "invoice.record_payment",
  ],
  warehouse: [
    ...STAFF_READ,
    "product.write",
    "category.write",
    "stock.receive",
    "stock.adjust",
    "order.advance_stage",
    "dispatch.assign",
  ],
  driver: ["order.read", "dispatch.read", "dispatch.deliver"],
};

export function can(role: Role | null | undefined, action: Action): boolean {
  if (!role) return false;
  const allowed = MATRIX[role];
  if (allowed === "*") return true;
  return allowed.includes(action);
}

export function assertCan(role: Role | null | undefined, action: Action): void {
  if (!can(role, action)) {
    throw new Error(`Forbidden: role '${role ?? "none"}' cannot '${action}'`);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  office: "Office",
  warehouse: "Warehouse",
  driver: "Driver",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full access, including billing and deleting the workspace.",
  admin: "Manage everything inside the workspace — team, settings, templates.",
  office: "Customers, orders, invoices and reports. No stock or delivery actions.",
  warehouse: "Receive stock, pack orders, and assign deliveries.",
  driver: "Deliver orders and capture proof of delivery.",
};
