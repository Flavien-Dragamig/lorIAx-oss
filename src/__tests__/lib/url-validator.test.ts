import { describe, it, expect } from "vitest";
import { isPrivateUrl, validateExternalUrl } from "@/lib/security/url-validator";

describe("isPrivateUrl", () => {
  it("détecte les adresses loopback", () => {
    expect(isPrivateUrl(new URL("http://127.0.0.1"))).toBe(true);
    expect(isPrivateUrl(new URL("http://127.0.0.1:3000"))).toBe(true);
  });

  it("détecte les plages privées de classe A", () => {
    expect(isPrivateUrl(new URL("http://10.0.0.1"))).toBe(true);
    expect(isPrivateUrl(new URL("http://10.255.255.255"))).toBe(true);
  });

  it("détecte les plages privées de classe B", () => {
    expect(isPrivateUrl(new URL("http://172.16.0.1"))).toBe(true);
    expect(isPrivateUrl(new URL("http://172.31.255.255"))).toBe(true);
  });

  it("ne bloque pas 172.15.x.x", () => {
    expect(isPrivateUrl(new URL("http://172.15.0.1"))).toBe(false);
  });

  it("détecte les plages privées de classe C", () => {
    expect(isPrivateUrl(new URL("http://192.168.1.1"))).toBe(true);
  });

  it("détecte les adresses link-local (metadata cloud)", () => {
    expect(isPrivateUrl(new URL("http://169.254.169.254"))).toBe(true);
  });

  it("détecte localhost par hostname", () => {
    expect(isPrivateUrl(new URL("http://localhost"))).toBe(true);
  });

  it("détecte les metadata Google", () => {
    expect(isPrivateUrl(new URL("http://metadata.google.internal"))).toBe(true);
  });

  it("détecte les domaines .local et .internal", () => {
    expect(isPrivateUrl(new URL("http://myservice.local"))).toBe(true);
    expect(isPrivateUrl(new URL("http://api.internal"))).toBe(true);
    expect(isPrivateUrl(new URL("http://test.localhost"))).toBe(true);
  });

  it("accepte les adresses publiques", () => {
    expect(isPrivateUrl(new URL("https://example.com"))).toBe(false);
    expect(isPrivateUrl(new URL("https://8.8.8.8"))).toBe(false);
  });
});

describe("validateExternalUrl", () => {
  it("accepte les URLs https valides", () => {
    expect(validateExternalUrl("https://example.com")).toBeNull();
    expect(validateExternalUrl("http://example.com/path")).toBeNull();
  });

  it("rejette les protocoles non-http", () => {
    expect(validateExternalUrl("ftp://example.com")).toBe("Protocole non supporté");
    expect(validateExternalUrl("file:///etc/passwd")).toBe("Protocole non supporté");
  });

  it("rejette les URLs invalides", () => {
    expect(validateExternalUrl("pas-une-url")).toBe("URL invalide");
    expect(validateExternalUrl("")).toBe("URL invalide");
  });

  it("rejette les URLs privées", () => {
    const result = validateExternalUrl("http://192.168.1.1/admin");
    expect(result).not.toBeNull();
    expect(result).toContain("privées");
  });
});
