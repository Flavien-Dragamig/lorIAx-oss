import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkCalendarAccess } from "@/lib/calendar/permissions";
import { z } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const hasAccess = await checkCalendarAccess(user.id, id, "read");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [calendar] = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, id));

  if (!calendar) return NextResponse.json({ error: "Calendrier introuvable" }, { status: 404 });

  return NextResponse.json(calendar);
}

const updateCalendarSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().max(100).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const hasAccess = await checkCalendarAccess(user.id, id, "admin");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const parsed = updateCalendarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [updated] = await db
    .update(calendars)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(calendars.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Calendrier introuvable" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const hasAccess = await checkCalendarAccess(user.id, id, "admin");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [deleted] = await db
    .delete(calendars)
    .where(eq(calendars.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Calendrier introuvable" }, { status: 404 });

  return NextResponse.json({ success: true });
}
