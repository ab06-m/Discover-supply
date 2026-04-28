CREATE TABLE IF NOT EXISTS "order_templates" (
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
DO $$ BEGIN
 ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_templates_org_idx" ON "order_templates" USING btree ("org_id");
--> statement-breakpoint
ALTER TABLE public.order_templates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "order_templates staff read" ON public.order_templates FOR SELECT
    USING (org_id IN (SELECT public.current_user_org_ids()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "order_templates staff write" ON public.order_templates FOR ALL
    USING (org_id IN (SELECT public.current_user_org_ids()))
    WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
