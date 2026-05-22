"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Charge et applique les préférences d'apparence de l'utilisateur au montage.
 *
 * Stratégie :
 * 1. D'abord, appliquer depuis localStorage (instantané, pas de flash)
 * 2. Ensuite, si authentifié, synchroniser depuis l'API
 *
 * Les variables light/dark sont toutes deux posées en CSS.
 * La bascule est gérée côté CSS via les sélecteurs :root / .dark.
 */
export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  // Appliquer les prefs depuis le cache localStorage (synchrone, pas de flash)
  useEffect(() => {
    const cached = localStorage.getItem("loriax-appearance");
    if (cached) {
      try {
        applyPrefs(JSON.parse(cached));
      } catch {
        // cache invalide, ignorer
      }
    }
  }, []);

  // Synchroniser depuis l'API — n'applique que si les prefs diffèrent du cache
  useEffect(() => {
    if (status !== "authenticated") return;

    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.themePreferences) {
          const cached = localStorage.getItem("loriax-appearance");
          const fresh = JSON.stringify(data.themePreferences);
          // N'appliquer que si les prefs serveur diffèrent du cache
          if (fresh !== cached) {
            applyPrefs(data.themePreferences);
            localStorage.setItem("loriax-appearance", fresh);
          }
          // Propager le mode avatar pour les composants UserAvatar
          if (data.themePreferences.avatarMode) {
            localStorage.setItem("loriax-avatar-mode", data.themePreferences.avatarMode);
          }
        }
      })
      .catch(() => {
        // silencieux — les prefs du cache local sont déjà appliquées
      });
  }, [status]);

  return <>{children}</>;
}

interface AppearancePrefs {
  accentColor?: string;
  editorFont?: string;
  editorBackground?: string;
  contentWidth?: string;
  fontSize?: string;
  specialMode?: "terminal";
  terminalEffects?: {
    glitch: boolean;
    scanVertical: boolean;
    scanlinesOpacity: number;
  };
}

/** Couleurs d'accentuation avec variantes light et dark */
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

/** Fond de l'éditeur — variantes light et dark */
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

/**
 * Applique les préférences en posant les variantes light ET dark.
 * La bascule est gérée côté CSS (.dark sélecteur), pas côté JS.
 */
function applyPrefs(prefs: AppearancePrefs) {
  const root = document.documentElement;

  // Mode terminal — court-circuit : CSS prend le relais
  if (prefs.specialMode === "terminal") {
    root.dataset.preset = "terminal";
    const fx = prefs.terminalEffects;
    root.dataset.glitch = String(fx?.glitch ?? false);
    root.dataset.scanVertical = String(fx?.scanVertical ?? true);
    root.style.setProperty(
      "--terminal-scan-opacity",
      ((fx?.scanlinesOpacity ?? 45) / 1000).toFixed(3)
    );
    return;
  }

  // Si on n'est pas en mode terminal, nettoyer les attributs au cas où
  delete root.dataset.preset;

  // Accent — variantes light/dark (la bascule se fait en CSS)
  if (prefs.accentColor && ACCENT_COLORS[prefs.accentColor]) {
    const { light, dark } = ACCENT_COLORS[prefs.accentColor];
    root.style.setProperty("--loriax-accent-light", light);
    root.style.setProperty("--loriax-accent-dark", dark);
  }

  // Police de l'éditeur
  if (prefs.editorFont && FONT_MAP[prefs.editorFont]) {
    root.style.setProperty("--loriax-editor-font", FONT_MAP[prefs.editorFont]);
  }

  // Fond de l'éditeur — variantes light/dark (bascule en CSS)
  if (prefs.editorBackground && BG_MAP[prefs.editorBackground]) {
    const { light, dark } = BG_MAP[prefs.editorBackground];
    root.style.setProperty("--loriax-editor-bg-light", light);
    root.style.setProperty("--loriax-editor-bg-dark", dark);
  }

  // Largeur du contenu
  if (prefs.contentWidth && WIDTH_MAP[prefs.contentWidth]) {
    root.style.setProperty(
      "--loriax-content-width",
      WIDTH_MAP[prefs.contentWidth]
    );
  }

  // Taille de police
  if (prefs.fontSize && SIZE_MAP[prefs.fontSize]) {
    root.style.setProperty(
      "--loriax-editor-font-size",
      SIZE_MAP[prefs.fontSize]
    );
  }
}
