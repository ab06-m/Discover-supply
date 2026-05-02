-- Phase 1 of inventory enhancement: lets users receive and sell either by the
-- individual unit ("each") or by the box (with a per-line packSize multiplier).
-- `on_hand` and `quantity` stay in base units; the new columns are an audit
-- trail of how the qty was entered. Existing rows have NULL on the new columns
-- and are interpreted as `each` with packSize=1 by display helpers.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_unit') THEN
    CREATE TYPE "movement_unit" AS ENUM ('each', 'box');
  END IF;
END$$;
--> statement-breakpoint
ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "quantity_input" integer,
  ADD COLUMN IF NOT EXISTS "unit_of_measure" "movement_unit",
  ADD COLUMN IF NOT EXISTS "pack_size" integer;
--> statement-breakpoint
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "quantity_input" integer,
  ADD COLUMN IF NOT EXISTS "unit_of_measure" "movement_unit",
  ADD COLUMN IF NOT EXISTS "pack_size" integer;
