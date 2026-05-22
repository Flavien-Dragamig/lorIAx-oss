import { db } from "@/lib/db";
import { documentCollabStates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Fetch stored Yjs state for a document (base64 → Uint8Array).
 * Returns null if no state exists yet.
 */
export async function fetchYjsState(documentId: string): Promise<Uint8Array | null> {
  const [row] = await db
    .select({ yjsState: documentCollabStates.yjsState })
    .from(documentCollabStates)
    .where(eq(documentCollabStates.documentId, documentId))
    .limit(1);

  if (!row) return null;

  return Buffer.from(row.yjsState, "base64");
}

/**
 * Store Yjs state for a document (Uint8Array → base64).
 */
export async function storeYjsState(documentId: string, state: Uint8Array): Promise<void> {
  const base64 = Buffer.from(state).toString("base64");
  const now = new Date();

  await db
    .insert(documentCollabStates)
    .values({
      documentId,
      yjsState: base64,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: documentCollabStates.documentId,
      set: { yjsState: base64, updatedAt: now },
    });
}
