// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("swr", () => ({
  default: vi.fn(),
}));

import useSWR from "swr";
import { useTeamStatus } from "@/hooks/use-team-status";

const mockedUseSWR = vi.mocked(useSWR);

const fakeMember = {
  userId: "u1",
  name: "Alice",
  email: "alice@test.fr",
  avatarUrl: null,
  effectiveStatus: "online" as const,
  customEmoji: null,
  customText: null,
  lastSeen: new Date().toISOString(),
  availability: [],
};

describe("useTeamStatus", () => {
  beforeEach(() => {
    mockedUseSWR.mockReturnValue({
      data: { members: [fakeMember] },
      isLoading: false,
      mutate: vi.fn(),
      error: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("retourne les membres de l'équipe depuis SWR", () => {
    const { result } = renderHook(() => useTeamStatus());
    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].name).toBe("Alice");
  });

  it("retourne isLoading=true pendant le chargement", () => {
    mockedUseSWR.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      mutate: vi.fn(),
      error: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const { result } = renderHook(() => useTeamStatus());
    expect(result.current.isLoading).toBe(true);
  });
});
