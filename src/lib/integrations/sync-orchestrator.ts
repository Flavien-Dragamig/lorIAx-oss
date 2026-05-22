import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  externalDatabaseMappings,
  externalRowTracking,
  syncLogs,
  userDatabaseColumns,
  userDatabaseRows,
} from "@/lib/db/schema";
import type { ExternalProvider, ExternalRow, ColumnMapping, SyncResult } from "./base";
import { contentHash } from "./base";
import { airtableProvider } from "./airtable/client";
import { notionProvider } from "./notion/client";
import { decrypt } from "@/lib/crypto";
import { uploadFile } from "@/lib/storage/s3";
import { randomUUID } from "crypto";

/**
 * ARCH-08 — Déchiffre les credentials stockés en BDD.
 * Si ENCRYPTION_KEY n'est pas configurée, retourne la valeur brute
 * (rétrocompatibilité avec les credentials non chiffrés).
 */
function decryptCredentials(credentialsEnc: string): string {
  if (!process.env.ENCRYPTION_KEY) return credentialsEnc;
  try {
    return decrypt(credentialsEnc);
  } catch {
    // Credentials probablement stockés en clair (avant migration)
    return credentialsEnc;
  }
}

function getProvider(name: string): ExternalProvider {
  if (name === "airtable") return airtableProvider;
  if (name === "notion") return notionProvider;
  throw new Error(`Provider inconnu : ${name}`);
}

// ─── Pull : externe → LorIAx ────────────────────────────────────────────────

export async function syncPull(mappingId: string): Promise<SyncResult> {
  const [mapping] = await db
    .select()
    .from(externalDatabaseMappings)
    .where(eq(externalDatabaseMappings.id, mappingId))
    .limit(1);

  if (!mapping) throw new Error("Mapping introuvable");
  if (!mapping.credentialsEnc) throw new Error("Identifiants manquants");

  // Marquer comme en cours
  await db
    .update(externalDatabaseMappings)
    .set({ isSyncing: true, syncError: null })
    .where(eq(externalDatabaseMappings.id, mappingId));

  const [log] = await db
    .insert(syncLogs)
    .values({ mappingId, direction: "pull", status: "in_progress" })
    .returning();

  const result: SyncResult = { rowsCreated: 0, rowsUpdated: 0, rowsDeleted: 0, errors: [] };

  try {
    const provider = getProvider(mapping.provider);
    const credentials = decryptCredentials(mapping.credentialsEnc);
    const columnMap = (mapping.columnMapping as ColumnMapping[]) || [];

    // Récupérer les colonnes LorIAx
    const loriaxCols = await db
      .select()
      .from(userDatabaseColumns)
      .where(eq(userDatabaseColumns.databaseId, mapping.userDatabaseId));

    // Récupérer les données externes
    const externalRows = await provider.fetchRows(mapping.externalId, credentials);

    // Récupérer le tracking existant
    const existingTracking = await db
      .select()
      .from(externalRowTracking)
      .where(eq(externalRowTracking.mappingId, mappingId));

    const trackingByExternalId = new Map(
      existingTracking.map((t) => [t.externalRowId, t])
    );

    // Index des colonnes LorIAx par id (utilisé pour le re-upload attachment)
    const loriaxColsById = new Map(loriaxCols.map((c) => [c.id, c]));

    // Traiter chaque ligne externe
    for (const extRow of externalRows) {
      try {
        const cells = mapExternalToLoriax(extRow, columnMap, loriaxCols);

        // Re-upload des fichiers attachment (sync pull)
        for (const colMapping of columnMap) {
          if (colMapping.direction === "push-only") continue;
          const col = loriaxColsById.get(colMapping.loriaxColumnId);
          if (!col || col.type !== "attachment") continue;
          const rawFiles = cells[colMapping.loriaxColumnId];
          if (!Array.isArray(rawFiles) || rawFiles.length === 0) continue;
          cells[colMapping.loriaxColumnId] = await downloadAndReupload(
            rawFiles as { url: string; filename: string }[],
            mapping.userDatabaseId
          );
        }

        const hash = contentHash(cells);
        const existing = trackingByExternalId.get(extRow.externalId);

        if (!existing) {
          // Nouvelle ligne → créer
          const [newRow] = await db
            .insert(userDatabaseRows)
            .values({
              databaseId: mapping.userDatabaseId,
              cells,
              position: 0,
            })
            .returning();

          await db.insert(externalRowTracking).values({
            mappingId,
            loriaxRowId: newRow.id,
            externalRowId: extRow.externalId,
            contentHash: hash,
            lastExternalChangeAt: extRow.lastModified ? new Date(extRow.lastModified) : new Date(),
          });

          result.rowsCreated++;
        } else if (existing.contentHash !== hash) {
          // Ligne modifiée → mettre à jour
          await db
            .update(userDatabaseRows)
            .set({ cells, updatedAt: new Date() })
            .where(eq(userDatabaseRows.id, existing.loriaxRowId));

          await db
            .update(externalRowTracking)
            .set({
              contentHash: hash,
              lastExternalChangeAt: extRow.lastModified ? new Date(extRow.lastModified) : new Date(),
              updatedAt: new Date(),
            })
            .where(eq(externalRowTracking.id, existing.id));

          result.rowsUpdated++;
        }

        trackingByExternalId.delete(extRow.externalId);
      } catch (err) {
        result.errors.push(`Ligne ${extRow.externalId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Lignes supprimées en externe → supprimer en local
    for (const [, orphan] of trackingByExternalId) {
      await db
        .delete(userDatabaseRows)
        .where(eq(userDatabaseRows.id, orphan.loriaxRowId));
      await db
        .delete(externalRowTracking)
        .where(eq(externalRowTracking.id, orphan.id));
      result.rowsDeleted++;
    }

    // Succès
    await db
      .update(syncLogs)
      .set({
        status: "success",
        rowsCreated: result.rowsCreated,
        rowsUpdated: result.rowsUpdated,
        rowsDeleted: result.rowsDeleted,
        completedAt: new Date(),
      })
      .where(eq(syncLogs.id, log.id));

    await db
      .update(externalDatabaseMappings)
      .set({
        isSyncing: false,
        lastSyncAt: new Date(),
        lastSyncDirection: "pull",
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(externalDatabaseMappings.id, mappingId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);

    await db
      .update(syncLogs)
      .set({ status: "error", errorMessage: message, completedAt: new Date() })
      .where(eq(syncLogs.id, log.id));

    await db
      .update(externalDatabaseMappings)
      .set({ isSyncing: false, syncError: message, updatedAt: new Date() })
      .where(eq(externalDatabaseMappings.id, mappingId));
  }

  return result;
}

// ─── Push : LorIAx → externe ────────────────────────────────────────────────

export async function syncPush(mappingId: string): Promise<SyncResult> {
  const [mapping] = await db
    .select()
    .from(externalDatabaseMappings)
    .where(eq(externalDatabaseMappings.id, mappingId))
    .limit(1);

  if (!mapping) throw new Error("Mapping introuvable");
  if (!mapping.credentialsEnc) throw new Error("Identifiants manquants");

  await db
    .update(externalDatabaseMappings)
    .set({ isSyncing: true, syncError: null })
    .where(eq(externalDatabaseMappings.id, mappingId));

  const [log] = await db
    .insert(syncLogs)
    .values({ mappingId, direction: "push", status: "in_progress" })
    .returning();

  const result: SyncResult = { rowsCreated: 0, rowsUpdated: 0, rowsDeleted: 0, errors: [] };

  try {
    const provider = getProvider(mapping.provider);
    const credentials = decryptCredentials(mapping.credentialsEnc);
    const columnMap = (mapping.columnMapping as ColumnMapping[]) || [];

    // Colonnes LorIAx
    const loriaxCols = await db
      .select()
      .from(userDatabaseColumns)
      .where(eq(userDatabaseColumns.databaseId, mapping.userDatabaseId));

    // Toutes les lignes LorIAx
    const loriaxRows = await db
      .select()
      .from(userDatabaseRows)
      .where(eq(userDatabaseRows.databaseId, mapping.userDatabaseId));

    // Tracking existant
    const existingTracking = await db
      .select()
      .from(externalRowTracking)
      .where(eq(externalRowTracking.mappingId, mappingId));

    const trackingByLoriaxId = new Map(
      existingTracking.map((t) => [t.loriaxRowId, t])
    );

    // Schéma externe pour le mapping inverse
    const externalSchema = await provider.fetchSchema(mapping.externalId, credentials);
    const externalTypeMap = new Map(externalSchema.map((c) => [c.externalId, c.type]));

    // Lignes à créer
    const toCreate: { loriaxRowId: string; cells: Record<string, unknown> }[] = [];
    // Lignes à mettre à jour
    const toUpdate: { externalRowId: string; cells: Record<string, unknown>; loriaxRowId: string }[] = [];

    for (const row of loriaxRows) {
      const cells = mapLoriaxToExternal(row.cells as Record<string, unknown>, columnMap, loriaxCols, externalTypeMap);
      const hash = contentHash(cells);
      const tracking = trackingByLoriaxId.get(row.id);

      if (!tracking) {
        toCreate.push({ loriaxRowId: row.id, cells });
      } else if (tracking.contentHash !== hash) {
        toUpdate.push({
          externalRowId: tracking.externalRowId,
          cells,
          loriaxRowId: row.id,
        });
      }
      trackingByLoriaxId.delete(row.id);
    }

    // Créer les nouvelles lignes
    if (toCreate.length > 0) {
      const created = await provider.createRows(
        mapping.externalId,
        credentials,
        toCreate.map((r) => ({ cells: r.cells }))
      );

      for (let i = 0; i < created.length; i++) {
        await db.insert(externalRowTracking).values({
          mappingId,
          loriaxRowId: toCreate[i].loriaxRowId,
          externalRowId: created[i].externalId,
          contentHash: contentHash(toCreate[i].cells),
        });
        result.rowsCreated++;
      }
    }

    // Mettre à jour les lignes modifiées
    if (toUpdate.length > 0) {
      await provider.updateRows(
        mapping.externalId,
        credentials,
        toUpdate.map((r) => ({ externalRowId: r.externalRowId, cells: r.cells }))
      );

      for (const row of toUpdate) {
        await db
          .update(externalRowTracking)
          .set({ contentHash: contentHash(row.cells), updatedAt: new Date() })
          .where(
            and(
              eq(externalRowTracking.mappingId, mappingId),
              eq(externalRowTracking.loriaxRowId, row.loriaxRowId)
            )
          );
        result.rowsUpdated++;
      }
    }

    // Lignes supprimées localement → supprimer en externe
    const orphanIds = [...trackingByLoriaxId.values()];
    if (orphanIds.length > 0) {
      await provider.deleteRows(
        mapping.externalId,
        credentials,
        orphanIds.map((t) => t.externalRowId)
      );
      for (const orphan of orphanIds) {
        await db
          .delete(externalRowTracking)
          .where(eq(externalRowTracking.id, orphan.id));
        result.rowsDeleted++;
      }
    }

    // Succès
    await db
      .update(syncLogs)
      .set({
        status: "success",
        rowsCreated: result.rowsCreated,
        rowsUpdated: result.rowsUpdated,
        rowsDeleted: result.rowsDeleted,
        completedAt: new Date(),
      })
      .where(eq(syncLogs.id, log.id));

    await db
      .update(externalDatabaseMappings)
      .set({
        isSyncing: false,
        lastSyncAt: new Date(),
        lastSyncDirection: "push",
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(externalDatabaseMappings.id, mappingId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);

    await db
      .update(syncLogs)
      .set({ status: "error", errorMessage: message, completedAt: new Date() })
      .where(eq(syncLogs.id, log.id));

    await db
      .update(externalDatabaseMappings)
      .set({ isSyncing: false, syncError: message, updatedAt: new Date() })
      .where(eq(externalDatabaseMappings.id, mappingId));
  }

  return result;
}

// ─── Bidirectionnel ──────────────────────────────────────────────────────────

export async function syncBidirectional(mappingId: string): Promise<SyncResult> {
  const pullResult = await syncPull(mappingId);
  const pushResult = await syncPush(mappingId);

  return {
    rowsCreated: pullResult.rowsCreated + pushResult.rowsCreated,
    rowsUpdated: pullResult.rowsUpdated + pushResult.rowsUpdated,
    rowsDeleted: pullResult.rowsDeleted + pushResult.rowsDeleted,
    errors: [...pullResult.errors, ...pushResult.errors],
  };
}

// ─── Récupérer le schéma externe ─────────────────────────────────────────────

export async function fetchExternalSchema(provider: string, externalId: string, credentialsEnc: string) {
  return getProvider(provider).fetchSchema(externalId, decryptCredentials(credentialsEnc));
}

// ─── Helpers de mapping ──────────────────────────────────────────────────────

interface LoriaxCol {
  id: string;
  name: string;
  type: string;
}

function mapExternalToLoriax(
  extRow: ExternalRow,
  columnMap: ColumnMapping[],
  loriaxCols: LoriaxCol[]
): Record<string, unknown> {
  const cells: Record<string, unknown> = {};
  const colById = new Map(loriaxCols.map((c) => [c.id, c]));

  for (const mapping of columnMap) {
    if (mapping.direction === "push-only") continue;
    const col = colById.get(mapping.loriaxColumnId);
    if (!col) continue;

    const value = extRow.cells[mapping.externalColumnId];
    cells[col.id] = coerceValue(value, col.type);
  }

  return cells;
}

function mapLoriaxToExternal(
  cells: Record<string, unknown>,
  columnMap: ColumnMapping[],
  loriaxCols: LoriaxCol[],
  _externalTypeMap: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const colById = new Map(loriaxCols.map((c) => [c.id, c]));

  for (const mapping of columnMap) {
    if (mapping.direction === "pull-only") continue;
    const col = colById.get(mapping.loriaxColumnId);
    if (!col) continue;

    result[mapping.externalColumnId] = cells[col.id];
  }

  return result;
}

/** Télécharge des fichiers externes et les re-uploade vers Garage S3 */
async function downloadAndReupload(
  files: { url: string; filename: string; expiry?: string }[],
  spaceId: string
): Promise<{ key: string; filename: string; mimeType: string; size: number }[]> {
  const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo
  const results: { key: string; filename: string; mimeType: string; size: number }[] = [];

  for (const file of files) {
    try {
      const res = await fetch(file.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_SIZE) continue;

      const mimeType = res.headers.get("content-type") || "application/octet-stream";
      const ext = file.filename.includes(".") ? file.filename.split(".").pop() : "bin";
      const key = `${spaceId}/sync-${randomUUID()}.${ext}`;

      await uploadFile(key, buffer, mimeType);
      results.push({ key, filename: file.filename, mimeType, size: buffer.length });
    } catch {
      // Erreur sur un fichier → on continue les autres
    }
  }

  return results;
}

function coerceValue(value: unknown, targetType: string): unknown {
  if (value == null) return targetType === "checkbox" ? false : targetType === "number" ? 0 : targetType === "attachment" ? [] : "";

  switch (targetType) {
    case "text":
    case "url":
    case "email":
    case "time":
      return String(value);
    case "number":
      return typeof value === "number" ? value : parseFloat(String(value)) || 0;
    case "date":
      return String(value);
    case "select":
      return Array.isArray(value) ? value : String(value);
    case "checkbox":
      return Boolean(value);
    case "relation":
      return Array.isArray(value) ? value : [];
    case "attachment":
      return Array.isArray(value) ? value : [];
    default:
      return value;
  }
}
