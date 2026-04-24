import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "../_core/schema";
import { orders } from "../orders/schema";

export const dispatchStatus = pgEnum("dispatch_status", [
  "pending",
  "assigned",
  "loaded",
  "in_transit",
  "delivered",
  "failed",
  "returned",
]);

export const dispatches = pgTable(
  "dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    driverId: uuid("driver_id"),
    status: dispatchStatus("status").notNull().default("pending"),
    pickupAddress: jsonb("pickup_address"),
    deliveryAddress: jsonb("delivery_address"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    // Proof of delivery
    proofImageUrl: text("proof_image_url"),
    signatureUrl: text("signature_url"),
    recipientName: text("recipient_name"),
    deliveryNotes: text("delivery_notes"),
    // Route
    routeSequence: numeric("route_sequence", { precision: 6, scale: 2 }),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("dispatches_org_idx").on(t.orgId),
    driverIdx: index("dispatches_driver_idx").on(t.driverId),
    orderIdx: index("dispatches_order_idx").on(t.orderId),
  }),
);

export type Dispatch = typeof dispatches.$inferSelect;
