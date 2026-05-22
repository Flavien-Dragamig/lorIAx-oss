/**
 * Rate limiter with in-memory backend (single instance) and optional Redis backend.
 * Set REDIS_URL in env to enable Redis backend for multi-instance deployments.
 */

import logger from "@/lib/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

// ─── Backend interface ──────────────────────────────────────────────────────

interface RateLimitBackend {
  check(key: string, config: RateLimitConfig): Promise<RateLimitResult> | RateLimitResult;
}

// ─── In-memory backend ──────────────────────────────────────────────────────

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

const memoryBackend: RateLimitBackend = {
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.resetAt <= now) {
      memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
      return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    if (entry.count >= config.maxRequests) {
      return { success: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
  },
};

// ─── Redis backend (lazy-initialized) ───────────────────────────────────────

let redisBackend: RateLimitBackend | null = null;
let redisInitAttempted = false;

async function getRedisBackend(): Promise<RateLimitBackend | null> {
  if (redisInitAttempted) return redisBackend;
  redisInitAttempted = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    // Dynamic import to avoid bundling ioredis when not used
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();

    redisBackend = {
      async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
        const now = Date.now();
        const windowKey = `rl:${key}`;
        const _windowSec = Math.ceil(config.windowMs / 1000);

        const multi = redis.multi();
        multi.incr(windowKey);
        multi.pttl(windowKey);
        const results = await multi.exec();

        const count = (results?.[0]?.[1] as number) ?? 1;
        const ttl = (results?.[1]?.[1] as number) ?? -1;

        // Set expiry on first request in window
        if (count === 1 || ttl === -1) {
          await redis.pexpire(windowKey, config.windowMs);
        }

        const resetAt = ttl > 0 ? now + ttl : now + config.windowMs;
        const remaining = Math.max(0, config.maxRequests - count);

        return {
          success: count <= config.maxRequests,
          remaining,
          resetAt,
        };
      },
    };

    logger.info("[rate-limit] Redis backend initialized");
    return redisBackend;
  } catch (err) {
    logger.warn({ err }, "[rate-limit] Redis unavailable, using in-memory backend");
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check rate limit for a given identifier (e.g. IP address, user ID).
 * Synchronous — always uses in-memory backend.
 * For Redis-backed rate limiting, use checkRateLimitAsync().
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  return memoryBackend.check(identifier, config) as RateLimitResult;
}

/**
 * Async rate limit check — preferred when Redis is configured.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const backend = await getRedisBackend();
  if (backend) {
    return backend.check(identifier, config);
  }
  return memoryBackend.check(identifier, config);
}

/** Rate limit presets */
export const RATE_LIMITS = {
  /** Login/Register: 10 attempts per 15 minutes */
  auth: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  /** Search: 60 requests per minute */
  search: { maxRequests: 60, windowMs: 60 * 1000 },
  /** AI chat: 20 requests per minute */
  ai: { maxRequests: 20, windowMs: 60 * 1000 },
  /** AI embed: 30 requests per minute (coût API élevé) */
  embed: { maxRequests: 30, windowMs: 60 * 1000 },
  /** Link preview: 30 requests per minute */
  linkPreview: { maxRequests: 30, windowMs: 60 * 1000 },
  /** Routing (OSRM): 30 requests per minute */
  routing: { maxRequests: 30, windowMs: 60 * 1000 },
  /** Meet: 20 requests per minute */
  meet: { maxRequests: 20, windowMs: 60 * 1000 },
} as const;

/**
 * Number of trusted reverse proxies in front of the app.
 * In a typical setup (nginx → app), this is 1.
 * The rightmost IP in x-forwarded-for added by the trusted proxy is used.
 */
const TRUSTED_PROXY_COUNT = parseInt(process.env.TRUSTED_PROXY_COUNT || "1", 10);

/**
 * Extract client IP from request headers.
 * Uses the rightmost IP minus trusted proxy count to prevent spoofing.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    // The last N IPs are added by trusted proxies; the client IP is right before them
    const clientIndex = Math.max(0, ips.length - TRUSTED_PROXY_COUNT);
    return ips[clientIndex] || "unknown";
  }
  return "unknown";
}
