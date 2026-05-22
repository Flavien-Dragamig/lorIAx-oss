DO $$ BEGIN ALTER TYPE "public"."meeting_status" ADD VALUE 'mapping' BEFORE 'summarizing'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meeting_type" varchar(20) DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "participants" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "speaker_mapping" jsonb DEFAULT '{}'::jsonb;