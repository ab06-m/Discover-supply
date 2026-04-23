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
import { sql } from "drizzle-orm";
import { organizations } from "../_core/schema";

export const stockMoveKind = pgEnum("stock_move_kind", [
  "receive", // check-in (incoming)
  "commit", // order confirmed — reserves stock
  "release", // order cancelled — frees commit
  "consume", // order delivered — removes from on-hand AND committed
  "adjust", // manual adjustment (count, damage, etc.)
  "return", // customer return
  "transfer", // between locations (future)
]);

export const productUnit = pgEnum("product_unit", [
  "each",
  "case",
  "box",
  "pack",
  "kg",
  "lb",
  "liter",
  "gallon",
]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("categories_org_idx").on(t.orgId) }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    sku: text("sku"),
    barcode: text("barcode"),
    unit: productUnit("unit").notNull().default("each"),
    packSize: integer("pack_size").notNull().default(1), // e.g. 24 for a case of 24
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
    // Split stock — the single source of inventory truth.
    onHand: integer("on_hand").notNull().default(0),
    committed: integer("committed").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(0),
    trackStock: boolean("track_stock").notNull().default(true),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("products_org_idx").on(t.orgId),
    barcodeIdx: index("products_org_barcode_idx").on(t.orgId, t.barcode),
    skuUnique: uniqueIndex("products_org_sku_unique")
      .on(t.orgId, t.sku)
      .where(sql`${t.sku} is not null`),
  }),
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    kind: stockMoveKind("kind").notNull(),
    // For committed moves: affects committed column only.
    // For receive/consume/adjust: affects on_hand.
    // For consume: affects BOTH (-on_hand AND -committed).
    onHandDelta: integer("on_hand_delta").notNull().default(0),
    committedDelta: integer("committed_delta").notNull().default(0),
    referenceType: text("reference_type"), // 'order' | 'receipt' | null
    referenceId: uuid("reference_id"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("stock_mov_org_idx").on(t.orgId),
    productIdx: index("stock_mov_product_idx").on(t.productId),
    refIdx: index("stock_mov_ref_idx").on(t.referenceType, t.referenceId),
  }),
);

// Receipts (check-in batches) — a receipt is a group of stock_movements of kind=receive.
export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    supplierName: text("supplier_name"),
    supplierRef: text("supplier_ref"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("receipts_org_idx").on(t.orgId),
    numberUnique: uniqueIndex("receipts_org_number_unique").on(t.orgId, t.number),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
