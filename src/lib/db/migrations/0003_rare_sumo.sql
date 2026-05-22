CREATE TYPE "public"."backup_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_type" AS ENUM('client', 'technical', 'full');--> statement-breakpoint
CREATE TABLE "backup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "backup_type" NOT NULL,
	"status" "backup_status" DEFAULT 'running' NOT NULL,
	"triggered_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"size_bytes" bigint,
	"s3_key" varchar(500),
	"s3_bucket" varchar(200),
	"error" text,
	"table_count" integer
);
--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_jobs_status_idx" ON "backup_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_jobs_type_idx" ON "backup_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "backup_jobs_started_at_idx" ON "backup_jobs" USING btree ("started_at");