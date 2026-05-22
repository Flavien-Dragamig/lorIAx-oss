import { describe, it, expect, vi, beforeEach } from "vitest";

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import { getOrgId } from "@/lib/org/get-org-id";
import { db } from "@/lib/db";

const mockDb = db as unknown as MockDb;

describe("getOrgId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne l'id quand l'org existe et est active", async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: "org-123", isActive: true },
    ]);
    const id = await getOrgId("acme");
    expect(id).toBe("org-123");
  });

  it("lève une erreur si l'org est introuvable", async () => {
    mockDb.limit.mockResolvedValueOnce([]);
    await expect(getOrgId("unknown")).rejects.toThrow("Organisation introuvable");
  });

  it("lève une erreur si l'org est inactive", async () => {
    mockDb.limit.mockResolvedValueOnce([
      { id: "org-123", isActive: false },
    ]);
    await expect(getOrgId("inactive")).rejects.toThrow("Organisation désactivée");
  });
});
