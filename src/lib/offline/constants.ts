// Offline cache constants

/** IndexedDB database name */
export const DB_NAME = "loriax-offline";

/** IndexedDB schema version — v2: added pending-operations store */
export const DB_VERSION = 2;

/** Store names */
export const STORE_SPACES = "spaces";
export const STORE_DOCUMENT_TREE = "document-tree";
export const STORE_DOCUMENT_CONTENT = "document-content";
export const STORE_USER_PROFILE = "user-profile";
export const STORE_PENDING_OPS = "pending-operations";

/** Maximum cache age in days */
export const MAX_CACHE_AGE_DAYS = 30;
