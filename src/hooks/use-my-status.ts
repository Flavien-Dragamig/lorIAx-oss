"use client";

import { useState, useEffect, useCallback } from "react";
import { mutate as swrMutate } from "swr";

export interface MyStatus {
  status: string;
  effectiveStatus: string;
  customEmoji: string | null;
  customText: string | null;
  customExpiresAt: string | null;
  lastSeen: string;
}

interface UpdatePayload {
  status?: "online" | "away" | "in_meeting" | "dnd";
  customEmoji?: string | null;
  customText?: string | null;
  customExpiresAt?: string | null;
}

export function useMyStatus() {
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/me/status");
    if (res.ok) setMyStatus(await res.json());
  }, []);

  const heartbeat = useCallback(async () => {
    await fetch("/api/me/status", { method: "PATCH" });
  }, []);

  const update = useCallback(async (payload: UpdatePayload) => {
    const body: Record<string, unknown> = {};
    if (payload.status !== undefined) body.status = payload.status;
    if (payload.customEmoji !== undefined) body.custom_emoji = payload.customEmoji;
    if (payload.customText !== undefined) body.custom_text = payload.customText;
    if (payload.customExpiresAt !== undefined)
      body.custom_expires_at = payload.customExpiresAt;

    const res = await fetch("/api/me/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setMyStatus((prev) => (prev ? { ...prev, ...updated } : updated));
      // Notifie toutes les autres instances et rafraîchit la liste équipe
      window.dispatchEvent(new CustomEvent("loriax:status-updated", { detail: updated }));
      swrMutate("/api/team/status");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    heartbeat(); // met à jour lastSeen immédiatement au montage
    const id = setInterval(heartbeat, 60_000);

    const onStatusUpdated = (e: Event) => {
      const updated = (e as CustomEvent).detail;
      setMyStatus((prev) => (prev ? { ...prev, ...updated } : updated));
    };
    window.addEventListener("loriax:status-updated", onStatusUpdated);

    return () => {
      clearInterval(id);
      window.removeEventListener("loriax:status-updated", onStatusUpdated);
    };
  }, [fetchStatus, heartbeat]);

  return {
    status: myStatus?.status ?? "offline",
    effectiveStatus: myStatus?.effectiveStatus ?? "offline",
    customEmoji: myStatus?.customEmoji ?? null,
    customText: myStatus?.customText ?? null,
    customExpiresAt: myStatus?.customExpiresAt ?? null,
    lastSeen: myStatus?.lastSeen ?? null,
    update,
  };
}
