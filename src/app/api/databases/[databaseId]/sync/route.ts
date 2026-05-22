import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  externalDatabaseMappings,
  syncLogs,
  userDatabases,
} from "@/lib/db/schema";
import {
  syncPull,
  syncPush,
  syncBidirectional,
  fetchExternalSchema,
} from "@/lib/integrations/sync-orchestrator";

type RouteParams = { params: Promise<{ databaseId: string }> };

/**
 * GET /api/databases/[databaseId]/sync
 * Récupérer la config sync + derniers logs
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { databaseId } = await params;

  // Vérifier l'accès à la base
  const [database] = await db
    .select()
    .from(userDatabases)
    .where(eq(userDatabases.id, databaseId))
    .limit(1);
  if (!database) return NextResponse.json({ error: "Base introuvable" }, { status: 404 });

  // Récupérer les mappings
  const mappings = await db
    .select()
    .from(externalDatabaseMappings)
    .where(eq(externalDatabaseMappings.userDatabaseId, databaseId));

  // Récupérer les derniers logs (5 par mapping)
  const logsMap: Record<string, (typeof syncLogs.$inferSelect)[]> = {};
  for (const mapping of mappings) {
    const logs = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.mappingId, mapping.id))
      .orderBy(desc(syncLogs.startedAt))
      .limit(5);
    logsMap[mapping.id] = logs;
  }

  return NextResponse.json({
    mappings: mappings.map((m) => ({
      ...m,
      credentialsEnc: undefined, // Ne pas exposer les credentials
      logs: logsMap[m.id] || [],
    })),
  });
}

/**
 * POST /api/databases/[databaseId]/sync
 * Créer ou déclencher une synchronisation
 * body.action : "configure" | "pull" | "push" | "sync" | "schema"
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { databaseId } = await params;
  const body = await req.json();
  const { action } = body;

  // Vérifier l'accès à la base
  const [database] = await db
    .select()
    .from(userDatabases)
    .where(eq(userDatabases.id, databaseId))
    .limit(1);
  if (!database) return NextResponse.json({ error: "Base introuvable" }, { status: 404 });

  // ─── Configurer une nouvelle synchronisation ─────────────────────
  if (action === "configure") {
    const { provider, externalId, credentials, syncMode, syncIntervalMin, columnMapping } = body;

    if (!provider || !externalId || !credentials) {
      return NextResponse.json(
        { error: "provider, externalId et credentials requis" },
        { status: 400 }
      );
    }

    // Vérifier si un mapping existe déjà
    const [existing] = await db
      .select()
      .from(externalDatabaseMappings)
      .where(
        and(
          eq(externalDatabaseMappings.userDatabaseId, databaseId),
          eq(externalDatabaseMappings.provider, provider)
        )
      )
      .limit(1);

    if (existing) {
      // Mettre à jour
      const [updated] = await db
        .update(externalDatabaseMappings)
        .set({
          externalId,
          credentialsEnc: credentials,
          syncMode: syncMode || "manual",
          syncIntervalMin: syncIntervalMin || null,
          columnMapping: columnMapping || [],
          updatedAt: new Date(),
        })
        .where(eq(externalDatabaseMappings.id, existing.id))
        .returning();

      return NextResponse.json({ mapping: { ...updated, credentialsEnc: undefined } });
    }

    // Créer nouveau
    const [mapping] = await db
      .insert(externalDatabaseMappings)
      .values({
        userDatabaseId: databaseId,
        provider,
        externalId,
        credentialsEnc: credentials,
        syncMode: syncMode || "manual",
        syncIntervalMin: syncIntervalMin || null,
        columnMapping: columnMapping || [],
      })
      .returning();

    return NextResponse.json({ mapping: { ...mapping, credentialsEnc: undefined } }, { status: 201 });
  }

  // ─── Récupérer le schéma externe ─────────────────────────────────
  if (action === "schema") {
    const { provider, externalId, credentials } = body;
    if (!provider || !externalId || !credentials) {
      return NextResponse.json(
        { error: "provider, externalId et credentials requis" },
        { status: 400 }
      );
    }

    try {
      const schema = await fetchExternalSchema(provider, externalId, credentials);
      return NextResponse.json({ schema });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur" },
        { status: 502 }
      );
    }
  }

  // ─── Déclencher une synchronisation ──────────────────────────────
  if (action === "pull" || action === "push" || action === "sync") {
    const { mappingId } = body;
    if (!mappingId) {
      return NextResponse.json({ error: "mappingId requis" }, { status: 400 });
    }

    // Vérifier que le mapping appartient à cette base
    const [mapping] = await db
      .select()
      .from(externalDatabaseMappings)
      .where(
        and(
          eq(externalDatabaseMappings.id, mappingId),
          eq(externalDatabaseMappings.userDatabaseId, databaseId)
        )
      )
      .limit(1);

    if (!mapping) {
      return NextResponse.json({ error: "Mapping introuvable" }, { status: 404 });
    }

    if (mapping.isSyncing) {
      return NextResponse.json({ error: "Synchronisation déjà en cours" }, { status: 409 });
    }

    try {
      let result;
      if (action === "pull") result = await syncPull(mappingId);
      else if (action === "push") result = await syncPush(mappingId);
      else result = await syncBidirectional(mappingId);

      return NextResponse.json({ result });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur de sync" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}

/**
 * DELETE /api/databases/[databaseId]/sync
 * Supprimer une configuration de synchronisation
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { databaseId } = await params;
  const { mappingId } = await req.json();

  if (!mappingId) {
    return NextResponse.json({ error: "mappingId requis" }, { status: 400 });
  }

  const deleted = await db
    .delete(externalDatabaseMappings)
    .where(
      and(
        eq(externalDatabaseMappings.id, mappingId),
        eq(externalDatabaseMappings.userDatabaseId, databaseId)
      )
    )
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Mapping introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
