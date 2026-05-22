import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/signup", "/forgot-password", "/reset-password", "/public", "/offline"];

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "";

function resolveOrgSlug(req: NextRequest): string {
  const host = req.headers.get("host") ?? "";
  const { pathname } = req.nextUrl;

  // Mode sous-domaine : acme.loriax.app → slug "acme"
  if (ROOT_DOMAIN && host.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = host.slice(0, host.length - ROOT_DOMAIN.length - 1);
    if (subdomain && subdomain !== "www") return subdomain;
  }

  // Mode path : /org/acme/... → slug "acme"
  const pathMatch = pathname.match(/^\/org\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  return "default";
}

// CSP dynamique avec nonce — sources configurables via env vars
const s3PublicUrl = process.env.S3_PUBLIC_URL || "http://localhost:3900";
const wsUrl = process.env.WS_URL || "";
const livekitUrl = process.env.LIVEKIT_URL || "";

function buildCsp(nonce: string): string {
  // Extract LiveKit host for CSP connect-src (ws://host → wss://host)
  let livekitCsp = "";
  if (livekitUrl) {
    try {
      const parsed = new URL(livekitUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:"));
      livekitCsp = ` wss://${parsed.host} ws://${parsed.host} https://${parsed.host} http://${parsed.host}`;
    } catch {
      // Invalid URL — skip
    }
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${s3PublicUrl} https://*.tile.openstreetmap.org https://i.pravatar.cc https://*.gravatar.com https://images.unsplash.com`,
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' ${s3PublicUrl}${wsUrl ? ` ${wsUrl}` : ""}${livekitCsp} https://nominatim.openstreetmap.org${process.env.NODE_ENV === "development" ? " ws://localhost:* wss://localhost:*" : ""}`,
    `frame-src 'self' https://docs.google.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Setup wizard — accessible sans authentification
  if (pathname === "/setup" || pathname.startsWith("/setup/") || pathname.startsWith("/api/setup/")) {
    return await syncOrgCookie(req, addCspHeaders(req));
  }

  // Laisser passer les routes publiques
  if (
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/api/auth/")
  ) {
    return await syncOrgCookie(req, addCspHeaders(req));
  }

  // Laisser passer les healthchecks et le ping réseau
  if (pathname === "/api/health" || pathname === "/api/ping") {
    return NextResponse.next();
  }

  // API v1 : l'authentification se fait via Bearer token dans la route handler
  if (pathname.startsWith("/api/v1/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-org-slug", resolveOrgSlug(req));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // API publique : accès sans authentification (partage externe)
  if (pathname.startsWith("/api/public/")) {
    return addCspHeaders(req);
  }

  // CalDAV : authentification gérée dans le handler (Basic Auth / Bearer)
  if (pathname.startsWith("/api/caldav/") || pathname.startsWith("/.well-known/caldav")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-org-slug", resolveOrgSlug(req));
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // APIs internes : pas de CSP HTML nécessaire
  if (pathname.startsWith("/api/")) {
    return checkAuth(req);
  }

  // Vérifier l'authentification + ajouter CSP avec nonce pour les pages HTML
  const authResult = await checkAuth(req);
  if (authResult.status === 307 || authResult.status === 302) return authResult;

  return await syncOrgCookie(req, addCspHeaders(req));
}

/**
 * Synchronise un cookie public `lrx_org=<slug>` sur le domaine racine
 * (`.loriax.fr`). Permet au site marketing (loriax.fr) de détecter qu'un
 * visiteur est connecté et de basculer « Se connecter » en « Mon LorIAx »
 * pointant vers https://<slug>.<root-domain>/.
 *
 * Contenu : slug d'organisation uniquement (déjà public via le sous-domaine).
 * Non-httpOnly pour lecture côté JS du site marketing.
 */
async function syncOrgCookie(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  if (!ROOT_DOMAIN) return res;

  const secureCookie = process.env.NODE_ENV === "production";
  const cookieName = secureCookie
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName,
    salt: cookieName,
  });

  const slug = token ? ((token as { orgSlug?: string }).orgSlug) : undefined;
  const existing = req.cookies.get("lrx_org")?.value;

  if (slug) {
    if (existing !== slug) {
      res.cookies.set("lrx_org", slug, {
        domain: `.${ROOT_DOMAIN}`,
        path: "/",
        sameSite: "lax",
        secure: secureCookie,
        httpOnly: false,
        maxAge: 24 * 60 * 60,
      });
    }
  } else if (existing) {
    res.cookies.set("lrx_org", "", {
      domain: `.${ROOT_DOMAIN}`,
      path: "/",
      sameSite: "lax",
      secure: secureCookie,
      httpOnly: false,
      maxAge: 0,
    });
  }
  return res;
}

/** Vérifie le JWT et redirige vers /login si absent */
async function checkAuth(req: NextRequest): Promise<NextResponse> {
  const secureCookie = process.env.NODE_ENV === "production";
  const cookieName = secureCookie
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName, salt: cookieName });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-org-slug", resolveOrgSlug(req));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Génère un nonce, l'injecte dans les headers de requête (pour que Next.js
 * l'applique automatiquement aux <script>) ET dans les headers de réponse
 * (pour le navigateur).
 */
function addCspHeaders(req: NextRequest): NextResponse {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Propager le CSP dans les headers de requête pour que Next.js extraie le nonce
  // et l'injecte dans ses <script> tags (App Router, getScriptNonceFromHeader)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-org-slug", resolveOrgSlug(req));

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Aussi sur la réponse pour le navigateur
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-csp-nonce", nonce);
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|serwist/|sw\\.js|sw\\.js\\.map|swe-worker-.*\\.js).*)"],
};
