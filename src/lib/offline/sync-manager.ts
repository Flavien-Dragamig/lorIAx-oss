import { dequeueAll, countAll } from "./pending-queue";
import type { PendingOperation } from "./db";

// ─── Events ──────────────────────────────────────────────────────────────────

export type SyncManagerEventType =
  | "flush-start"
  | "flush-complete"
  | "flush-error"
  | "item-synced"
  | "item-failed";

interface SyncManagerEventMap {
  "flush-start": { totalItems: number };
  "flush-complete": { synced: number; failed: number };
  "flush-error": { error: string };
  "item-synced": { type: PendingOperation["type"]; documentId: string };
  "item-failed": { type: PendingOperation["type"]; documentId: string; error: string };
}

// ─── Retry helper ────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

// ─── Singleton SyncManager ──────────────────────────────────────────────────

class SyncManager extends EventTarget {
  private initialized = false;
  private flushing = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize the manager. Should be called once at app level.
   * Listens for the browser `online` event and flushes pending queues.
   */
  init(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    window.addEventListener("online", () => {
      // Wait 2s for connection stability before flushing
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.flush(), 2000);
    });

    // Flush on init if already online and there may be pending items
    if (navigator.onLine) {
      // Small delay to let the app fully mount
      setTimeout(() => this.flush(), 3000);
    }
  }

  /**
   * Manually trigger a flush of all pending queues.
   */
  async flush(): Promise<void> {
    if (this.flushing || !navigator.onLine) return;
    this.flushing = true;

    const total = await countAll();
    if (total === 0) {
      this.flushing = false;
      return;
    }

    this.emit("flush-start", { totalItems: total });

    let synced = 0;
    let failed = 0;

    // 1. Flush markdown saves
    try {
      const markdownOps = await dequeueAll("markdown-save");
      for (const op of markdownOps) {
        const docId = op.payload.documentId as string;
        try {
          await withRetry(async () => {
            const res = await fetch(`/api/documents/${docId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: op.payload.content }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          });
          synced++;
          this.emit("item-synced", { type: "markdown-save", documentId: docId });
        } catch (err) {
          failed++;
          this.emit("item-failed", {
            type: "markdown-save",
            documentId: docId,
            error: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    } catch {
      // dequeueAll failed — nothing to do
    }

    // 2. Flush comments
    try {
      const commentOps = await dequeueAll("comment");
      for (const op of commentOps) {
        const docId = op.payload.documentId as string;
        try {
          await withRetry(async () => {
            const res = await fetch(`/api/documents/${docId}/comments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(op.payload.body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          });
          synced++;
          this.emit("item-synced", { type: "comment", documentId: docId });
        } catch (err) {
          failed++;
          this.emit("item-failed", {
            type: "comment",
            documentId: docId,
            error: err instanceof Error ? err.message : "Erreur inconnue",
          });
        }
      }
    } catch {
      // dequeueAll failed — nothing to do
    }

    this.emit("flush-complete", { synced, failed });
    this.flushing = false;
  }

  /**
   * Type-safe event emitter.
   */
  private emit<K extends SyncManagerEventType>(
    type: K,
    detail: SyncManagerEventMap[K],
  ): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Type-safe event listener.
   */
  on<K extends SyncManagerEventType>(
    type: K,
    handler: (detail: SyncManagerEventMap[K]) => void,
  ): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent).detail);
    };
    this.addEventListener(type, listener);
    return () => this.removeEventListener(type, listener);
  }
}

/** Singleton instance — call `syncManager.init()` once at app startup */
export const syncManager = new SyncManager();
