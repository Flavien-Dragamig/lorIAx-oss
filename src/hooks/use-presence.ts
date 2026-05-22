"use client";

import { useState, useEffect } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";

export interface Collaborator {
  clientId: number;
  id: string;
  name: string;
  email: string;
  color: string;
  avatarUrl?: string | null;
}

// Predefined colors for collaborator cursors
const CURSOR_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

interface UsePresenceOptions {
  provider: HocuspocusProvider | null;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export function usePresence({ provider, currentUser }: UsePresenceOptions) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  useEffect(() => {
    if (!provider || !currentUser) return;

    const awareness = provider.awareness;
    if (!awareness) return;

    // Set local awareness state
    const colorIndex =
      Math.abs(hashCode(currentUser.id)) % CURSOR_COLORS.length;
    awareness.setLocalStateField("user", {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      color: CURSOR_COLORS[colorIndex],
      avatarUrl: currentUser.avatarUrl,
    });

    // Listen for awareness changes
    function onChange() {
      if (!awareness) return;

      const states = awareness.getStates();
      const users: Collaborator[] = [];

      states.forEach((state: Record<string, unknown>, clientId: number) => {
        if (state.user && clientId !== awareness.clientID) {
          const user = state.user as { id: string; name: string; email?: string; color: string; avatarUrl?: string };
          users.push({
            clientId,
            id: user.id,
            name: user.name,
            email: user.email || "",
            color: user.color,
            avatarUrl: user.avatarUrl,
          });
        }
      });

      // Deduplicate by user id (same user on multiple tabs)
      const unique = users.filter(
        (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i
      );

      // Avoid re-renders if data hasn't changed
      setCollaborators((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(unique)) {
          return prev;
        }
        return unique;
      });
    }

    awareness.on("change", onChange);
    onChange(); // Initial state

    return () => {
      awareness.off("change", onChange);
    };
  }, [provider, currentUser]);

  return { collaborators };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
