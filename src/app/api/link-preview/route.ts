import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { validateExternalUrl } from "@/lib/security/url-validator";
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import logger from "@/lib/logger";

/** Strip HTML tags and decode common entities to prevent stored XSS via metadata. */
function stripHtml(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

// Cache en mémoire avec TTL de 24h
const CACHE_TTL = 24 * 60 * 60 * 1000;
const previewCache = new Map<
  string,
  { data: Record<string, string | null>; expiresAt: number }
>();

// Nettoyage périodique (toutes les heures)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of previewCache) {
    if (entry.expiresAt <= now) previewCache.delete(key);
  }
}, 60 * 60 * 1000).unref();

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let url: string;
  try {
    const body = await request.json();
    url = body.url;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rl = checkRateLimit(`link-preview:${ip}`, RATE_LIMITS.linkPreview);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  // Validate URL format + SSRF protection
  const urlError = validateExternalUrl(url);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  // Vérifier le cache
  const cached = previewCache.get(parsedUrl.href);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch with timeout (5s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LorIAx-Bot/1.0 (Link Preview)",
        Accept: "text/html, application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Impossible de récupérer la page (${response.status})` },
        { status: 422 }
      );
    }

    const html = await response.text();

    // Dynamic import for metascraper (ESM modules)
    const metascraper = (await import("metascraper")).default;
    const metascraperTitle = (await import("metascraper-title")).default;
    const metascraperDescription = (await import("metascraper-description")).default;
    const metascraperImage = (await import("metascraper-image")).default;
    const metascraperUrl = (await import("metascraper-url")).default;

    const scraper = metascraper([
      metascraperTitle(),
      metascraperDescription(),
      metascraperImage(),
      metascraperUrl(),
    ]);

    const metadata = await scraper({ html, url: parsedUrl.href });

    // SEC-09 — Valider le protocole de l'URL image (http/https uniquement)
    let safeImage: string | null = null;
    if (metadata.image) {
      try {
        const imageUrl = new URL(metadata.image);
        if (imageUrl.protocol === "http:" || imageUrl.protocol === "https:") {
          safeImage = metadata.image;
        }
      } catch {
        // URL invalide, on ignore l'image
      }
    }

    const result = {
      title: stripHtml(metadata.title) || null,
      description: stripHtml(metadata.description) || null,
      image: safeImage,
      url: metadata.url || parsedUrl.href,
    };

    // Stocker en cache
    previewCache.set(parsedUrl.href, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Délai d'attente dépassé (5s)" },
        { status: 408 }
      );
    }
    logger.error({ err, url: parsedUrl.href }, "Erreur link preview");
    return NextResponse.json(
      { error: "Erreur lors de la récupération des métadonnées" },
      { status: 500 }
    );
  }
}
