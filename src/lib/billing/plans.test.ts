import { describe, it, expect } from "vitest";
import { PLANS, getPlanLimits, resolvePlanId, RESERVED_SLUGS, CLOUD_PRICES_EUR, SELFHOSTED_PRICES_EUR } from "./plans";

describe("PLANS", () => {
  it("free a 5 users max et 1 Go de stockage", () => {
    expect(PLANS.free.maxUsers).toBe(5);
    expect(PLANS.free.maxStorageGB).toBe(1);
  });

  it("growth a utilisateurs illimités et 50 Go", () => {
    expect(PLANS.growth.maxUsers).toBeNull();
    expect(PLANS.growth.maxSpaces).toBeNull();
    expect(PLANS.growth.maxStorageGB).toBe(50);
  });

  it("growth inclut SAML et audit-log", () => {
    expect(PLANS.growth.features).toContain("saml");
    expect(PLANS.growth.features).toContain("audit-log");
  });

  it("enterprise inclut white-label et SLA", () => {
    expect(PLANS.enterprise.features).toContain("white-label");
    expect(PLANS.enterprise.features).toContain("sla");
  });

  it("getPlanLimits retourne les limites du plan growth", () => {
    const limits = getPlanLimits("growth");
    expect(limits.maxUsers).toBeNull();
    expect(limits.maxStorageGB).toBe(50);
  });

  it("getPlanLimits fallback sur free pour plan inconnu", () => {
    const limits = getPlanLimits("unknown");
    expect(limits.maxUsers).toBe(5);
  });

  it("resolvePlanId remappe les alias historiques starter/pro/team vers growth", () => {
    expect(resolvePlanId("starter")).toBe("growth");
    expect(resolvePlanId("pro")).toBe("growth");
    expect(resolvePlanId("team")).toBe("growth");
  });

  it("resolvePlanId remappe community vers free", () => {
    expect(resolvePlanId("community")).toBe("free");
  });

  it("RESERVED_SLUGS contient www et admin", () => {
    expect(RESERVED_SLUGS).toContain("www");
    expect(RESERVED_SLUGS).toContain("admin");
  });

  it("cloud growth coûte 9 € et self-hosted growth 5 €", () => {
    expect(CLOUD_PRICES_EUR.growth).toBe(9);
    expect(SELFHOSTED_PRICES_EUR.growth).toBe(5);
  });
});
