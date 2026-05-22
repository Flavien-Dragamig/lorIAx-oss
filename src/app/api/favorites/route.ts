import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  favorites,
  documents,
  spaces,
  templates,
  calendarEvents,
  meetings,
} from "@/lib/db/schema";
import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getAccessibleSpaceIds, isGlobalAdmin } from "@/lib/auth/check-access";

const VALID_ENTITY_TYPES = [
  "document",
  "space",
  "template",
  "calendar_event",
  "meeting",
] as const;

type EntityType = (typeof VALID_ENTITY_TYPES)[number];

interface ResolvedFavorite {
  id: string;
  entityType: EntityType;
  entityId: string;
  position: number;
  label: string;
  icon: string | null;
  href: string;
  badge: string;
  subtitle: string | null;
}

// ─── GET /api/favorites ────────────────────────────────────────────────────────

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  // 1. Fetch all favorites for the user, ordered by position
  const userFavorites = await db
    .select()
    .from(favorites)
    .where(eq(favorites.userId, user.id))
    .orderBy(asc(favorites.position));

  if (userFavorites.length === 0) {
    return NextResponse.json([]);
  }

  // 2. Group entity IDs by type
  const idsByType = new Map<EntityType, string[]>();
  for (const fav of userFavorites) {
    const type = fav.entityType as EntityType;
    if (!idsByType.has(type)) idsByType.set(type, []);
    idsByType.get(type)!.push(fav.entityId);
  }

  // 3. Batch-resolve entities
  const resolved = new Map<string, ResolvedFavorite>();

  // ── Documents ──
  const docIds = idsByType.get("document");
  if (docIds?.length) {
    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        slug: documents.slug,
        icon: documents.icon,
        spaceId: documents.spaceId,
        spaceSlug: spaces.slug,
        spaceName: spaces.name,
      })
      .from(documents)
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(inArray(documents.id, docIds));

    for (const doc of docs) {
      resolved.set(doc.id, {
        id: "", // filled later
        entityType: "document",
        entityId: doc.id,
        position: 0,
        label: doc.title,
        icon: doc.icon,
        href: `/s/${doc.spaceSlug}/${doc.id}`,
        badge: "Document",
        subtitle: doc.spaceName,
      });
    }
  }

  // ── Spaces ──
  const spaceIds = idsByType.get("space");
  if (spaceIds?.length) {
    const spaceRows = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        slug: spaces.slug,
        icon: spaces.icon,
        type: spaces.type,
      })
      .from(spaces)
      .where(inArray(spaces.id, spaceIds));

    const typeLabels: Record<string, string> = {
      personal: "Personnel",
      team: "Équipe",
      organization: "Organisation",
    };

    for (const space of spaceRows) {
      resolved.set(space.id, {
        id: "",
        entityType: "space",
        entityId: space.id,
        position: 0,
        label: space.name,
        icon: space.icon,
        href: `/s/${space.slug}`,
        badge: "Espace",
        subtitle: typeLabels[space.type] ?? space.type,
      });
    }
  }

  // ── Templates ──
  const templateIds = idsByType.get("template");
  if (templateIds?.length) {
    const templateRows = await db
      .select({
        id: templates.id,
        name: templates.name,
        icon: templates.icon,
        category: templates.category,
      })
      .from(templates)
      .where(inArray(templates.id, templateIds));

    for (const tmpl of templateRows) {
      resolved.set(tmpl.id, {
        id: "",
        entityType: "template",
        entityId: tmpl.id,
        position: 0,
        label: tmpl.name,
        icon: tmpl.icon,
        href: `/new?template=${tmpl.id}`,
        badge: "Modèle",
        subtitle: tmpl.category,
      });
    }
  }

  // ── Calendar events ──
  const eventIds = idsByType.get("calendar_event");
  if (eventIds?.length) {
    const eventRows = await db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startAt: calendarEvents.startAt,
      })
      .from(calendarEvents)
      .where(inArray(calendarEvents.id, eventIds));

    for (const evt of eventRows) {
      resolved.set(evt.id, {
        id: "",
        entityType: "calendar_event",
        entityId: evt.id,
        position: 0,
        label: evt.title,
        icon: null,
        href: "/calendar",
        badge: "Événement",
        subtitle: evt.startAt
          ? new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(evt.startAt))
          : null,
      });
    }
  }

  // ── Meetings ──
  const meetingIds = idsByType.get("meeting");
  if (meetingIds?.length) {
    const meetingRows = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        startedAt: meetings.startedAt,
      })
      .from(meetings)
      .where(inArray(meetings.id, meetingIds));

    for (const mtg of meetingRows) {
      resolved.set(mtg.id, {
        id: "",
        entityType: "meeting",
        entityId: mtg.id,
        position: 0,
        label: mtg.title,
        icon: null,
        href: "/meet",
        badge: "Réunion",
        subtitle: mtg.startedAt
          ? new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(mtg.startedAt))
          : null,
      });
    }
  }

  // 4. RBAC filtering — remove entities the user can no longer access
  const admin = isGlobalAdmin(user);
  let accessibleSpaceIdSet: Set<string> | null = null;

  if (!admin) {
    const ids = await getAccessibleSpaceIds(user);
    // getAccessibleSpaceIds returns [] for admins (meaning "no filter"),
    // but we already handled that above. For non-admins, an empty list means no access.
    accessibleSpaceIdSet = new Set(ids);
  }

  // For documents: filter by accessible space IDs
  if (!admin && docIds?.length && accessibleSpaceIdSet) {
    const docs = await db
      .select({ id: documents.id, spaceId: documents.spaceId })
      .from(documents)
      .where(inArray(documents.id, docIds));

    for (const doc of docs) {
      if (!accessibleSpaceIdSet.has(doc.spaceId)) {
        resolved.delete(doc.id);
      }
    }
  }

  // For spaces: filter by accessible space IDs
  if (!admin && spaceIds?.length && accessibleSpaceIdSet) {
    for (const id of spaceIds) {
      if (!accessibleSpaceIdSet.has(id)) {
        resolved.delete(id);
      }
    }
  }

  // Templates, calendar events, meetings: keep them (generally accessible or user-specific)

  // 5. Build final ordered array
  const result: ResolvedFavorite[] = [];
  for (const fav of userFavorites) {
    const entry = resolved.get(fav.entityId);
    if (!entry) continue; // entity deleted or access revoked
    result.push({
      ...entry,
      id: fav.id,
      position: fav.position,
    });
  }

  return NextResponse.json(result);
}

// ─── POST /api/favorites ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let body: { entityType?: string; entityId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { entityType, entityId } = body;

  if (
    !entityType ||
    !entityId ||
    !VALID_ENTITY_TYPES.includes(entityType as EntityType)
  ) {
    return NextResponse.json(
      { error: "entityType et entityId requis, entityType doit être un type valide" },
      { status: 400 }
    );
  }

  // Calculate next position
  const [maxRow] = await db
    .select({ maxPos: sql<number>`coalesce(max(${favorites.position}), -1)` })
    .from(favorites)
    .where(eq(favorites.userId, user.id));

  const nextPosition = (maxRow?.maxPos ?? -1) + 1;

  // Insert (idempotent — ignore conflict on unique index)
  const [created] = await db
    .insert(favorites)
    .values({
      userId: user.id,
      entityType: entityType as EntityType,
      entityId,
      position: nextPosition,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    // Already exists — return the existing one
    const [existing] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, user.id),
          eq(favorites.entityType, entityType as EntityType),
          eq(favorites.entityId, entityId)
        )
      )
      .limit(1);

    return NextResponse.json(existing, { status: 200 });
  }

  return NextResponse.json(created, { status: 201 });
}
