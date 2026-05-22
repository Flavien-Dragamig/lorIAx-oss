import { Hocuspocus } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import * as Y from "yjs";
import { verifyWsToken, checkDocumentAccess, checkDocumentEditAccess } from "./auth-ws";
import { fetchYjsState, storeYjsState } from "./yjs-persistence";
import { syncYjsToStorage } from "./markdown-sync";
import logger from "@/lib/logger";

// UUID v4 format validation (H5 — reject invalid document names)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Debounce map for storage sync (avoid git commit on every keystroke)
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 30_000; // 30 seconds

/**
 * Create and configure the Hocuspocus collaboration server.
 */
export function createHocuspocusServer(): Hocuspocus {
  const server = new Hocuspocus({
    name: "loriax-collab",
    timeout: 30000,
    debounce: 2000,
    maxDebounce: 10000,
    quiet: process.env.NODE_ENV === "production",

    async onAuthenticate(data: { token: string; documentName: string }) {
      // Validate documentName is a valid UUID (H5 — prevent path traversal / injection)
      if (!UUID_RE.test(data.documentName)) {
        logger.warn({ documentName: data.documentName }, "[collab] Invalid documentName format — not a UUID");
        throw new Error("Identifiant de document invalide");
      }

      // Verify JWT
      const user = await verifyWsToken(data.token);
      if (!user) {
        logger.warn({ documentName: data.documentName }, "[collab] JWT verification failed — Non autorisé");
        throw new Error("Non autorisé");
      }

      logger.info({ userId: user.id, globalRole: user.globalRole, documentName: data.documentName }, "[collab] JWT OK, checking access...");

      // Check document access
      const hasAccess = await checkDocumentAccess(user.id, data.documentName, user.globalRole);
      if (!hasAccess) {
        logger.warn({ userId: user.id, globalRole: user.globalRole, documentName: data.documentName }, "[collab] checkDocumentAccess returned false — Accès refusé");
        throw new Error("Accès refusé");
      }

      // Return user context (available in other hooks via context)
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      };
    },

    extensions: [
      new Database({
        async fetch(data: { documentName: string }) {
          const state = await fetchYjsState(data.documentName);
          return state || null;
        },

        async store(data: { documentName: string; state: Uint8Array; context: Record<string, unknown> }) {
          // Re-check edit permissions before storing (C3 — revoked access during session)
          const user = data.context?.user as { id: string; name: string; email: string } | undefined;
          if (user?.id) {
            const hasEditAccess = await checkDocumentEditAccess(user.id, data.documentName);
            if (!hasEditAccess) {
              logger.warn({ userId: user.id, documentName: data.documentName }, "[collab] Edit access revoked — store blocked");
              return;
            }
          }

          // Store Yjs state immediately
          await storeYjsState(data.documentName, data.state);

          // Debounced sync to filesystem + git
          const existingTimer = syncTimers.get(data.documentName);
          if (existingTimer) clearTimeout(existingTimer);

          const userId = user?.id;
          syncTimers.set(
            data.documentName,
            setTimeout(async () => {
              syncTimers.delete(data.documentName);
              try {
                const ydoc = new Y.Doc();
                Y.applyUpdate(ydoc, data.state);
                await syncYjsToStorage(data.documentName, ydoc, userId);
                ydoc.destroy();
              } catch (err) {
                logger.error({ err }, "[hocuspocus] Sync error");
              }
            }, SYNC_DEBOUNCE_MS)
          );
        },
      }),
    ],

    async onDisconnect(data: { documentName: string }) {
      // Flush pending sync on last disconnect
      const timer = syncTimers.get(data.documentName);
      if (timer) {
        clearTimeout(timer);
        syncTimers.delete(data.documentName);

        try {
          const state = await fetchYjsState(data.documentName);
          if (state) {
            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, state);
            await syncYjsToStorage(data.documentName, ydoc);
            ydoc.destroy();
          }
        } catch (err) {
          logger.error({ err }, "[hocuspocus] Disconnect sync error");
        }
      }
    },
  });

  return server;
}
