"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceBadge } from "@/components/ui/presence-badge";
import { useTeamStatus } from "@/hooks/use-team-status";
import { CollapsibleSection } from "./collapsible-section";
import { Users } from "lucide-react";

export function TeamMembersSection() {
  const { members, isLoading } = useTeamStatus();

  // Afficher uniquement si au moins un membre actif
  if (!isLoading && members.length === 0) return null;

  const activeMembers = members.filter(
    (m) => m.effectiveStatus !== "offline"
  );

  if (!isLoading && activeMembers.length === 0) return null;

  return (
    <CollapsibleSection id="team-members" title="Membres actifs" icon={Users}>
      <div className="space-y-1 px-2 pb-2">
        {activeMembers.map((m) => (
          <div key={m.userId} className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-sidebar-accent">
            <div className="relative shrink-0">
              <UserAvatar email={m.email} avatarUrl={m.avatarUrl} size={24} />
              <PresenceBadge status={m.effectiveStatus} size="sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{m.name}</p>
              {m.customText && (
                <p className="text-xs text-muted-foreground truncate">
                  {m.customEmoji} {m.customText}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
