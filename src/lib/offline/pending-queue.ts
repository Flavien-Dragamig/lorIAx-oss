import { openDB } from "idb";
import { DB_NAME, DB_VERSION, STORE_PENDING_OPS } from "./constants";
import type { PendingOperation } from "./db";

type OperationType = PendingOperation["type"];

/**
 * Open the pending-operations store from the loriax-offline database.
 * Reuses the same DB_VERSION / upgrade logic as db.ts via idb's cache.
 */
async function getPendingStore() {
  return openDB(DB_NAME, DB_VERSION);
}

/**
 * Add an operation to the pending queue (for offline replay).
 */
export async function enqueue(
  type: OperationType,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getPendingStore();
    await db.add(STORE_PENDING_OPS, {
      type,
      payload,
      createdAt: Date.now(),
    } as Omit<PendingOperation, "id">);
  } catch {
    // IndexedDB unavailable — silently ignore
  }
}

/**
 * Get and remove all entries of a given type from the queue.
 * Returns them sorted by creation date (oldest first).
 */
export async function dequeueAll(
  type: OperationType,
): Promise<PendingOperation[]> {
  try {
    const db = await getPendingStore();
    const tx = db.transaction(STORE_PENDING_OPS, "readwrite");
    const index = tx.store.index("by-type");
    const items: PendingOperation[] = [];

    let cursor = await index.openCursor(type);
    while (cursor) {
      items.push(cursor.value as PendingOperation);
      await cursor.delete();
      cursor = await cursor.continue();
    }

    await tx.done;
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

/**
 * Count pending entries of a given type without removing them.
 */
export async function count(type: OperationType): Promise<number> {
  try {
    const db = await getPendingStore();
    return await db.countFromIndex(STORE_PENDING_OPS, "by-type", type);
  } catch {
    return 0;
  }
}

/**
 * Count all pending entries across all types.
 */
export async function countAll(): Promise<number> {
  try {
    const db = await getPendingStore();
    return await db.count(STORE_PENDING_OPS);
  } catch {
    return 0;
  }
}
