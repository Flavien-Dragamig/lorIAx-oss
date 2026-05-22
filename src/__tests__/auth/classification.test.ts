import { describe, it, expect } from "vitest";
import {
  isClassificationAllowed,
  getAllowedDocClassifications,
  canShareExternally,
  getClassificationLevel,
  compareClassifications,
  getDefaultDocClassification,
} from "@/lib/auth/classification";

describe("getClassificationLevel", () => {
  it("retourne les niveaux corrects", () => {
    expect(getClassificationLevel("public")).toBe(1);
    expect(getClassificationLevel("internal")).toBe(2);
    expect(getClassificationLevel("confidential")).toBe(3);
    expect(getClassificationLevel("secret")).toBe(4);
  });
});

describe("isClassificationAllowed", () => {
  it("un document public est autorisé dans un espace public", () => {
    expect(isClassificationAllowed("public", "public")).toBe(true);
  });

  it("un document public n'est PAS autorisé dans un espace internal", () => {
    expect(isClassificationAllowed("public", "internal")).toBe(false);
  });

  it("un document secret est autorisé dans un espace public", () => {
    expect(isClassificationAllowed("secret", "public")).toBe(true);
  });

  it("un document confidential est autorisé dans un espace confidential", () => {
    expect(isClassificationAllowed("confidential", "confidential")).toBe(true);
  });
});

describe("getAllowedDocClassifications", () => {
  it("un espace public autorise tous les niveaux", () => {
    expect(getAllowedDocClassifications("public")).toEqual([
      "public", "internal", "confidential", "secret",
    ]);
  });

  it("un espace confidential n'autorise que confidential et secret", () => {
    expect(getAllowedDocClassifications("confidential")).toEqual([
      "confidential", "secret",
    ]);
  });

  it("un espace secret n'autorise que secret", () => {
    expect(getAllowedDocClassifications("secret")).toEqual(["secret"]);
  });
});

describe("canShareExternally", () => {
  it("partage possible uniquement si doc ET espace sont public", () => {
    expect(canShareExternally("public", "public")).toBe(true);
    expect(canShareExternally("public", "internal")).toBe(false);
    expect(canShareExternally("internal", "public")).toBe(false);
    expect(canShareExternally("confidential", "public")).toBe(false);
  });
});

describe("compareClassifications", () => {
  it("public < internal", () => {
    expect(compareClassifications("public", "internal")).toBeLessThan(0);
  });

  it("secret > public", () => {
    expect(compareClassifications("secret", "public")).toBeGreaterThan(0);
  });

  it("internal === internal", () => {
    expect(compareClassifications("internal", "internal")).toBe(0);
  });
});

describe("getDefaultDocClassification", () => {
  it("hérite du niveau de l'espace", () => {
    expect(getDefaultDocClassification("confidential")).toBe("confidential");
    expect(getDefaultDocClassification("public")).toBe("public");
  });
});
