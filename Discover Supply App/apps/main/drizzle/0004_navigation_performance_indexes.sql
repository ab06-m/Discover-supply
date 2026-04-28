CREATE INDEX IF NOT EXISTS "customers_org_created_idx"
  ON "customers" USING btree ("org_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_org_created_idx"
  ON "orders" USING btree ("org_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_org_stage_created_idx"
  ON "orders" USING btree ("org_id", "stage_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_created_idx"
  ON "invoices" USING btree ("org_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_status_created_idx"
  ON "invoices" USING btree ("org_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatches_org_scheduled_idx"
  ON "dispatches" USING btree ("org_id", "scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatches_org_status_scheduled_idx"
  ON "dispatches" USING btree ("org_id", "status", "scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatches_driver_scheduled_idx"
  ON "dispatches" USING btree ("driver_id", "scheduled_at");
