// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePresence } from "@/hooks/use-presence";

// Helper to create a mock awareness object
function createMockAwareness(clientID: number = 1) {
  const listeners = new Map<string, Set<() => void>>();
  const states = new Map<number, Record<string, unknown>>();

  return {
    clientID,
    setLocalStateField: vi.fn(),
    getStates: () => states,
    on: (event: string, callback: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
    },
    off: (event: string, callback: () => void) => {
      listeners.get(event)?.delete(callback);
    },
    // Test helpers
    _states: states,
    _emit: (event: string) => {
      listeners.get(event)?.forEach((cb) => cb());
    },
  };
}

function createMockProvider(awareness: ReturnType<typeof createMockAwareness>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { awareness } as any;
}

const currentUser = {
  id: "user-1",
  name: "Jean Dupont",
  email: "jean@test.fr",
  avatarUrl: null,
};

describe("usePresence", () => {
  it("initialise avec une liste vide de collaborateurs", () => {
    const { result } = renderHook(() =>
      usePresence({ provider: null, currentUser: null })
    );

    expect(result.current.collaborators).toEqual([]);
  });

  it("initialise avec une liste vide meme avec provider actif", () => {
    const awareness = createMockAwareness(1);
    const provider = createMockProvider(awareness);

    const { result } = renderHook(() =>
      usePresence({ provider, currentUser })
    );

    expect(result.current.collaborators).toEqual([]);
  });

  it("setLocalStateField est appele avec les donnees utilisateur", () => {
    const awareness = createMockAwareness(1);
    const provider = createMockProvider(awareness);

    renderHook(() => usePresence({ provider, currentUser }));

    expect(awareness.setLocalStateField).toHaveBeenCalledWith(
      "user",
      expect.objectContaining({
        id: "user-1",
        name: "Jean Dupont",
        email: "jean@test.fr",
      })
    );
  });

  it("detecte les collaborateurs distants via awareness change", () => {
    const awareness = createMockAwareness(1);
    const provider = createMockProvider(awareness);

    const { result } = renderHook(() =>
      usePresence({ provider, currentUser })
    );

    // Add a remote collaborator
    act(() => {
      awareness._states.set(2, {
        user: {
          id: "user-2",
          name: "Marie Lefevre",
          email: "marie@test.fr",
          color: "#ef4444",
          avatarUrl: null,
        },
      });
      awareness._emit("change");
    });

    expect(result.current.collaborators).toHaveLength(1);
    expect(result.current.collaborators[0].name).toBe("Marie Lefevre");
  });

  it("deduplique les utilisateurs sur plusieurs onglets", () => {
    const awareness = createMockAwareness(1);
    const provider = createMockProvider(awareness);

    const { result } = renderHook(() =>
      usePresence({ provider, currentUser })
    );

    // Same user on two tabs (different clientIds)
    act(() => {
      awareness._states.set(2, {
        user: { id: "user-2", name: "Marie", email: "m@t.fr", color: "#ef4444" },
      });
      awareness._states.set(3, {
        user: { id: "user-2", name: "Marie", email: "m@t.fr", color: "#ef4444" },
      });
      awareness._emit("change");
    });

    expect(result.current.collaborators).toHaveLength(1);
  });

  it("evite les re-renders si les donnees sont identiques", () => {
    const awareness = createMockAwareness(1);
    const provider = createMockProvider(awareness);

    const { result } = renderHook(() =>
      usePresence({ provider, currentUser })
    );

    // Add collaborator
    act(() => {
      awareness._states.set(2, {
        user: { id: "user-2", name: "Marie", email: "m@t.fr", color: "#ef4444" },
      });
      awareness._emit("change");
    });

    const firstRef = result.current.collaborators;

    // Emit again with same data — should return same reference
    act(() => {
      awareness._emit("change");
    });

    expect(result.current.collaborators).toBe(firstRef);
  });

  it("exclut l'utilisateur local de la liste", () => {
    const awareness = createMockAwareness(1);
    const provider = createMockProvider(awareness);

    const { result } = renderHook(() =>
      usePresence({ provider, currentUser })
    );

    // Local user state (clientId matches awareness.clientID)
    act(() => {
      awareness._states.set(1, {
        user: { id: "user-1", name: "Jean", email: "j@t.fr", color: "#3b82f6" },
      });
      awareness._emit("change");
    });

    expect(result.current.collaborators).toHaveLength(0);
  });
});
