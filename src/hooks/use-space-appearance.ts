"use client";

import { useEffect, useRef } from "react";

interface SpacePresetConfig {
  accentColor?: string;
  editorFont?: string;
  editorBackground?: string;
  contentWidth?: string;
  fontSize?: string;
  editorPaddingY?: string;
}

const ACCENT_COLORS: Record<string, { light: string; dark: string }> = {
  coral: { light: "#EB5757", dark: "#F08080" },
  amber: { light: "#CB912F", dark: "#E0A84C" },
  blue: { light: "#2F80ED", dark: "#5B9EF5" },
  green: { light: "#0F7B6C", dark: "#4DAB9A" },
  purple: { light: "#9065B0", dark: "#B08DD0" },
};

const FONT_MAP: Record<string, string> = {
  serif: "var(--font-source-serif), Georgia, serif",
  sans: "var(--font-plus-jakarta), system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), 'Fira Code', monospace",
  garamond: "var(--font-eb-garamond), 'Garamond', 'Times New Roman', serif",
};

const BG_MAP: Record<string, { light: string; dark: string }> = {
  white: { light: "#FFFFFF", dark: "#202020" },
  cream: { light: "#FBF8F3", dark: "#1E1D1A" },
  gray: { light: "#F5F5F5", dark: "#1A1A1A" },
};

const WIDTH_MAP: Record<string, string> = {
  narrow: "60ch",
  normal: "72ch",
  wide: "90ch",
};

const SIZE_MAP: Record<string, string> = {
  small: "0.875rem",
  normal: "1rem",
  large: "1.125rem",
};

const PADDING_Y_MAP: Record<string, string> = {
  compact: "0.75rem",
  normal: "2rem",
  spacious: "4rem",
};

const CSS_PROPS = [
  "--loriax-accent-light",
  "--loriax-accent-dark",
  "--loriax-editor-font",
  "--loriax-editor-bg-light",
  "--loriax-editor-bg-dark",
  "--loriax-content-width",
  "--loriax-editor-font-size",
  "--loriax-editor-padding-y",
];

/**
 * Applique le preset d'apparence de l'espace courant.
 * Ne s'applique que si l'utilisateur n'a pas de préférences personnelles.
 * Restaure les préférences originales au démontage.
 */
export function useSpaceAppearance(spaceSlug: string) {
  const savedValues = useRef<Record<string, string>>({});
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!spaceSlug) return;

    let cancelled = false;

    async function checkAndApply() {
      try {
        // Check if user has personal prefs
        const cachedPrefs = localStorage.getItem("loriax-appearance");
        const userPrefs = cachedPrefs ? JSON.parse(cachedPrefs) : null;

        // If user has explicit prefs set, don't override
        if (userPrefs?.accentColor || userPrefs?.editorFont) return;

        // Fetch space data
        const res = await fetch(`/api/spaces/${spaceSlug}`);
        if (!res.ok || cancelled) return;

        const space = await res.json();
        const preset = space.appearancePreset as SpacePresetConfig | null;
        if (!preset || cancelled) return;

        // Save current values for restoration
        const root = document.documentElement;
        const saved: Record<string, string> = {};
        for (const prop of CSS_PROPS) {
          saved[prop] = root.style.getPropertyValue(prop);
        }
        savedValues.current = saved;
        appliedRef.current = true;

        // Apply space preset
        if (preset.accentColor && ACCENT_COLORS[preset.accentColor]) {
          const { light, dark } = ACCENT_COLORS[preset.accentColor];
          root.style.setProperty("--loriax-accent-light", light);
          root.style.setProperty("--loriax-accent-dark", dark);
        }
        if (preset.editorFont && FONT_MAP[preset.editorFont]) {
          root.style.setProperty("--loriax-editor-font", FONT_MAP[preset.editorFont]);
        }
        if (preset.editorBackground && BG_MAP[preset.editorBackground]) {
          const { light, dark } = BG_MAP[preset.editorBackground];
          root.style.setProperty("--loriax-editor-bg-light", light);
          root.style.setProperty("--loriax-editor-bg-dark", dark);
        }
        if (preset.contentWidth && WIDTH_MAP[preset.contentWidth]) {
          root.style.setProperty("--loriax-content-width", WIDTH_MAP[preset.contentWidth]);
        }
        if (preset.fontSize && SIZE_MAP[preset.fontSize]) {
          root.style.setProperty("--loriax-editor-font-size", SIZE_MAP[preset.fontSize]);
        }
        if (preset.editorPaddingY && PADDING_Y_MAP[preset.editorPaddingY]) {
          root.style.setProperty("--loriax-editor-padding-y", PADDING_Y_MAP[preset.editorPaddingY]);
        }
      } catch {
        // silencieux
      }
    }

    checkAndApply();

    return () => {
      cancelled = true;
      // Restore previous values
      if (appliedRef.current) {
        const root = document.documentElement;
        for (const [prop, val] of Object.entries(savedValues.current)) {
          if (val) {
            root.style.setProperty(prop, val);
          } else {
            root.style.removeProperty(prop);
          }
        }
        appliedRef.current = false;
      }
    };
  }, [spaceSlug]);
}
