CREATE TYPE "public"."meeting_room_booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_room_principal_type" AS ENUM('user', 'team', 'role');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('document_item', 'gantt_event');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'meeting_room_cancelled';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'chat_message';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'task_assigned';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'facility_manager';--> statement-breakpoint
CREATE TABLE "image_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"api_key_enc" varchar(1024),
	"is_enabled" boolean DEFAULT false NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_room_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"attendees" jsonb DEFAULT '[]' NOT NULL,
	"status" "meeting_room_booking_status" DEFAULT 'confirmed' NOT NULL,
	"calendar_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_room_permissions" (
	"room_id" uuid NOT NULL,
	"principal_type" "meeting_room_principal_type" NOT NULL,
	"principal_id" varchar(64) NOT NULL,
	"can_book" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_room_permissions_room_id_principal_type_principal_id_pk" PRIMARY KEY("room_id","principal_type","principal_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"floor" varchar(100),
	"capacity" integer DEFAULT 0 NOT NULL,
	"description" text,
	"photo_key" varchar(512),
	"floor_plan_key" varchar(512),
	"opening_hours" jsonb DEFAULT '{"mon":[{"from":"08:00","to":"19:00"}],"tue":[{"from":"08:00","to":"19:00"}],"wed":[{"from":"08:00","to":"19:00"}],"thu":[{"from":"08:00","to":"19:00"}],"fri":[{"from":"08:00","to":"19:00"}],"sat":[],"sun":[]}' NOT NULL,
	"equipment" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mindmap_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mindmap_id" text NOT NULL,
	"data" text NOT NULL,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mindmap_snapshots_mindmap_id_unique" UNIQUE("mindmap_id")
);
--> statement-breakpoint
CREATE TABLE "studio_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"s3_key" varchar(1024) NOT NULL,
	"content_type" varchar(100) DEFAULT 'image/jpeg' NOT NULL,
	"size_bytes" integer,
	"organization_id" uuid NOT NULL,
	"space_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "task_kind" NOT NULL,
	"title" varchar(500) NOT NULL,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"assignee_id" uuid,
	"created_by" uuid NOT NULL,
	"document_id" uuid,
	"node_id" varchar(100),
	"calendar_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_status" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"custom_emoji" text,
	"custom_text" varchar(100),
	"custom_expires_at" timestamp with time zone,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_whiteboard_library" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"library_items" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whiteboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" text NOT NULL,
	"snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whiteboard_snapshots_canvas_id_unique" UNIQUE("canvas_id")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'community' NOT NULL,
	"license_key" varchar(512),
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_spaces" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "user_database_columns" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_database_columns" ALTER COLUMN "type" SET DEFAULT 'text'::text;--> statement-breakpoint
DROP TYPE "public"."column_type";--> statement-breakpoint
CREATE TYPE "public"."column_type" AS ENUM('text', 'number', 'date', 'formula', 'select', 'checkbox', 'relation', 'image', 'url', 'email', 'attachment', 'time');--> statement-breakpoint
ALTER TABLE "user_database_columns" ALTER COLUMN "type" SET DEFAULT 'text'::"public"."column_type";--> statement-breakpoint
ALTER TABLE "user_database_columns" ALTER COLUMN "type" SET DATA TYPE "public"."column_type" USING "type"::"public"."column_type";--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "meeting_room_id" uuid;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "image_providers" ADD CONSTRAINT "image_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_room_id_meeting_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_room_permissions" ADD CONSTRAINT "meeting_room_permissions_room_id_meeting_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."meeting_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_images" ADD CONSTRAINT "studio_images_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_images" ADD CONSTRAINT "studio_images_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_images" ADD CONSTRAINT "studio_images_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status" ADD CONSTRAINT "user_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_whiteboard_library" ADD CONSTRAINT "user_whiteboard_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_image_providers_org" ON "image_providers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_room_range" ON "meeting_room_bookings" USING btree ("room_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_user" ON "meeting_room_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_status" ON "meeting_room_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_event" ON "meeting_room_bookings" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_room_perms_principal" ON "meeting_room_permissions" USING btree ("principal_type","principal_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_room_perms_room" ON "meeting_room_permissions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_rooms_active" ON "meeting_rooms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_meeting_rooms_name" ON "meeting_rooms" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_studio_images_org" ON "studio_images" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_studio_images_space" ON "studio_images" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee_status" ON "tasks" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_document" ON "tasks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_calendar_event" ON "tasks" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tasks_document_node" ON "tasks" USING btree ("document_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_user_status_last_seen" ON "user_status" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "idx_org_members_user" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_meeting_room_id_meeting_rooms_id_fk" FOREIGN KEY ("meeting_room_id") REFERENCES "public"."meeting_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_providers_org" ON "ai_providers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_meeting_room" ON "calendar_events" USING btree ("meeting_room_id");--> statement-breakpoint
CREATE INDEX "idx_spaces_org" ON "spaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_teams_org" ON "teams" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_org" ON "webhooks" USING btree ("organization_id");