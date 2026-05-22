import { describe, it, expect } from "vitest";
import {
  canViewDocument,
  canEditDocument,
  canAdminSpace,
  canViewByClassification,
  hasGlobalRole,
  hasPermissionLevel,
} from "@/lib/auth/rbac";

describe("hasGlobalRole", () => {
  it("super_admin a tous les rôles", () => {
    expect(hasGlobalRole("super_admin", "viewer")).toBe(true);
    expect(hasGlobalRole("super_admin", "editor")).toBe(true);
    expect(hasGlobalRole("super_admin", "admin")).toBe(true);
    expect(hasGlobalRole("super_admin", "super_admin")).toBe(true);
  });

  it("viewer ne peut pas être admin", () => {
    expect(hasGlobalRole("viewer", "admin")).toBe(false);
    expect(hasGlobalRole("viewer", "editor")).toBe(false);
  });
});

describe("hasPermissionLevel", () => {
  it("admin inclut editor et viewer", () => {
    expect(hasPermissionLevel("admin", "viewer")).toBe(true);
    expect(hasPermissionLevel("admin", "editor")).toBe(true);
    expect(hasPermissionLevel("admin", "admin")).toBe(true);
  });

  it("viewer ne peut pas être editor", () => {
    expect(hasPermissionLevel("viewer", "editor")).toBe(false);
  });
});

describe("canViewDocument", () => {
  it("admin global peut tout voir", () => {
    expect(canViewDocument("admin", null, null)).toBe(true);
    expect(canViewDocument("super_admin", null, null)).toBe(true);
  });

  it("viewer sans permission espace ne peut pas voir", () => {
    expect(canViewDocument("viewer", null, null)).toBe(false);
  });

  it("viewer avec permission espace viewer peut voir", () => {
    expect(canViewDocument("viewer", "viewer", null)).toBe(true);
  });

  it("permission document prime sur permission espace", () => {
    expect(canViewDocument("viewer", null, "viewer")).toBe(true);
  });
});

describe("canEditDocument", () => {
  it("admin global peut tout éditer", () => {
    expect(canEditDocument("admin", null, null)).toBe(true);
  });

  it("viewer ne peut pas éditer", () => {
    expect(canEditDocument("viewer", "viewer", null)).toBe(false);
  });

  it("editor avec permission espace editor peut éditer", () => {
    expect(canEditDocument("viewer", "editor", null)).toBe(true);
  });

  it("permission document editor donne accès", () => {
    expect(canEditDocument("viewer", null, "editor")).toBe(true);
  });
});

describe("canAdminSpace", () => {
  it("admin global peut administrer", () => {
    expect(canAdminSpace("admin")).toBe(true);
  });

  it("viewer ne peut pas administrer", () => {
    expect(canAdminSpace("viewer", "viewer")).toBe(false);
  });

  it("permission espace admin donne accès", () => {
    expect(canAdminSpace("viewer", "admin")).toBe(true);
  });
});

describe("canViewByClassification", () => {
  const baseOptions = {
    isAuthenticated: true,
    isSpaceMember: false,
    isSpaceAdmin: false,
    isDocumentAuthor: false,
    userGlobalRole: "viewer" as const,
  };

  it("public est visible par tous", () => {
    expect(canViewByClassification("public", { ...baseOptions, isAuthenticated: false })).toBe(true);
  });

  it("internal nécessite authentification", () => {
    expect(canViewByClassification("internal", { ...baseOptions, isAuthenticated: false })).toBe(false);
    expect(canViewByClassification("internal", baseOptions)).toBe(true);
  });

  it("confidential nécessite membership espace", () => {
    expect(canViewByClassification("confidential", baseOptions)).toBe(false);
    expect(canViewByClassification("confidential", { ...baseOptions, isSpaceMember: true })).toBe(true);
  });

  it("secret nécessite auteur ou admin espace", () => {
    expect(canViewByClassification("secret", { ...baseOptions, isSpaceMember: true })).toBe(false);
    expect(canViewByClassification("secret", { ...baseOptions, isDocumentAuthor: true })).toBe(true);
    expect(canViewByClassification("secret", { ...baseOptions, isSpaceAdmin: true })).toBe(true);
  });

  it("admin global a accès à tout", () => {
    expect(
      canViewByClassification("secret", { ...baseOptions, userGlobalRole: "admin" })
    ).toBe(true);
  });
});
