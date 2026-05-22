import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, users } from "@/lib/db/schema";
import { eq, and, or, lt, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentEditAccess } from "@/lib/auth/check-access";

const LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function isLockExpired(lockedAt: Date | null): boolean {
  if (!lockedAt) return true;
  return Date.now() - lockedAt.getTime() > LOCK_TIMEOUT_MS;
}

// POST — Acquérir le verrou
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({
      id: documents.id,
      spaceId: documents.spaceId,
      lockedBy: documents.lockedBy,
      lockedAt: documents.lockedAt,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc)
    return NextResponse.json(
      { error: "Document non trouvé" },
      { status: 404 }
    );

  // Vérifier les permissions d'édition
  const canEdit = await checkDocumentEditAccess(user, doc.spaceId, id);
  if (!canEdit)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  // Déjà verrouillé par cet utilisateur → rafraîchir
  if (doc.lockedBy === user.id) {
    const [updated] = await db
      .update(documents)
      .set({ lockedAt: new Date() })
      .where(eq(documents.id, id))
      .returning({
        lockedBy: documents.lockedBy,
        lockedAt: documents.lockedAt,
      });
    return NextResponse.json({ locked: true, ...updated });
  }

  // Verrouillé par quelqu'un d'autre et pas expiré
  if (doc.lockedBy && doc.lockedAt && !isLockExpired(doc.lockedAt)) {
    // Récupérer le nom de l'utilisateur qui verrouille
    const [lockOwner] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, doc.lockedBy))
      .limit(1);

    return NextResponse.json(
      {
        error: "Document verrouillé",
        lockedBy: doc.lockedBy,
        lockedByName: lockOwner?.name ?? "Utilisateur inconnu",
        lockedAt: doc.lockedAt,
      },
      { status: 409 }
    );
  }

  // Verrou libre ou expiré → acquérir
  const [updated] = await db
    .update(documents)
    .set({ lockedBy: user.id, lockedAt: new Date() })
    .where(
      and(
        eq(documents.id, id),
        or(
          isNull(documents.lockedBy),
          eq(documents.lockedBy, user.id),
          lt(documents.lockedAt, new Date(Date.now() - LOCK_TIMEOUT_MS))
        )
      )
    )
    .returning({
      lockedBy: documents.lockedBy,
      lockedAt: documents.lockedAt,
    });

  if (!updated) {
    // Race condition — quelqu'un a acquis le verrou entre-temps
    return NextResponse.json(
      { error: "Document verrouillé par un autre utilisateur" },
      { status: 409 }
    );
  }

  return NextResponse.json({ locked: true, ...updated });
}

// DELETE — Libérer le verrou
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({
      spaceId: documents.spaceId,
      lockedBy: documents.lockedBy,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc)
    return NextResponse.json(
      { error: "Document non trouvé" },
      { status: 404 }
    );

  // Vérifier les permissions d'édition
  const canEditDoc = await checkDocumentEditAccess(user, doc.spaceId, id);
  if (!canEditDoc)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  // Seul le propriétaire du verrou ou un admin peut le libérer
  const isAdmin =
    user.globalRole === "admin" || user.globalRole === "super_admin";
  if (doc.lockedBy !== user.id && !isAdmin) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas libérer ce verrou" },
      { status: 403 }
    );
  }

  await db
    .update(documents)
    .set({ lockedBy: null, lockedAt: null })
    .where(eq(documents.id, id));

  return NextResponse.json({ locked: false });
}

// PATCH — Heartbeat (rafraîchir le verrou)
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({
      lockedBy: documents.lockedBy,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc)
    return NextResponse.json(
      { error: "Document non trouvé" },
      { status: 404 }
    );

  if (doc.lockedBy !== user.id) {
    return NextResponse.json(
      { error: "Vous ne détenez pas le verrou sur ce document" },
      { status: 403 }
    );
  }

  const [updated] = await db
    .update(documents)
    .set({ lockedAt: new Date() })
    .where(and(eq(documents.id, id), eq(documents.lockedBy, user.id)))
    .returning({
      lockedBy: documents.lockedBy,
      lockedAt: documents.lockedAt,
    });

  return NextResponse.json({ locked: true, ...updated });
}
