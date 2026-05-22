"use client";

import { memo } from "react";
import { User, Users, Building2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { SpaceItem } from "./types";

export const SpaceIcon = memo(function SpaceIcon({ type, icon, avatarUrl, email }: { type: SpaceItem["type"]; icon?: string | null; avatarUrl?: string | null; email?: string | null }) {
  if (type === "personal" && (avatarUrl || email)) {
    return (
      <UserAvatar
        email={email || "unknown"}
        avatarUrl={avatarUrl}
        size={20}
      />
    );
  }
  if (icon) {
    return <span className="text-base leading-none">{icon}</span>;
  }
  switch (type) {
    case "personal":
      return <User className="h-4 w-4" />;
    case "team":
      return <Users className="h-4 w-4" />;
    case "organization":
      return <Building2 className="h-4 w-4" />;
  }
});
