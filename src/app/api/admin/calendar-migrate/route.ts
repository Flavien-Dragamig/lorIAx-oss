import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import {
  migrateExistingUsers,
  migrateExistingTeams,
  ensureOrganizationCalendar,
} from "@/lib/calendar/auto-provision";

export async function POST() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const usersCreated = await migrateExistingUsers();
  const teamsCreated = await migrateExistingTeams();
  const orgCalId = await ensureOrganizationCalendar(user.id);

  return NextResponse.json({
    message: "Migration calendriers terminée",
    usersCreated,
    teamsCreated,
    organizationCalendarId: orgCalId,
  });
}
