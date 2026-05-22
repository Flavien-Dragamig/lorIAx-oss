import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const config = { maxRequests: 3, windowMs: 60_000 };

  it("autorise les premières requêtes", () => {
    const key = `test-allow-${Date.now()}`;
    const result = checkRateLimit(key, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("bloque après le quota atteint", () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2
    checkRateLimit(key, config); // 3

    const result = checkRateLimit(key, config); // 4 → bloqué
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("retourne le nombre restant correct", () => {
    const key = `test-remaining-${Date.now()}`;
    expect(checkRateLimit(key, config).remaining).toBe(2);
    expect(checkRateLimit(key, config).remaining).toBe(1);
    expect(checkRateLimit(key, config).remaining).toBe(0);
  });

  it("isole les identifiants différents", () => {
    const key1 = `test-isolate-a-${Date.now()}`;
    const key2 = `test-isolate-b-${Date.now()}`;

    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);

    // key2 n'est pas affecté
    const result = checkRateLimit(key2, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });
});
