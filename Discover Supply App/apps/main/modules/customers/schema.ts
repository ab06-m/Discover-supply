import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "../_core/schema";

// A "customer" in a distributor context = a store / business buying from the org.
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    storeCode: text("store_code"),
    email: text("email"),
    phone: text("phone"),
    billingAddress: jsonb("billing_address").$type<Address>(),
    shippingAddress: jsonb("shipping_address").$type<Address>(),
    taxId: text("tax_id"),
    paymentTerms: text("payment_terms").default("net30"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("customers_org_idx").on(t.orgId),
    orgCreatedIdx: index("customers_org_created_idx").on(t.orgId, t.createdAt),
    storeCodeIdx: uniqueIndex("customers_org_store_code_idx")
      .on(t.orgId, t.storeCode),
  }),
);

// Customer contacts = user logins for the customer portal & storefront.
// Separate from `memberships` (staff) on purpose.
export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    userId: uuid("user_id"), // nullable until they accept the invite / first login
    email: text("email").notNull(),
    fullName: text("full_name"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("customer_contacts_org_idx").on(t.orgId),
    userIdx: index("customer_contacts_user_idx").on(t.userId),
    emailUnique: uniqueIndex("customer_contacts_org_email_unique").on(t.orgId, t.email),
  }),
);

export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type Customer = typeof customers.$inferSelect;
export type CustomerContact = typeof customerContacts.$inferSelect;
