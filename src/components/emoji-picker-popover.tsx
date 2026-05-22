"use client";

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { Smile, X } from "lucide-react";
import { Theme as EmojiTheme, EmojiStyle } from "emoji-picker-react";
import frEmojis from "emoji-picker-react/dist/data/emojis-fr.json";

// PERF-11 — Lazy-load emoji-picker-react (~200KB) uniquement quand le popover est ouvert
const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface EmojiPickerPopoverProps {
  value?: string | null;
  onChange: (emoji: string | null) => void;
  /** Taille de l'emoji affiché */
  size?: "sm" | "md" | "lg";
  /** Placeholder quand aucun emoji n'est sélectionné */
  fallback?: React.ReactNode;
  /** Permettre la suppression de l'emoji */
  clearable?: boolean;
}

const sizeClasses = {
  sm: "h-7 w-7 text-base",
  md: "h-9 w-9 text-xl",
  lg: "h-12 w-12 text-3xl",
};

const PICKER_WIDTH = 370;

export function EmojiPickerPopover({
  value,
  onChange,
  size = "md",
  fallback,
  clearable = true,
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setAlignRight(rect.left + PICKER_WIDTH > window.innerWidth);
    }
    setOpen((v) => !v);
  };

  // Détecter le thème
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  return (
    <div ref={containerRef} className="relative inline-block">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggle}
          className={`${sizeClasses[size]} flex items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer`}
          title={value ? "Changer l'emoji" : "Ajouter un emoji"}
        >
          {value ? (
            <span>{value}</span>
          ) : (
            fallback || <Smile className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {clearable && value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            title="Supprimer l'emoji"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && (
        <div className={`absolute z-50 mt-1 shadow-lg rounded-lg ${alignRight ? "right-0" : "left-0"}`}>
          <Suspense fallback={<div className="w-[370px] h-[420px] flex items-center justify-center bg-popover rounded-lg border"><span className="text-sm text-muted-foreground animate-pulse">Chargement...</span></div>}>
            <EmojiPicker
              onEmojiClick={(emojiData: { emoji: string }) => {
                onChange(emojiData.emoji);
                setOpen(false);
              }}
              theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT}
              emojiStyle={EmojiStyle.NATIVE}
              width={PICKER_WIDTH}
              height={420}
              searchPlaceHolder="Rechercher un emoji..."
              skinTonesDisabled={false}
              previewConfig={{ showPreview: false }}
              lazyLoadEmojis
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              emojiData={frEmojis as any}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
