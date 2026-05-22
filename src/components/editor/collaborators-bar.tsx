"use client";

import type { Collaborator } from "@/hooks/use-presence";
import { VizHashAvatar } from "@/components/ui/vizhash-avatar";

interface CollaboratorsBarProps {
  collaborators: Collaborator[];
  isConnected: boolean;
}

export function CollaboratorsBar({ collaborators, isConnected }: CollaboratorsBarProps) {
  if (!isConnected && collaborators.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {/* Connection indicator */}
      <div
        className={`h-2 w-2 rounded-full ${
          isConnected ? "bg-green-500" : "bg-muted-foreground"
        }`}
        title={isConnected ? "Connecté" : "Déconnecté"}
      />

      {/* Collaborator avatars */}
      <div className="flex -space-x-1.5">
        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className="relative border-2 border-background rounded-full"
            title={collab.name}
          >
            <VizHashAvatar email={collab.email || collab.name} size={24} />
          </div>
        ))}
      </div>

      {collaborators.length > 0 && (
        <span className="text-xs text-muted-foreground ml-1">
          {collaborators.length} {collaborators.length === 1 ? "collaborateur" : "collaborateurs"}
        </span>
      )}
    </div>
  );
}
