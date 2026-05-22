/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // Google Fonts — StaleWhileRevalidate
    {
      matcher: ({ url }) =>
        url.origin === "https://fonts.googleapis.com" ||
        url.origin === "https://fonts.gstatic.com",
      handler: new StaleWhileRevalidate({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          }),
        ],
      }),
    },
    // S3/Garage images — CacheFirst, 30 days
    {
      matcher: ({ request, url }) =>
        request.destination === "image" &&
        (url.pathname.startsWith("/loriax-files/") ||
          url.pathname.startsWith("/api/user/avatar")),
      handler: new CacheFirst({
        cacheName: "s3-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
    },
    // API spaces / document tree — NetworkFirst, 5 min fallback
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/spaces"),
      handler: new NetworkFirst({
        cacheName: "api-spaces",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 5, // 5 minutes
          }),
        ],
      }),
    },
    // Auth, WebSocket, AI, Meet — NetworkOnly (never cache)
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/auth/") ||
        url.pathname.startsWith("/ws/") ||
        url.pathname.startsWith("/api/ai/") ||
        url.pathname.startsWith("/api/meet/") ||
        url.pathname === "/api/ping" ||
        url.pathname === "/api/health",
      handler: new NetworkOnly(),
    },
    // Document content APIs — NetworkOnly (contenu toujours frais)
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/documents/") ||
        url.pathname.startsWith("/api/mindmap/") ||
        url.pathname.startsWith("/api/whiteboard/") ||
        url.pathname.startsWith("/api/attachments/"),
      handler: new NetworkOnly(),
    },
    // Navigation (pages HTML) :
    // - Dev : NetworkOnly — cohérent avec defaultCache Turbopack, jamais de cache HTML en dev
    // - Prod : NetworkFirst — réseau prioritaire, cache fallback si offline
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler:
        process.env.NODE_ENV === "production"
          ? new NetworkFirst({
              cacheName: "pages-v2",
              networkTimeoutSeconds: 4,
              plugins: [
                new ExpirationPlugin({
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24,
                }),
              ],
            })
          : new NetworkOnly(),
    },
    // Payloads RSC (navigation SPA Next.js) — jamais de cache, toujours le réseau
    {
      matcher: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
        sameOrigin && request.headers.get("RSC") === "1",
      handler: new NetworkOnly(),
    },
    // Remaining strategies from defaultCache
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Caches runtime autorisés — tout autre cache (ancienne stratégie renommée, etc.) est supprimé à l'activation
const ALLOWED_RUNTIME_CACHES = new Set([
  "google-fonts",
  "s3-images",
  "api-spaces",
  "pages-v2",
]);

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (name) =>
              !name.includes("serwist-precache") &&
              !ALLOWED_RUNTIME_CACHES.has(name)
          )
          .map((name) => {
            console.log(`[SW] Suppression ancien cache : ${name}`);
            return caches.delete(name);
          })
      )
    )
  );
});

serwist.addEventListeners();
