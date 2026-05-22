// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMyStatus } from "@/hooks/use-my-status";

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("useMyStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "online",
        effectiveStatus: "online",
        customEmoji: null,
        customText: null,
        customExpiresAt: null,
        lastSeen: new Date().toISOString(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("charge le statut initial via GET /api/me/status", async () => {
    const { result } = renderHook(() => useMyStatus());
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith("/api/me/status");
    expect(result.current.status).toBe("online");
  });

  it("envoie un heartbeat PATCH toutes les 60s", async () => {
    renderHook(() => useMyStatus());
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    const patchCalls = (fetchMock.mock.calls as [string, RequestInit | undefined][]).filter(
      ([url, opts]) =>
        url === "/api/me/status" && opts?.method === "PATCH"
    );
    expect(patchCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("update() appelle PATCH avec le body fourni", async () => {
    const { result } = renderHook(() => useMyStatus());
    await act(async () => {});
    await act(async () => {
      await result.current.update({
        status: "dnd",
        customText: "Réunion",
      });
    });
    const patchCall = (fetchMock.mock.calls as [string, RequestInit | undefined][]).find(
      ([url, opts]) =>
        url === "/api/me/status" && opts?.method === "PATCH" && opts?.body != null
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall![1]!.body as string);
    expect(body.status).toBe("dnd");
    expect(body.custom_text).toBe("Réunion");
  });
});
