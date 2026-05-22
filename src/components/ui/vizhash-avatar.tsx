"use client";

import { useState, useEffect } from "react";
import { generateVizHash } from "@/lib/vizhash";

interface VizHashAvatarProps {
  /** Email or unique identifier used as hash seed */
  email: string;
  /** Display size in pixels (default: 32) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Avatar component that generates a unique visual identity (VizHash)
 * from an email address. Deterministic: same email = same image.
 */
export function VizHashAvatar({
  email,
  size = 32,
  className = "",
}: VizHashAvatarProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    // Generate at higher resolution for crisp display on retina
    const dataUrl = generateVizHash(email, size * 2);
    setSrc(dataUrl);
  }, [email, size]);

  const _sizeClass = `h-${size / 4} w-${size / 4}`;

  if (!src) {
    // SSR / loading fallback: colored placeholder
    return (
      <div
        className={`rounded-full bg-muted shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
