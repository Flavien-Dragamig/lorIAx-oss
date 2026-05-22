-- Sprint 12 — Droits de réservation par rôle (3e axe de la matrice)
-- Élargit principal_id pour pouvoir stocker un UUID (user/team) ou un nom
-- de rôle (super_admin, admin, facility_manager, editor, viewer).

ALTER TABLE "meeting_room_permissions"
  ALTER COLUMN "principal_id" TYPE varchar(64) USING "principal_id"::text;
--> statement-breakpoint

-- Contrôle d'intégrité : si principal_type='role', principal_id doit être
-- un rôle global valide. Si principal_type IN ('user','team'), c'est un UUID.
ALTER TABLE "meeting_room_permissions"
  ADD CONSTRAINT "meeting_room_permissions_principal_check"
  CHECK (
    (principal_type = 'role' AND principal_id IN ('super_admin','admin','facility_manager','editor','viewer'))
    OR (principal_type IN ('user','team') AND principal_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );
