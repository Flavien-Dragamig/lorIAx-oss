import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  DB_NAME,
  DB_VERSION,
  STORE_SPACES,
  STORE_DOCUMENT_TREE,
  STORE_DOCUMENT_CONTENT,
  STORE_USER_PROFILE,
  STORE_PENDING_OPS,
} from "./constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedSpace {
  slug: string;
  name: string;
  type: string;
  icon?: string;
  description?: string;
  classification?: string;
  cachedAt: number;
  [key: string]: unknown;
}

export interface CachedDocumentTreeItem {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  isFolder: boolean;
  icon: string | null;
  position: number;
}

export interface CachedDocumentTreeEntry {
  spaceSlug: string;
  documents: CachedDocumentTreeItem[];
  cachedAt: number;
}

export interface CachedDocumentContent {
  documentId: string;
  markdown: string;
  title: string;
  icon: string | null;
  classification: string | null;
  spaceSlug: string;
  updatedAt: string;
  cachedAt: number;
}

export interface CachedUserProfile {
  key: string; // always "current"
  cachedAt: number;
  [k: string]: unknown;
}

export interface PendingOperation {
  id: number;
  type: "markdown-save" | "comment";
  payload: Record<string, unknown>;
  createdAt: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

interface OfflineDB extends DBSchema {
  [STORE_SPACES]: {
    key: string;
    value: CachedSpace;
  };
  [STORE_DOCUMENT_TREE]: {
    key: string;
    value: CachedDocumentTreeEntry;
  };
  [STORE_DOCUMENT_CONTENT]: {
    key: string;
    value: CachedDocumentContent;
  };
  [STORE_USER_PROFILE]: {
    key: string;
    value: CachedUserProfile;
  };
  [STORE_PENDING_OPS]: {
    key: number;
    value: PendingOperation;
    indexes: { "by-type": string };
  };
}

// ─── Database accessor ────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 stores
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORE_SPACES)) {
            db.createObjectStore(STORE_SPACES, { keyPath: "slug" });
          }
          if (!db.objectStoreNames.contains(STORE_DOCUMENT_TREE)) {
            db.createObjectStore(STORE_DOCUMENT_TREE, { keyPath: "spaceSlug" });
          }
          if (!db.objectStoreNames.contains(STORE_DOCUMENT_CONTENT)) {
            db.createObjectStore(STORE_DOCUMENT_CONTENT, { keyPath: "documentId" });
          }
          if (!db.objectStoreNames.contains(STORE_USER_PROFILE)) {
            db.createObjectStore(STORE_USER_PROFILE, { keyPath: "key" });
          }
        }

        // v2: pending operations queue for offline sync
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORE_PENDING_OPS)) {
            const store = db.createObjectStore(STORE_PENDING_OPS, {
              keyPath: "id",
              autoIncrement: true,
            });
            store.createIndex("by-type", "type");
          }
        }
      },
    });
  }
  return dbPromise;
}

// ─── Spaces ───────────────────────────────────────────────────────────────────

export async function cacheSpace(slug: string, data: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  await db.put(STORE_SPACES, { ...data, slug, cachedAt: Date.now() } as CachedSpace);
}

export async function getCachedSpaces(): Promise<CachedSpace[]> {
  const db = await getDB();
  return db.getAll(STORE_SPACES);
}

export async function getCachedSpace(slug: string): Promise<CachedSpace | undefined> {
  const db = await getDB();
  return db.get(STORE_SPACES, slug);
}

// ─── Document tree ────────────────────────────────────────────────────────────

export async function cacheDocumentTree(
  spaceSlug: string,
  docs: CachedDocumentTreeItem[],
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_DOCUMENT_TREE, {
    spaceSlug,
    documents: docs,
    cachedAt: Date.now(),
  });
}

export async function getCachedDocumentTree(
  spaceSlug: string,
): Promise<CachedDocumentTreeItem[] | undefined> {
  const db = await getDB();
  const entry = await db.get(STORE_DOCUMENT_TREE, spaceSlug);
  return entry?.documents;
}

// ─── Document content ─────────────────────────────────────────────────────────

export async function cacheDocument(
  documentId: string,
  data: Omit<CachedDocumentContent, "documentId" | "cachedAt">,
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_DOCUMENT_CONTENT, {
    ...data,
    documentId,
    cachedAt: Date.now(),
  });
}

export async function getCachedDocument(
  documentId: string,
): Promise<CachedDocumentContent | undefined> {
  const db = await getDB();
  return db.get(STORE_DOCUMENT_CONTENT, documentId);
}

// ─── User profile ─────────────────────────────────────────────────────────────

export async function cacheUserProfile(data: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  await db.put(STORE_USER_PROFILE, {
    ...data,
    key: "current",
    cachedAt: Date.now(),
  });
}

export async function getCachedUserProfile(): Promise<CachedUserProfile | undefined> {
  const db = await getDB();
  return db.get(STORE_USER_PROFILE, "current");
}
