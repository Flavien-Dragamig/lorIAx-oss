import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// Resolve __dirname for ESM compatibility (Node 18)
const __configDir = path.dirname(fileURLToPath(import.meta.url));

// CSP désormais gérée dynamiquement par le middleware (nonce-based)
// Les headers statiques ci-dessous sont des fallbacks pour les assets statiques

const s3PublicUrl = process.env.S3_PUBLIC_URL || "http://localhost:3900";
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@excalidraw/excalidraw"],
  async headers() {
    return [
      {
        source: "/video-editor/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: `camera=(self), microphone=(self), geolocation=()`,
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // CSP dynamique avec nonce gérée par le middleware (src/middleware.ts)
        ],
      },
    ];
  },
  async rewrites() {
    const penpotUrl = process.env.PENPOT_INTERNAL_URL;
    if (!penpotUrl) return [];
    return [
      {
        source: "/penpot/:path*",
        destination: `${penpotUrl}/:path*`,
      },
    ];
  },
  images: {
    localPatterns: [
      { pathname: "/api/user/avatar", search: "**" },
      { pathname: "/favicon-32.png" },
      { pathname: "/favicon*.png" },
    ],
    remotePatterns: (() => {
      const patterns: Array<{ protocol: "http" | "https"; hostname: string; port?: string; pathname?: string }> = [
        // Avatars externes (pravatar, gravatar)
        { protocol: "https", hostname: "i.pravatar.cc" },
        { protocol: "https", hostname: "*.gravatar.com" },
      ];
      try {
        const url = new URL(s3PublicUrl);
        patterns.push({
          protocol: url.protocol.replace(":", "") as "http" | "https",
          hostname: url.hostname,
          port: url.port || undefined,
          pathname: "/loriax-files/**",
        });
      } catch {
        patterns.push({
          protocol: "http",
          hostname: "localhost",
          port: "9000",
          pathname: "/loriax-files/**",
        });
      }
      return patterns;
    })(),
  },
  serverExternalPackages: ["re2", "metascraper", "metascraper-description", "metascraper-image", "metascraper-title", "metascraper-url", "ldapjs", "pino", "thread-stream", "ioredis", "esbuild-wasm", "yjs", "y-protocols", "@hocuspocus/server", "@hocuspocus/extension-database"],
  turbopack: {
    root: __configDir,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

// PERF-13 — Bundle analyzer (lancé avec ANALYZE=true npm run build)
// Chargement conditionnel : @next/bundle-analyzer reste en devDependencies
// et n'est requis qu'en build local d'analyse.
const analyzer: (cfg: NextConfig) => NextConfig =
  process.env.ANALYZE === "true"
    ? createRequire(import.meta.url)("@next/bundle-analyzer")({ enabled: true })
    : (cfg) => cfg;
export default withSerwist(analyzer(nextConfig));
