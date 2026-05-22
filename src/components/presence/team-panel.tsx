"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceBadge } from "@/components/ui/presence-badge";
import { StatusPopover } from "@/components/presence/status-popover";
import { useTeamStatus, type TeamMember } from "@/hooks/use-team-status";
import { useMyStatus } from "@/hooks/use-my-status";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "team-panel-open";

const SLOT_COLORS: Record<string, string> = {
  free: "bg-green-200 dark:bg-green-800",
  busy: "bg-amber-200 dark:bg-amber-800",
  absent: "bg-slate-200 dark:bg-slate-700",
};

function _formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function PlanningRow({ member }: { member: TeamMember }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="relative shrink-0">
        <UserAvatar email={member.email} avatarUrl={member.avatarUrl} size={28} />
        <PresenceBadge status={member.effectiveStatus} size="sm" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{member.name}</p>
        {member.customText && (
          <p className="text-xs text-muted-foreground truncate">
            {member.customEmoji} {member.customText}
          </p>
        )}
      </div>
      <div className="flex gap-0.5 shrink-0">
        {member.availability.map((day) => (
          <div key={day.date} className="flex flex-col gap-0.5">
            <span className={cn("w-4 h-2 rounded-sm", SLOT_COLORS[day.morning])} title={`Matin ${day.date}`} />
            <span className={cn("w-4 h-2 rounded-sm", SLOT_COLORS[day.afternoon])} title={`A-midi ${day.date}`} />
            <span className={cn("w-4 h-2 rounded-sm", SLOT_COLORS[day.evening])} title={`Soir ${day.date}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamToggleButton({
  onClick,
  onlineCount,
}: {
  onClick: () => void;
  onlineCount: number;
}) {
  return (
    <button onClick={onClick} className="relative p-2 rounded hover:bg-muted" title="Mon équipe">
      <Users className="h-5 w-5" />
      {onlineCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {onlineCount > 9 ? "9+" : onlineCount}
        </span>
      )}
    </button>
  );
}

export function TeamPanel() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const { members, isLoading } = useTeamStatus();
  const { status, effectiveStatus, customEmoji, customText, customExpiresAt, update } = useMyStatus();

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  useEffect(() => {
    window.addEventListener("loriax:toggle-team-panel", toggleOpen);
    return () => window.removeEventListener("loriax:toggle-team-panel", toggleOpen);
  });

  if (!open) return null;

  const user = session?.user as { name?: string; email?: string; image?: string } | undefined;
  const onlineCount = members.filter(
    (m) => m.effectiveStatus === "online" || m.effectiveStatus === "away"
  ).length;

  const days = members[0]?.availability.map((a) => a.date) ?? [];

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[300px] bg-background border-l flex flex-col z-40 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="font-semibold text-sm">Mon équipe</span>
          {onlineCount > 0 && (
            <span className="text-xs text-muted-foreground">({onlineCount} en ligne)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <StatusPopover
            currentStatus={{ status, customEmoji, customText, customExpiresAt }}
            onUpdate={update}
          >
            <button className="relative" title="Modifier mon statut">
              <UserAvatar
                email={user?.email ?? ""}
                avatarUrl={user?.image ?? null}
                size={28}
              />
              <PresenceBadge status={effectiveStatus} size="sm" />
            </button>
          </StatusPopover>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleOpen}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* En-têtes des 3 jours */}
      {days.length > 0 && (
        <div className="flex items-center justify-end gap-0.5 px-3 py-1 border-b shrink-0">
          {days.map((d) => (
            <div key={d} className="w-4 text-center text-xs text-muted-foreground leading-none">
              {new Date(d + "T00:00:00Z").toLocaleDateString("fr-FR", { weekday: "narrow" })}
            </div>
          ))}
        </div>
      )}

      {/* Liste des membres */}
      <div className="flex-1 overflow-y-auto px-3">
        {isLoading && (
          <p className="text-xs text-muted-foreground py-4 text-center">Chargement…</p>
        )}
        {!isLoading && members.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aucun membre d&apos;équipe à afficher.
          </p>
        )}
        {members.map((m) => (
          <PlanningRow key={m.userId} member={m} />
        ))}
      </div>

      {/* Légende */}
      <div className="px-3 py-2 border-t shrink-0 flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-2 rounded-sm bg-green-200 dark:bg-green-800 inline-block" /> Libre
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-2 rounded-sm bg-amber-200 dark:bg-amber-800 inline-block" /> Occupé
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-2 rounded-sm bg-slate-200 dark:bg-slate-700 inline-block" /> Absent
        </span>
      </div>
    </div>
  );
}
