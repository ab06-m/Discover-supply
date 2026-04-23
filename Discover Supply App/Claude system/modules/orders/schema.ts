import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "../_core/schema";
import { customers } from "../customers/schema";
import { products } from "../inventory/schema";

// The "effect" a stage triggers on transition. Business logic looks up by effect, NEVER by name.
export const stageEffect = pgEnum("stage_effect", [
  "none",
  "commit", // reserve stock (Confirmed)
  "release", // free reservation (Cancelled)
  "consume", // remove from inventory (Delivered)
  "mark_paid", // flip payment status (Paid)
]);

// Customizable, per-org order pipeline. Each stage has a display name, color, order, and effect.
export const orderStages = pgTable(
  "order_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(), // stable identifier for lookups (e.g. 'draft', 'confirmed')
    color: text("color").notNull().default("#94a3b8"), // tailwind slate-400
    sortOrder: integer("sort_order").notNull().default(0),
    effect: stageEffect("effect").notNull().default("none"),
    isInitial: boolean("is_initial").notNull().default(false), // first stage on new orders
    isTerminal: boolean("is_terminal").notNull().default(false), // order closed at this stage
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("order_stages_org_idx").on(t.orgId),
    slugUnique: uniqueIndex("order_stages_org_slug_unique").on(t.orgId, t.slug),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").references(() => orderStages.id, { onDelete: "restrict" }),
    // Snapshot of the delivery address at order time.
    shippingAddress: jsonb("shipping_address"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    createdBy: uuid("created_by"),
    source: text("source").notNull().default("staff"), // 'staff' | 'storefront' | 'portal'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("orders_org_idx").on(t.orgId),
    stageIdx: index("orders_stage_idx").on(t.stageId),
    customerIdx: index("orders_customer_idx").on(t.customerId),
    numberUnique: uniqueIndex("orders_org_number_unique").on(t.orgId, t.number),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
    orgIdx: index("order_items_org_idx").on(t.orgId),
  }),
);

// Audit log of stage transitions — who moved the order where, and when.
export const orderStageHistory = pgTable(
  "order_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStageId: uuid("from_stage_id"),
    toStageId: uuid("to_stage_id").notNull(),
    changedBy: uuid("changed_by"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdx: index("order_stage_history_order_idx").on(t.orderId),
    orgIdx: index("order_stage_history_org_idx").on(t.orgId),
  }),
);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStage = typeof orderStages.$inferSelect;
export type StageEffect = (typeof stageEffect.enumValues)[number];
