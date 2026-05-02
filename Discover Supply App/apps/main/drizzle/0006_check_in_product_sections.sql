DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_kind') THEN
    CREATE TYPE "product_kind" AS ENUM ('goods', 'service');
  END IF;
END$$;
--> statement-breakpoint
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "kind" "product_kind" NOT NULL DEFAULT 'goods',
  ADD COLUMN IF NOT EXISTS "sales_description" text,
  ADD COLUMN IF NOT EXISTS "purchase_description" text,
  ADD COLUMN IF NOT EXISTS "brand" text,
  ADD COLUMN IF NOT EXISTS "vendor" text,
  ADD COLUMN IF NOT EXISTS "image_gallery" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "returnable" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "show_in_online_store" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE "products"
SET "show_in_online_store" = true
WHERE "show_in_online_store" = false;
