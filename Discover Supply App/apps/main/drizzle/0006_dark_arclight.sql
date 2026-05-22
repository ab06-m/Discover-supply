CREATE TYPE "public"."movement_unit" AS ENUM('each', 'box');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('goods', 'service');--> statement-breakpoint
CREATE TABLE "order_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"subject_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"layout" text DEFAULT 'clean' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "low_stock_threshold" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "low_stock_threshold" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "kind" "product_kind" DEFAULT 'goods' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sales_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "purchase_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vendor" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_gallery" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "returnable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "show_in_online_store" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "quantity_input" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_of_measure" "movement_unit";--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "pack_size" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_input" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_of_measure" "movement_unit";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "pack_size" integer;--> statement-breakpoint
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_activity_order_idx" ON "order_activity" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_activity_org_idx" ON "order_activity" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "order_templates_org_idx" ON "order_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "customers_org_created_idx" ON "customers" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_created_idx" ON "orders" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_stage_created_idx" ON "orders" USING btree ("org_id","stage_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_org_created_idx" ON "invoices" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_org_status_created_idx" ON "invoices" USING btree ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX "dispatches_org_scheduled_idx" ON "dispatches" USING btree ("org_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "dispatches_org_status_scheduled_idx" ON "dispatches" USING btree ("org_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "dispatches_driver_scheduled_idx" ON "dispatches" USING btree ("driver_id","scheduled_at");