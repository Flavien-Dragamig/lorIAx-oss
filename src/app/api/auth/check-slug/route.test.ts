import { describe, it, expect } from "vitest";
import { isValidSlug, isReservedSlug } from "@/lib/billing/slug-validation";

describe("isValidSlug", () => {
  it("accepte un slug valide", () => expect(isValidSlug("mon-equipe")).toBe(true));
  it("refuse les majuscules", () => expect(isValidSlug("MonEquipe")).toBe(false));
  it("refuse moins de 3 caractères", () => expect(isValidSlug("ab")).toBe(false));
  it("refuse plus de 32 caractères", () => expect(isValidSlug("a".repeat(33))).toBe(false));
  it("refuse les underscores", () => expect(isValidSlug("mon_equipe")).toBe(false));
});

describe("isReservedSlug", () => {
  it("www est réservé", () => expect(isReservedSlug("www")).toBe(true));
  it("admin est réservé", () => expect(isReservedSlug("admin")).toBe(true));
  it("acme n'est pas réservé", () => expect(isReservedSlug("acme")).toBe(false));
});
