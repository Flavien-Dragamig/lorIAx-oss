"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileReadOnlyOverlayProps {
  children: React.ReactNode;
  isEditing: boolean;
}

export function MobileReadOnlyOverlay({ children, isEditing }: MobileReadOnlyOverlayProps) {
  const isMobile = useIsMobile();
  const [showHint, setShowHint] = useState(false);

  if (!isMobile || !isEditing) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative"
      onClick={() => {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 2500);
      }}
    >
      {children}
      <div className="absolute inset-0 bg-muted/40 rounded-lg cursor-not-allowed" />
      {showHint && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Monitor className="h-4 w-4" />
            <span>Modifiable sur desktop uniquement</span>
          </div>
        </div>
      )}
    </div>
  );
}
