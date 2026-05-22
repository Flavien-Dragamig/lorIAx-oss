import { createServer } from "http";
import { parse } from "url";
import path from "path";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { createHocuspocusServer } from "./src/lib/collab/hocuspocus-config";
import { ChatServer } from "./src/lib/chat/chat-server";
import httpProxy from "http-proxy";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Run DB migrations on startup
  const migrationsFolder = dev
    ? path.join(__dirname, "src/lib/db/migrations")
    : path.join(__dirname, "migrations");

  const migrationPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const migrationDb = drizzle(migrationPool);
  try {
    await migrate(migrationDb, { migrationsFolder });
    console.log("✓ Migrations appliquées");
  } catch (err) {
    console.error("✗ Échec des migrations:", err);
    process.exit(1);
  } finally {
    await migrationPool.end();
  }

  // Initialize Next.js
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  // Initialize backup scheduler
  const { initBackupScheduler } = await import("./src/lib/backup/scheduler");
  await initBackupScheduler();

  // Initialize telemetry scheduler
  const { initTelemetryScheduler } = await import(
    "./src/lib/telemetry/scheduler"
  );
  await initTelemetryScheduler();

  // Initialize video render worker
  const { startRenderWorker } = await import("./src/lib/video/render-worker");
  startRenderWorker();

  // Schedule daily chat digest at 08:00
  const { Cron } = await import("croner");
  const { sendChatDigests } = await import("./src/lib/chat/chat-notifications");
  new Cron("0 8 * * *", async () => {
    console.log("[chat-scheduler] Envoi des digests...");
    await sendChatDigests().catch((err) => console.error("[chat-scheduler] Erreur:", err));
  });

  // Schedule daily message retention purge at 03:00
  const { purgeExpiredMessages } = await import("./src/lib/chat/retention");
  new Cron("0 3 * * *", async () => {
    console.log("[chat-retention] Purge des messages expirés...");
    await purgeExpiredMessages().catch((err) => console.error("[chat-retention] Erreur:", err));
  });

  // Initialize Hocuspocus collaboration server
  const hocuspocus = createHocuspocusServer();

  // Initialize Chat WebSocket server
  const chatServer = new ChatServer();

  // Create bare WebSocket server (no HTTP server — we handle upgrades manually)
  const wss = new WebSocketServer({ noServer: true });

  // Proxy for Penpot frontend (iframe) — fallback sur localhost:9002 si PENPOT_FRONTEND_URL absent
  const penpotFrontendUrl = process.env.PENPOT_FRONTEND_URL || "http://localhost:9002";
  const penpotProxy = httpProxy.createProxyServer({ target: penpotFrontendUrl, changeOrigin: true });

  penpotProxy.on("error", (err, _req, res) => {
    console.error("[penpot-proxy] error:", err.message);
    if ("writeHead" in res && typeof res.writeHead === "function") {
      (res as import("http").ServerResponse).writeHead(502, { "Content-Type": "text/plain" });
      (res as import("http").ServerResponse).end("Penpot frontend unavailable");
    }
  });

  // Create HTTP server
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    const method = req.method?.toUpperCase();
    const pathname = parsedUrl.pathname || "";

    // Penpot frontend proxy: /penpot/* → Penpot frontend container (toujours actif)
    if (pathname.startsWith("/penpot/") || pathname === "/penpot") {
      // Rewrite path: /penpot/foo → /foo
      req.url = pathname.replace(/^\/penpot/, "") || "/";
      if (parsedUrl.search) req.url += parsedUrl.search;
      penpotProxy.web(req, res);
      return;
    }

    // CalDAV: rewrite PROPFIND/REPORT to POST with X-HTTP-Method-Override
    // Next.js does not support non-standard HTTP methods natively
    if (
      pathname.startsWith("/api/caldav/") &&
      (method === "PROPFIND" || method === "REPORT")
    ) {
      req.headers["x-http-method-override"] = method;
      (req as unknown as { method: string }).method = "POST";
    }

    handle(req, res, parsedUrl);
  });

  // Handle WebSocket upgrades
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);

    if (pathname === "/ws/chat") {
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        chatServer.handleConnection(ws);
      });
      return;
    }

    if (pathname === "/ws/collab") {
      // Upgrade to WebSocket, then pass to Hocuspocus
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        hocuspocus.handleConnection(ws, req);
      });
    } else if (pathname?.startsWith("/penpot/ws") || pathname?.startsWith("/api/penpot/ws")) {
      // Penpot WebSocket — goes to backend (6060) for API WS, or frontend for workspace WS
      const wsTarget = penpotFrontendUrl || process.env.PENPOT_INTERNAL_URL;
      if (wsTarget) {
        const wsProxy = httpProxy.createProxyServer({ target: wsTarget, ws: true });
        // Rewrite /penpot/ws/... → /ws/...
        req.url = (pathname || "").replace(/^\/penpot/, "") || "/";
        wsProxy.ws(req, socket, head);
      }
    }
    // Other upgrades (Next.js HMR in dev) are handled by Next.js itself
  });

  server.listen(port, hostname, () => {
    console.log(`> LorIAx server ready on http://${hostname}:${port}`);
    console.log(`> Collaboration WebSocket on ws://${hostname}:${port}/ws/collab`);
    console.log(`> Mode: ${dev ? "development" : "production"}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
