import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn({
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "ch-new" }]),
    })),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "ch-new" }]),
  },
}));

import { createTeamChannel, createSpaceChannel } from "@/lib/chat/channel-hooks";
import { db } from "@/lib/db";

describe("createTeamChannel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insère un canal de type team et ses membres dans une transaction", async () => {
    const result = await createTeamChannel({
      teamId: "team-1",
      organizationId: "org-1",
      createdBy: "user-1",
      memberIds: ["user-1", "user-2"],
    });
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(1);
    expect(result).toBe("ch-new");
  });
});

describe("createSpaceChannel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insère un canal de type space dans une transaction", async () => {
    const result = await createSpaceChannel({
      spaceId: "space-1",
      organizationId: "org-1",
      createdBy: "user-1",
      memberIds: ["user-1"],
    });
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(1);
    expect(result).toBe("ch-new");
  });
});
