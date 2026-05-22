// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock heavy dependencies before importing the hook
const mockProviderDestroy = vi.fn();
const mockProviderInstance = {
  destroy: mockProviderDestroy,
  awareness: null,
};

vi.mock("@hocuspocus/provider", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HocuspocusProvider: vi.fn(function (opts: any) {
    // Store constructor args for assertions
    Object.assign(mockProviderInstance, { _opts: opts });
    return mockProviderInstance;
  }),
}));

const mockIdbDestroy = vi.fn();
vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn(function () {
    return {
      destroy: mockIdbDestroy,
      whenSynced: Promise.resolve(),
    };
  }),
}));

const mockDocDestroy = vi.fn();
const mockDocOn = vi.fn();
vi.mock("yjs", () => ({
  Doc: vi.fn(function () {
    return {
      destroy: mockDocDestroy,
      on: mockDocOn,
    };
  }),
}));

// Import after mocks
import { useCollaboration } from "@/hooks/use-collaboration";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";

describe("useCollaboration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne l'etat initial quand enabled = false", () => {
    const { result } = renderHook(() =>
      useCollaboration({
        documentId: "doc-1",
        token: "tok-123",
        enabled: false,
      })
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isSynced).toBe(false);
    expect(result.current.connectionError).toBeNull();
    expect(result.current.pendingUpdates).toBe(0);
    expect(result.current.ydocReady).toBe(false);
  });

  it("ne cree pas de provider si documentId est vide", () => {
    renderHook(() =>
      useCollaboration({
        documentId: "",
        token: "tok-123",
        enabled: true,
      })
    );

    expect(HocuspocusProvider).not.toHaveBeenCalled();
  });

  it("ne cree pas de provider si token est vide", () => {
    renderHook(() =>
      useCollaboration({
        documentId: "doc-1",
        token: "",
        enabled: true,
      })
    );

    expect(HocuspocusProvider).not.toHaveBeenCalled();
  });

  it("cree le provider et IndexeddbPersistence quand enabled", () => {
    renderHook(() =>
      useCollaboration({
        documentId: "doc-active",
        token: "tok-active",
        enabled: true,
      })
    );

    expect(HocuspocusProvider).toHaveBeenCalledTimes(1);
    expect(IndexeddbPersistence).toHaveBeenCalledWith(
      "loriax-doc-doc-active",
      expect.anything()
    );
  });

  it("ydocReady passe a true apres whenSynced IndexedDB", async () => {
    const { result } = renderHook(() =>
      useCollaboration({
        documentId: "doc-idb",
        token: "tok-idb",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.ydocReady).toBe(true);
    });
  });

  it("cleanup detruit provider, idb et ydoc au unmount", () => {
    const { unmount } = renderHook(() =>
      useCollaboration({
        documentId: "doc-cleanup",
        token: "tok-cleanup",
        enabled: true,
      })
    );

    unmount();

    expect(mockProviderDestroy).toHaveBeenCalled();
    expect(mockIdbDestroy).toHaveBeenCalled();
    expect(mockDocDestroy).toHaveBeenCalled();
  });

  it("construit l'URL WebSocket a partir de window.location", () => {
    renderHook(() =>
      useCollaboration({
        documentId: "doc-ws",
        token: "tok-ws",
        enabled: true,
      })
    );

    const call = (HocuspocusProvider as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    // jsdom uses http: => ws:
    expect(call.url).toMatch(/^ws:/);
    expect(call.url).toContain("/ws/collab");
    expect(call.name).toBe("doc-ws");
    expect(call.token).toBe("tok-ws");
  });

  it("ecoute les updates Yjs pour compter les pendingUpdates", () => {
    renderHook(() =>
      useCollaboration({
        documentId: "doc-pending",
        token: "tok-pending",
        enabled: true,
      })
    );

    expect(mockDocOn).toHaveBeenCalledWith("update", expect.any(Function));
  });
});
