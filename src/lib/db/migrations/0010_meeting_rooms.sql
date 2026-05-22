-- Sprint 12 — Gestion des salles de réunion
-- Extensions requises pour la contrainte d'exclusion sur tstzrange
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Nouveau rôle utilisateur (parallèle à editor)
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'facility_manager';
--> statement-breakpoint

-- Nouveau type de notification dédié à l'annulation d'une réservation
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'meeting_room_cancelled';
--> statement-breakpoint

-- Enums dédiés salles
CREATE TYPE "meeting_room_principal_type" AS ENUM ('user', 'team', 'role');
--> statement-breakpoint
CREATE TYPE "meeting_room_booking_status" AS ENUM ('confirmed', 'cancelled');
--> statement-breakpoint

-- Salles
CREATE TABLE "meeting_rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "address" text,
  "floor" varchar(100),
  "capacity" integer NOT NULL DEFAULT 0,
  "description" text,
  "photo_key" varchar(512),
  "floor_plan_key" varchar(512),
  "opening_hours" jsonb NOT NULL DEFAULT '{"mon":[{"from":"08:00","to":"19:00"}],"tue":[{"from":"08:00","to":"19:00"}],"wed":[{"from":"08:00","to":"19:00"}],"thu":[{"from":"08:00","to":"19:00"}],"fri":[{"from":"08:00","to":"19:00"}],"sat":[],"sun":[]}'::jsonb,
  "equipment" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_meeting_rooms_active" ON "meeting_rooms" ("is_active");
--> statement-breakpoint
CREATE INDEX "idx_meeting_rooms_name" ON "meeting_rooms" ("name");
--> statement-breakpoint

-- Permissions par salle (axe utilisateur / équipe / rôle)
CREATE TABLE "meeting_room_permissions" (
  "room_id" uuid NOT NULL REFERENCES "meeting_rooms"("id") ON DELETE CASCADE,
  "principal_type" "meeting_room_principal_type" NOT NULL,
  "principal_id" uuid NOT NULL,
  "can_book" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("room_id", "principal_type", "principal_id")
);
--> statement-breakpoint
CREATE INDEX "idx_meeting_room_perms_principal" ON "meeting_room_permissions" ("principal_type", "principal_id");
--> statement-breakpoint
CREATE INDEX "idx_meeting_room_perms_room" ON "meeting_room_permissions" ("room_id");
--> statement-breakpoint

-- Réservations
CREATE TABLE "meeting_room_bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_id" uuid NOT NULL REFERENCES "meeting_rooms"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(500) NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "attendees" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" "meeting_room_booking_status" NOT NULL DEFAULT 'confirmed',
  "calendar_event_id" uuid REFERENCES "calendar_events"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_room_range" ON "meeting_room_bookings" ("room_id", "start_at", "end_at");
--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_user" ON "meeting_room_bookings" ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_status" ON "meeting_room_bookings" ("status");
--> statement-breakpoint
CREATE INDEX "idx_meeting_room_bookings_event" ON "meeting_room_bookings" ("calendar_event_id");
--> statement-breakpoint

-- Empêche au niveau DB tout chevauchement de réservation confirmée pour une même salle.
-- L'API capte l'erreur Postgres 23P01 pour renvoyer un 409 « créneau déjà pris ».
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE (status = 'confirmed');
--> statement-breakpoint

-- Lien des événements calendrier vers une salle de réunion (option)
ALTER TABLE "calendar_events" ADD COLUMN "meeting_room_id" uuid
  REFERENCES "meeting_rooms"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "idx_calendar_events_meeting_room" ON "calendar_events" ("meeting_room_id");
