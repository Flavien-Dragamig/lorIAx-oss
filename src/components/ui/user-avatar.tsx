"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { VizHashAvatar } from "@/components/ui/vizhash-avatar";

interface UserAvatarProps {
  /** Email used as VizHash seed (fallback) */
  email: string;
  /** External avatar URL (priority over VizHash) */
  avatarUrl?: string | null;
  /** Display size in pixels (default: 32) */
  size?: number;
  /** Avatar mode: "vizhash" forces VizHash, "photo" uses avatarUrl if available.
   *  When not provided, reads from localStorage ("loriax-avatar-mode"). */
  avatarMode?: "vizhash" | "photo";
  /** Additional CSS classes */
  className?: string;
}

/**
 * User avatar with automatic fallback:
 * - If avatarMode === "vizhash" → always VizHash (even if avatarUrl exists)
 * - If avatarMode === "photo" or unset → avatarUrl (if valid) → VizHash fallback
 */
export function UserAvatar({
  email,
  avatarUrl,
  size = 32,
  avatarMode: avatarModeProp,
  className = "",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [storedMode, setStoredMode] = useState<"vizhash" | "photo" | null>(null);

  useEffect(() => {
    if (!avatarModeProp) {
      const saved = localStorage.getItem("loriax-avatar-mode");
      if (saved === "vizhash" || saved === "photo") {
        setStoredMode(saved);
      }
    }
  }, [avatarModeProp]);

  const effectiveMode = avatarModeProp ?? storedMode;

  // Si mode VizHash forcé, toujours afficher VizHash
  if (effectiveMode === "vizhash") {
    return <VizHashAvatar email={email} size={size} className={className} />;
  }

  if (avatarUrl && !imgError) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        draggable={false}
        onError={() => setImgError(true)}
        unoptimized={avatarUrl.startsWith("data:") || avatarUrl.startsWith("/api/")}
      />
    );
  }

  return <VizHashAvatar email={email} size={size} className={className} />;
}
