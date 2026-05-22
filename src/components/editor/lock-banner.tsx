"use client";

import { Lock } from "lucide-react";

interface LockBannerProps {
  lockedByName: string;
}

export function LockBanner({ lockedByName }: LockBannerProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 text-sm border-b"
      style={{
        backgroundColor: "var(--callout-warning-bg, hsl(var(--warning) / 0.1))",
        borderColor: "var(--callout-warning-border, hsl(var(--warning) / 0.3))",
        color: "var(--callout-warning-text, hsl(var(--warning-foreground)))",
      }}
    >
      <Lock className="h-4 w-4 shrink-0" />
      <span>
        Ce document est en cours d&apos;édition par{" "}
        <strong>{lockedByName}</strong>. Il est en lecture seule.
      </span>
    </div>
  );
}
