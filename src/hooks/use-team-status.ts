"use client";

import useSWR from "swr";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  effectiveStatus: "online" | "away" | "in_meeting" | "dnd" | "offline";
  customEmoji: string | null;
  customText: string | null;
  lastSeen: string;
  availability: Array<{
    date: string;
    morning: "free" | "busy" | "absent";
    afternoon: "free" | "busy" | "absent";
    evening: "free" | "busy" | "absent";
  }>;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur réseau");
  return res.json();
}

export function useTeamStatus() {
  const { data, isLoading, mutate } = useSWR<{ members: TeamMember[] }>(
    "/api/team/status",
    fetcher,
    { refreshInterval: 30_000 }
  );

  return {
    members: data?.members ?? [],
    isLoading,
    mutate,
  };
}
