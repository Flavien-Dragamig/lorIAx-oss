import {
  cacheSpace,
  cacheDocumentTree,
  cacheDocument,
  type CachedDocumentTreeItem,
} from "./db";
import {
  MAX_CACHE_AGE_DAYS,
  STORE_SPACES,
  STORE_DOCUMENT_TREE,
  STORE_DOCUMENT_CONTENT,
  STORE_USER_PROFILE,
  DB_NAME,
  DB_VERSION,
} from "./constants";
import { openDB } from "idb";

// ─── Higher-level cache operations ───────────────────────────────────────────

/**
 * Store all spaces in the offline cache.
 */
export async function populateSpacesCache(
  spaces: Array<Record<string, unknown>>,
): Promise<void> {
  try {
    await Promise.all(
      spaces.map((space) =>
        cacheSpace(space.slug as string, space),
      ),
    );
  } catch {
    // IndexedDB unavailable — silently ignore
  }
}

/**
 * Store the document tree for a given space.
 */
export async function populateDocTreeCache(
  spaceSlug: string,
  docs: CachedDocumentTreeItem[],
): Promise<void> {
  try {
    await cacheDocumentTree(spaceSlug, docs);
  } catch {
    // IndexedDB unavailable — silently ignore
  }
}

/**
 * Store a single document's content.
 */
export async function populateDocumentCache(
  docId: string,
  data: {
    markdown: string;
    title: string;
    icon: string | null;
    classification: string | null;
    spaceSlug: string;
    updatedAt: string;
  },
): Promise<void> {
  try {
    await cacheDocument(docId, data);
  } catch {
    // IndexedDB unavailable — silently ignore
  }
}

/**
 * Remove cached entries older than `maxAgeDays` (default 30).
 */
export async function evictStaleEntries(maxAgeDays: number = MAX_CACHE_AGE_DAYS): Promise<void> {
  try {
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;

    const db = await openDB(DB_NAME, DB_VERSION);

    const storeNames = [
      STORE_SPACES,
      STORE_DOCUMENT_TREE,
      STORE_DOCUMENT_CONTENT,
      STORE_USER_PROFILE,
    ] as const;

    for (const storeName of storeNames) {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      let cursor = await store.openCursor();

      while (cursor) {
        const cachedAt = (cursor.value as Record<string, unknown>)?.cachedAt;
        if (typeof cachedAt === "number" && cachedAt < cutoff) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }

      await tx.done;
    }
  } catch {
    // IndexedDB unavailable — silently ignore
  }
}

// Re-export read helpers for convenience
export { getCachedSpaces, getCachedDocumentTree } from "./db";
