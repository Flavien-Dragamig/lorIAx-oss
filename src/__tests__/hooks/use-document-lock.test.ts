// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDocumentLock } from "@/hooks/use-document-lock";

// Global fetch mock
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

describe("useDocumentLock", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    // Default: lockDocument called on mount returns OK
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initialise avec isLocked = false avant le mount effect", () => {
    // Prevent mount effect from running by making documentId empty
    const { result } = renderHook(() => useDocumentLock(""));

    expect(result.current.isLocked).toBe(false);
    expect(result.current.lockedBy).toBeNull();
    expect(result.current.lockedByName).toBeNull();
    expect(result.current.isOwner).toBe(false);
  });

  it("lockDocument appelle l'API POST avec le bon URL", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => useDocumentLock("doc-123"));

    // Mount triggers lockDocument automatically
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/documents/doc-123/lock",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("lockDocument retourne true et isOwner = true si API OK", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const { result } = renderHook(() => useDocumentLock("doc-ok"));

    await waitFor(() => {
      expect(result.current.isLocked).toBe(true);
      expect(result.current.isOwner).toBe(true);
    });
  });

  it("lockDocument retourne false et expose lockedBy si 409 (conflit)", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        lockedBy: "user-456",
        lockedByName: "Marie Lefevre",
      }),
    });

    const { result } = renderHook(() => useDocumentLock("doc-conflict"));

    await waitFor(() => {
      expect(result.current.isLocked).toBe(true);
      expect(result.current.isOwner).toBe(false);
      expect(result.current.lockedBy).toBe("user-456");
      expect(result.current.lockedByName).toBe("Marie Lefevre");
    });
  });

  it("unlockDocument appelle DELETE et reinitialise l'etat", async () => {
    // First call (mount lockDocument) => OK
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    // Second call (unlockDocument) => OK
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    const { result } = renderHook(() => useDocumentLock("doc-unlock"));

    // Wait for lock to be acquired
    await waitFor(() => {
      expect(result.current.isOwner).toBe(true);
    });

    await act(async () => {
      await result.current.unlockDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents/doc-unlock/lock",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(result.current.isLocked).toBe(false);
    expect(result.current.isOwner).toBe(false);
  });

  it("lockDocument retourne false sur erreur reseau", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useDocumentLock("doc-error"));

    // The mount effect calls lockDocument which catches the error
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // State should remain at initial (not locked, not owner)
    expect(result.current.isLocked).toBe(false);
    expect(result.current.isOwner).toBe(false);

    consoleSpy.mockRestore();
  });
});
