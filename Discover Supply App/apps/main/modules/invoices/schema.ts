import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  pgEnum,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "../_core/schema";
import { customers } from "../customers/schema";
import { orders } from "../orders/schema";

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
  "void",
]);

// Invoice templates — multiple per org, user-selectable + customizable.
// `config` holds colors/logo/footer/terms. `layout` picks which renderer to use.
export const invoiceTemplates = pgTable(
  "invoice_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    layout: text("layout").notNull().default("clean"), // 'clean' | 'bold' | 'minimal' | 'classic' | 'receipt'
    isDefault: boolean("is_default").notNull().default(false),
    config: jsonb("config")
      .$type<InvoiceTemplateConfig>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("invoice_templates_org_idx").on(t.orgId) }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => invoiceTemplates.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    issueDate: timestamp("issue_date", { withTimezone: true }).defaultNow().notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    // Snapshot at send time — customer can change later but invoice stays stable.
    customerSnapshot: jsonb("customer_snapshot"),
    itemsSnapshot: jsonb("items_snapshot"),
    notes: text("notes"),
    terms: text("terms"),
    pdfUrl: text("pdf_url"), // cached PDF (optional)
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("invoices_org_idx").on(t.orgId),
    orgCreatedIdx: index("invoices_org_created_idx").on(t.orgId, t.createdAt),
    orgStatusCreatedIdx: index("invoices_org_status_created_idx").on(
      t.orgId,
      t.status,
      t.createdAt,
    ),
    customerIdx: index("invoices_customer_idx").on(t.customerId),
    numberUnique: uniqueIndex("invoices_org_number_unique").on(t.orgId, t.number),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: text("method"), // 'cash' | 'check' | 'ach' | 'card' | 'other'
    reference: text("reference"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
    orgIdx: index("payments_org_idx").on(t.orgId),
  }),
);

// ─── Template config shape ────────────────────────────────────────────────────
export type InvoiceTemplateConfig = {
  brandColor: string; // hex
  accentColor: string;
  fontFamily: "sans" | "serif" | "mono";
  showLogo: boolean;
  logoUrl?: string;
  headerText?: string; // supports merge fields like {{org.name}}
  footerText?: string; // ditto
  termsText?: string;
  showTaxBreakdown: boolean;
  showPaymentInstructions: boolean;
  paymentInstructions?: string;
  dateFormat: "us" | "iso" | "eu";
  showDueDate: boolean;
  showOrderNumber: boolean;
};

export const DEFAULT_INVOICE_TEMPLATE_CONFIG: InvoiceTemplateConfig = {
  brandColor: "#0f172a",
  accentColor: "#3b82f6",
  fontFamily: "sans",
  showLogo: true,
  showTaxBreakdown: true,
  showPaymentInstructions: false,
  dateFormat: "us",
  showDueDate: true,
  showOrderNumber: true,
};

export type Invoice = typeof invoices.$inferSelect;
export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type Payment = typeof payments.$inferSelect;
