"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-session";
import { toast } from "sonner";
import {
  User,
  Palette,
  Monitor,
  Moon,
  Sun,
  Save,
  Shield,
  Type,
  PaintBucket,
  ArrowLeftRight,
  Layers,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Key,
  Webhook,
  Settings,
  Share2,
  Download,
  Upload,
  Users,
  Camera,
  ImageIcon,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { ApiKeysTab } from "./api-keys-tab";
import { WebhooksTab } from "./webhooks-tab";
import { SubscriptionTab } from "./subscription-tab";
import { useOrganization } from "@/lib/org/organization-context";

const settingsTabs = [
  { id: "general", label: "Général", icon: Settings },
  { id: "api-keys", label: "Clés API", icon: Key },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "subscription", label: "Abonnement", icon: CreditCard },
] as const;

type SettingsTabId = (typeof settingsTabs)[number]["id"];

type ThemeMode = "light" | "dark" | "system";
type EditorFont = "serif" | "sans" | "mono" | "garamond";
type EditorBackground = "white" | "cream" | "gray";
type ContentWidth = "narrow" | "normal" | "wide";
type AccentColor = "coral" | "amber" | "blue" | "green" | "purple";

interface AppearancePreset {
  id: string;
  name: string;
  description?: string;
  accentColor: AccentColor;
  editorFont: EditorFont;
  editorBackground: EditorBackground;
  contentWidth: ContentWidth;
  fontSize: string;
  specialMode?: "terminal";
}

interface ThemePreferences {
  mode?: ThemeMode;
  fontSize?: string;
  accentColor?: AccentColor;
  editorFont?: EditorFont;
  editorBackground?: EditorBackground;
  contentWidth?: ContentWidth;
  customPresets?: AppearancePreset[];
  avatarMode?: "vizhash" | "photo";
  terminalEffects?: {
    glitch: boolean;
    scanVertical: boolean;
    scanlinesOpacity: number;
  };
}

/** Presets prédéfinis */
const builtInPresets: AppearancePreset[] = [
  {
    id: "classique",
    name: "Classique",
    description: "Style épuré, idéal pour la documentation",
    accentColor: "blue",
    editorFont: "sans",
    editorBackground: "white",
    contentWidth: "normal",
    fontSize: "normal",
  },
  {
    id: "focus",
    name: "Focus",
    description: "Fond crème et largeur réduite pour la concentration",
    accentColor: "green",
    editorFont: "serif",
    editorBackground: "cream",
    contentWidth: "narrow",
    fontSize: "large",
  },
  {
    id: "redaction",
    name: "Rédaction",
    description: "Police monospace, large, pour l'écriture technique",
    accentColor: "purple",
    editorFont: "mono",
    editorBackground: "gray",
    contentWidth: "wide",
    fontSize: "normal",
  },
  {
    id: "style",
    name: "Style",
    description: "Garamond élégant, fond crème et encre anthracite",
    accentColor: "amber",
    editorFont: "garamond",
    editorBackground: "cream",
    contentWidth: "normal",
    fontSize: "normal",
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Interface CRT phosphore — thème global rétro-futuriste",
    accentColor: "green",
    editorFont: "mono",
    editorBackground: "gray",
    contentWidth: "normal",
    fontSize: "small",
    specialMode: "terminal",
  },
];

interface SharedPreset {
  id: string;
  name: string;
  description: string | null;
  config: AppearancePreset;
  userId: string;
  authorName: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  globalRole: string;
  themePreferences: ThemePreferences | null;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Administrateur",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
};

const accentColors: {
  value: AccentColor;
  label: string;
  light: string;
  dark: string;
}[] = [
  { value: "coral", label: "Corail", light: "#EB5757", dark: "#F08080" },
  { value: "amber", label: "Ambre", light: "#CB912F", dark: "#E0A84C" },
  { value: "blue", label: "Bleu", light: "#2F80ED", dark: "#5B9EF5" },
  { value: "green", label: "Vert", light: "#0F7B6C", dark: "#4DAB9A" },
  { value: "purple", label: "Violet", light: "#9065B0", dark: "#B08DD0" },
];

const editorFonts: { value: EditorFont; label: string; sample: string }[] = [
  { value: "serif", label: "Serif", sample: "font-serif" },
  { value: "sans", label: "Sans-serif", sample: "font-sans" },
  { value: "mono", label: "Monospace", sample: "font-mono" },
  { value: "garamond", label: "Garamond", sample: "font-serif" },
];

const editorBackgrounds: {
  value: EditorBackground;
  label: string;
  bg: string;
  bgDark: string;
}[] = [
  { value: "white", label: "Blanc", bg: "#FFFFFF", bgDark: "#202020" },
  { value: "cream", label: "Crème", bg: "#FBF8F3", bgDark: "#1E1D1A" },
  { value: "gray", label: "Gris", bg: "#F5F5F5", bgDark: "#1A1A1A" },
];

const contentWidths: { value: ContentWidth; label: string; desc: string }[] = [
  { value: "narrow", label: "Étroit", desc: "60ch" },
  { value: "normal", label: "Normal", desc: "72ch" },
  { value: "wide", label: "Large", desc: "90ch" },
];

/**
 * Applique les préférences d'apparence comme variables CSS sur le document.
 * Pose les variantes light ET dark — la bascule est gérée en CSS.
 */
export function applyAppearancePrefs(prefs: ThemePreferences & { specialMode?: "terminal" }) {
  const root = document.documentElement;

  // Mode terminal
  if (prefs.specialMode === "terminal") {
    root.dataset.preset = "terminal";
    const fx = prefs.terminalEffects;
    root.dataset.glitch = String(fx?.glitch ?? false);
    root.dataset.scanVertical = String(fx?.scanVertical ?? true);
    const opacity = ((fx?.scanlinesOpacity ?? 45) / 1000).toFixed(3);
    root.style.setProperty("--terminal-scan-opacity", opacity);
    return;
  }

  // Retirer le mode terminal si on bascule vers un autre preset
  delete root.dataset.preset;
  delete root.dataset.glitch;
  delete root.dataset.scanVertical;
  root.style.removeProperty("--terminal-scan-opacity");

  // Couleur d'accentuation — variantes light/dark
  if (prefs.accentColor) {
    const accent = accentColors.find((a) => a.value === prefs.accentColor);
    if (accent) {
      root.style.setProperty("--loriax-accent-light", accent.light);
      root.style.setProperty("--loriax-accent-dark", accent.dark);
    }
  } else {
    root.style.removeProperty("--loriax-accent-light");
    root.style.removeProperty("--loriax-accent-dark");
  }

  // Police de l'éditeur
  if (prefs.editorFont) {
    const fontMap: Record<EditorFont, string> = {
      serif: "var(--font-source-serif), Georgia, serif",
      sans: "var(--font-plus-jakarta), system-ui, sans-serif",
      mono: "var(--font-jetbrains-mono), 'Fira Code', monospace",
      garamond: "var(--font-eb-garamond), 'Garamond', 'Times New Roman', serif",
    };
    root.style.setProperty("--loriax-editor-font", fontMap[prefs.editorFont]);
  } else {
    root.style.removeProperty("--loriax-editor-font");
  }

  // Fond de l'éditeur — variantes light/dark
  if (prefs.editorBackground) {
    const bg = editorBackgrounds.find((b) => b.value === prefs.editorBackground);
    if (bg) {
      root.style.setProperty("--loriax-editor-bg-light", bg.bg);
      root.style.setProperty("--loriax-editor-bg-dark", bg.bgDark);
    }
  } else {
    root.style.removeProperty("--loriax-editor-bg-light");
    root.style.removeProperty("--loriax-editor-bg-dark");
  }

  // Largeur du contenu
  if (prefs.contentWidth) {
    const widthMap: Record<ContentWidth, string> = {
      narrow: "60ch",
      normal: "72ch",
      wide: "90ch",
    };
    root.style.setProperty("--loriax-content-width", widthMap[prefs.contentWidth]);
  } else {
    root.style.removeProperty("--loriax-content-width");
  }

  // Taille de police
  if (prefs.fontSize) {
    const sizeMap: Record<string, string> = {
      small: "0.875rem",
      normal: "1rem",
      large: "1.125rem",
    };
    root.style.setProperty("--loriax-editor-font-size", sizeMap[prefs.fontSize] || "1rem");
  } else {
    root.style.removeProperty("--loriax-editor-font-size");
  }
}

export default function SettingsPage() {
  const _user = useCurrentUser();
  const { org } = useOrganization();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as SettingsTabId | null;
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    tabParam && settingsTabs.some((t) => t.id === tabParam) ? tabParam : "general"
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const { darkMode: ctxDark, setDarkMode } = useTheme();
  const [fontSize, setFontSize] = useState("normal");
  const [accentColor, setAccentColor] = useState<AccentColor>("blue");
  const [editorFont, setEditorFont] = useState<EditorFont>("serif");
  const [editorBackground, setEditorBackground] =
    useState<EditorBackground>("white");
  const [contentWidth, setContentWidth] = useState<ContentWidth>("normal");
  const [customPresets, setCustomPresets] = useState<AppearancePreset[]>([]);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AppearancePreset | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const presetNameRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [sharedPresets, setSharedPresets] = useState<SharedPreset[]>([]);
  const [showShared, setShowShared] = useState(false);
  const [terminalEffects, setTerminalEffects] = useState({
    glitch: false,
    scanVertical: true,
    scanlinesOpacity: 45,
  });
  const [isTerminalActive, setIsTerminalActive] = useState(false);

  // Avatar state
  const [avatarMode, setAvatarMode] = useState<"vizhash" | "photo">("vizhash");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [uploading, setUploading] = useState(false);
  const cropImgRef = useRef<HTMLImageElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tabParam && settingsTabs.some((t) => t.id === tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  function handleTabChange(tab: SettingsTabId) {
    setActiveTab(tab);
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  }

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setName(data.name || "");
        setAvatarUrl(data.avatarUrl || null);
        const prefs = data.themePreferences as ThemePreferences | null;
        if (prefs?.mode) setThemeMode(prefs.mode);
        if (prefs?.fontSize) setFontSize(prefs.fontSize);
        if (prefs?.accentColor) setAccentColor(prefs.accentColor);
        if (prefs?.editorFont) setEditorFont(prefs.editorFont);
        if (prefs?.editorBackground)
          setEditorBackground(prefs.editorBackground);
        if (prefs?.contentWidth) setContentWidth(prefs.contentWidth);
        if (prefs?.customPresets) setCustomPresets(prefs.customPresets);
        if (prefs?.avatarMode) setAvatarMode(prefs.avatarMode);
        if (prefs?.terminalEffects) setTerminalEffects(prefs.terminalEffects);
        const wasTerminal = (prefs as ThemePreferences & { specialMode?: "terminal" })?.specialMode === "terminal";
        if (wasTerminal) {
          applyAppearancePrefs({ ...(prefs as ThemePreferences & { specialMode?: "terminal" }) });
          setIsTerminalActive(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function applyTheme(mode: ThemeMode) {
    setThemeMode(mode);
    if (mode === "dark") {
      setDarkMode(true);
    } else if (mode === "light") {
      setDarkMode(false);
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(isDark);
      localStorage.removeItem("loriax-theme"); // annuler la persistance faite par setDarkMode — le mode système ne doit pas être persisté
    }
  }

  function isDarkMode(): boolean {
    return ctxDark;
  }

  function buildPreferences(): ThemePreferences & { specialMode?: "terminal" } {
    const isTerminal = document.documentElement.dataset.preset === "terminal";
    return {
      mode: themeMode,
      fontSize,
      accentColor,
      editorFont,
      editorBackground,
      contentWidth,
      customPresets: customPresets.length > 0 ? customPresets : undefined,
      avatarMode,
      ...(isTerminal ? { specialMode: "terminal" as const, terminalEffects } : {}),
    };
  }

  /** Applique les préférences visuelles en temps réel (preview) */
  function previewPrefs(overrides: Partial<ThemePreferences> = {}) {
    const prefs = { ...buildPreferences(), ...overrides };
    applyAppearancePrefs(prefs);
  }

  /** Applique un preset (prédéfini ou personnalisé) */
  function applyPreset(preset: AppearancePreset) {
    setAccentColor(preset.accentColor);
    setEditorFont(preset.editorFont);
    setEditorBackground(preset.editorBackground);
    setContentWidth(preset.contentWidth);
    setFontSize(preset.fontSize);
    if (preset.specialMode === "terminal") {
      applyAppearancePrefs({ specialMode: "terminal", terminalEffects });
      setIsTerminalActive(true);
    } else {
      applyAppearancePrefs({
        accentColor: preset.accentColor,
        editorFont: preset.editorFont,
        editorBackground: preset.editorBackground,
        contentWidth: preset.contentWidth,
        fontSize: preset.fontSize,
      });
      setIsTerminalActive(false);
    }
    toast.success(`Preset « ${preset.name} » appliqué`);
  }

  /** Ouvre le formulaire pour sauvegarder les paramètres actuels comme preset */
  function openNewPresetForm() {
    setEditingPreset(null);
    setPresetName("");
    setPresetDescription("");
    setShowPresetForm(true);
    setTimeout(() => presetNameRef.current?.focus(), 50);
  }

  /** Ouvre le formulaire pour éditer un preset existant */
  function openEditPresetForm(preset: AppearancePreset) {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetDescription(preset.description || "");
    setShowPresetForm(true);
    setTimeout(() => presetNameRef.current?.focus(), 50);
  }

  /** Sauvegarde un preset personnalisé (nouveau ou édité) */
  function saveCustomPreset() {
    const trimmed = presetName.trim();
    if (!trimmed) {
      toast.error("Le nom du preset est requis");
      return;
    }

    if (editingPreset) {
      // Édition d'un preset existant
      setCustomPresets((prev) =>
        prev.map((p) =>
          p.id === editingPreset.id
            ? {
                ...p,
                name: trimmed,
                description: presetDescription.trim() || undefined,
                accentColor,
                editorFont,
                editorBackground,
                contentWidth,
                fontSize,
              }
            : p
        )
      );
      toast.success(`Preset « ${trimmed} » mis à jour`);
    } else {
      // Nouveau preset
      const newPreset: AppearancePreset = {
        id: `custom-${Date.now()}`,
        name: trimmed,
        description: presetDescription.trim() || undefined,
        accentColor,
        editorFont,
        editorBackground,
        contentWidth,
        fontSize,
      };
      setCustomPresets((prev) => [...prev, newPreset]);
      toast.success(`Preset « ${trimmed} » créé`);
    }

    setShowPresetForm(false);
    setEditingPreset(null);
  }

  /** Supprime un preset personnalisé */
  function deleteCustomPreset(id: string) {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    toast.success("Preset supprimé");
  }

  /** Partage un preset personnel avec la communauté */
  async function sharePreset(preset: AppearancePreset) {
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          description: preset.description || null,
          config: {
            accentColor: preset.accentColor,
            editorFont: preset.editorFont,
            editorBackground: preset.editorBackground,
            contentWidth: preset.contentWidth,
            fontSize: preset.fontSize,
          },
        }),
      });
      if (res.ok) {
        toast.success(`Preset « ${preset.name} » partagé avec la communauté`);
        loadSharedPresets();
      } else {
        toast.error("Erreur lors du partage");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  /** Charge les presets partagés */
  async function loadSharedPresets() {
    try {
      const res = await fetch("/api/presets");
      if (res.ok) {
        const data = await res.json();
        setSharedPresets(data);
      }
    } catch {
      // silencieux
    }
  }

  /** Importe un preset partagé dans sa collection personnelle */
  function importSharedPreset(shared: SharedPreset) {
    const cfg = shared.config;
    const newPreset: AppearancePreset = {
      id: `custom-${Date.now()}`,
      name: shared.name,
      description: shared.description || undefined,
      accentColor: cfg.accentColor,
      editorFont: cfg.editorFont,
      editorBackground: cfg.editorBackground,
      contentWidth: cfg.contentWidth,
      fontSize: cfg.fontSize,
    };
    setCustomPresets((prev) => [...prev, newPreset]);
    toast.success(`Preset « ${shared.name} » ajouté à vos presets`);
  }

  /** Supprime un preset partagé (par son auteur ou un admin) */
  async function deleteSharedPreset(id: string) {
    try {
      const res = await fetch("/api/presets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSharedPresets((prev) => prev.filter((p) => p.id !== id));
        toast.success("Preset retiré de la bibliothèque");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  /** Exporte un preset en fichier JSON */
  function exportPresetJson(preset: AppearancePreset) {
    const data = {
      name: preset.name,
      description: preset.description,
      accentColor: preset.accentColor,
      editorFont: preset.editorFont,
      editorBackground: preset.editorBackground,
      contentWidth: preset.contentWidth,
      fontSize: preset.fontSize,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preset-${preset.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Preset exporté");
  }

  /** Importe un preset depuis un fichier JSON */
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.name || !data.accentColor || !data.editorFont) {
          toast.error("Fichier JSON invalide : champs manquants");
          return;
        }
        const newPreset: AppearancePreset = {
          id: `custom-${Date.now()}`,
          name: data.name,
          description: data.description || undefined,
          accentColor: data.accentColor,
          editorFont: data.editorFont,
          editorBackground: data.editorBackground || "white",
          contentWidth: data.contentWidth || "normal",
          fontSize: data.fontSize || "normal",
        };
        setCustomPresets((prev) => [...prev, newPreset]);
        toast.success(`Preset « ${newPreset.name} » importé`);
      } catch {
        toast.error("Fichier JSON invalide");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = "";
  }

  /** Vérifie si les paramètres actuels correspondent à un preset */
  function isPresetActive(preset: AppearancePreset): boolean {
    if (preset.specialMode === "terminal") {
      return isTerminalActive;
    }
    return (
      preset.accentColor === accentColor &&
      preset.editorFont === editorFont &&
      preset.editorBackground === editorBackground &&
      preset.contentWidth === contentWidth &&
      preset.fontSize === fontSize
    );
  }

  // --- Avatar functions ---

  function onSelectAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation côté client
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 2 Mo)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCrop(undefined);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function onCropImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, 1, naturalWidth, naturalHeight),
      naturalWidth,
      naturalHeight
    );
    setCrop(initialCrop);
  }

  const uploadCroppedAvatar = useCallback(async () => {
    if (!cropImgRef.current || !crop || !cropImageSrc) return;

    setUploading(true);
    try {
      // Extraire le crop via canvas
      const image = cropImgRef.current;
      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const pixelCrop = {
        x: (crop.x * scaleX),
        y: (crop.y * scaleY),
        width: (crop.width * scaleX),
        height: (crop.height * scaleY),
      };

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1)
      );
      if (!blob) {
        toast.error("Erreur lors du recadrage");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", blob, "avatar.png");

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Ajouter un cache-buster pour forcer le rechargement
        const newUrl = `${data.avatarUrl}&t=${Date.now()}`;
        setAvatarUrl(newUrl);
        setAvatarMode("photo");
        setShowCropModal(false);
        setCropImageSrc(null);
        localStorage.setItem("loriax-avatar-mode", "photo");
        toast.success("Avatar mis à jour");
      } else {
        const err = await res.json();
        toast.error(err.error || "Erreur lors de l'upload");
      }
    } catch {
      toast.error("Erreur lors de l'upload");
    }
    setUploading(false);
  }, [crop, cropImageSrc]);

  async function deleteAvatar() {
    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      if (res.ok) {
        setAvatarUrl(null);
        setAvatarMode("vizhash");
        localStorage.setItem("loriax-avatar-mode", "vizhash");
        toast.success("Avatar supprimé");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  async function saveSettings() {
    setSaving(true);
    const prefs = buildPreferences();
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          themePreferences: prefs,
        }),
      });
      if (res.ok) {
        applyAppearancePrefs(prefs);
        localStorage.setItem("loriax-appearance", JSON.stringify(prefs));
        localStorage.setItem("loriax-avatar-mode", avatarMode);
        toast.success("Paramètres sauvegardés");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* En-tête avec onglets */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-bold mb-4">Paramètres</h1>
        <div className="flex gap-1 flex-wrap">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-auto">
        {activeTab === "api-keys" && (
          <div className="max-w-2xl mx-auto py-8 px-6">
            <ApiKeysTab />
          </div>
        )}

        {activeTab === "webhooks" && (
          <div className="max-w-2xl mx-auto py-8 px-6">
            <WebhooksTab />
          </div>
        )}

        {activeTab === "subscription" && (
          <div className="max-w-2xl mx-auto py-8 px-6">
            <SubscriptionTab
              currentPlan={org?.plan ?? "free"}
              orgSlug={org?.slug ?? "default"}
              memberCount={org?.memberCount ?? 1}
            />
          </div>
        )}

        {activeTab === "general" && (
    <div className="max-w-2xl mx-auto py-8 px-6">

      {/* Profil */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Profil</h2>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          {/* Avatar */}
          <div className="flex items-start gap-6">
            <div className="relative group shrink-0">
              <UserAvatar
                email={profile?.email || ""}
                avatarUrl={avatarMode === "photo" ? avatarUrl : null}
                avatarMode={avatarMode}
                size={80}
              />
              {avatarMode === "photo" && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Changer la photo"
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="avatarMode"
                    checked={avatarMode === "vizhash"}
                    onChange={() => setAvatarMode("vizhash")}
                    className="accent-[var(--loriax-accent)]"
                  />
                  <span className="text-sm">VizHash (artistique)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="avatarMode"
                    checked={avatarMode === "photo"}
                    onChange={() => setAvatarMode("photo")}
                    className="accent-[var(--loriax-accent)]"
                  />
                  <span className="text-sm">Photo de profil</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={avatarMode === "vizhash"}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {avatarUrl && avatarMode === "photo" ? "Changer la photo" : "Ajouter une photo"}
                </Button>
                {avatarUrl && avatarMode === "photo" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={deleteAvatar}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onSelectAvatarFile}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG ou WebP — max 2 Mo
              </p>
            </div>
          </div>

          {/* Crop modal */}
          {showCropModal && cropImageSrc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recadrer la photo</h3>
                  <button
                    onClick={() => {
                      setShowCropModal(false);
                      setCropImageSrc(null);
                    }}
                    className="p-1 rounded hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-center">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    aspect={1}
                    circularCrop
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={cropImgRef}
                      src={cropImageSrc}
                      alt="Recadrage"
                      onLoad={onCropImageLoad}
                      className="max-h-80 rounded"
                    />
                  </ReactCrop>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCropModal(false);
                      setCropImageSrc(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    disabled={uploading || !crop}
                    onClick={uploadCroppedAvatar}
                    className="gap-1.5"
                  >
                    {uploading ? "Envoi..." : "Valider"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Nom</label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder="Votre nom"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input
              value={profile?.email || ""}
              disabled
              className="opacity-60"
            />
            <p className="text-xs text-muted-foreground mt-1">
              L&apos;email ne peut pas être modifié.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Rôle</label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              {roleLabels[profile?.globalRole || "viewer"] ||
                profile?.globalRole}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Membre depuis
            </label>
            <p className="text-sm text-muted-foreground">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Apparence */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Apparence</h2>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          {/* Thème */}
          <div>
            <label className="text-sm font-medium mb-3 block">Thème</label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { mode: "light" as const, icon: Sun, label: "Clair" },
                  { mode: "dark" as const, icon: Moon, label: "Sombre" },
                  {
                    mode: "system" as const,
                    icon: Monitor,
                    label: "Système",
                  },
                ] as const
              ).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => applyTheme(mode)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    themeMode === mode
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {isTerminalActive ? (
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
              Les réglages d&apos;apparence individuels ne s&apos;appliquent pas en mode Terminal. Le thème CRT gère l&apos;ensemble de l&apos;interface.
            </div>
          ) : (
            <>
              {/* Couleur d'accentuation */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  <span className="flex items-center gap-1.5">
                    <PaintBucket className="h-4 w-4" />
                    Couleur d&apos;accentuation
                  </span>
                </label>
                <div className="flex gap-3">
                  {accentColors.map(({ value, label, light, dark }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setAccentColor(value);
                        previewPrefs({ accentColor: value });
                      }}
                      title={label}
                      className={`relative w-10 h-10 rounded-full border-2 transition-all ${
                        accentColor === value
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: isDarkMode() ? dark : light,
                      }}
                    >
                      {accentColor === value && (
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Utilisée pour les liens, les sélections et les éléments
                  interactifs
                </p>
              </div>

              {/* Taille de police */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  Taille de police de l&apos;éditeur
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { value: "small", label: "Petit", sample: "text-sm" },
                      { value: "normal", label: "Normal", sample: "text-base" },
                      { value: "large", label: "Grand", sample: "text-lg" },
                    ] as const
                  ).map(({ value, label, sample }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setFontSize(value);
                        previewPrefs({ fontSize: value });
                      }}
                      className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-colors ${
                        fontSize === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground"
                      }`}
                    >
                      <span className={sample}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Police de l'éditeur */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  <span className="flex items-center gap-1.5">
                    <Type className="h-4 w-4" />
                    Police de l&apos;éditeur
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {editorFonts.map(({ value, label, sample }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setEditorFont(value);
                        previewPrefs({ editorFont: value });
                      }}
                      className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-colors ${
                        editorFont === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground"
                      }`}
                    >
                      <span className={`text-base ${sample}`}>{label}</span>
                      <span className={`text-xs text-muted-foreground ${sample}`}>
                        Aa Bb Cc
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fond de l'éditeur */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  <span className="flex items-center gap-1.5">
                    <PaintBucket className="h-4 w-4" />
                    Fond de l&apos;éditeur
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {editorBackgrounds.map(({ value, label, bg, bgDark }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setEditorBackground(value);
                        previewPrefs({ editorBackground: value });
                      }}
                      className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-colors ${
                        editorBackground === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded border border-border"
                        style={{
                          backgroundColor: isDarkMode() ? bgDark : bg,
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Largeur du contenu */}
              <div>
                <label className="text-sm font-medium mb-3 block">
                  <span className="flex items-center gap-1.5">
                    <ArrowLeftRight className="h-4 w-4" />
                    Largeur du contenu
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {contentWidths.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setContentWidth(value);
                        previewPrefs({ contentWidth: value });
                      }}
                      className={`flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-colors ${
                        contentWidth === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30 text-muted-foreground"
                      }`}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Presets d'apparence */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Presets d&apos;apparence</h2>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          {/* Presets prédéfinis */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Presets prédéfinis
            </label>
            <div className="grid grid-cols-3 gap-3">
              {builtInPresets.map((preset) => {
                const active = isPresetActive(preset);
                const accent = accentColors.find(
                  (a) => a.value === preset.accentColor
                );
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: isDarkMode()
                            ? accent?.dark
                            : accent?.light,
                        }}
                      />
                      <span className="text-sm font-medium">{preset.name}</span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
                      )}
                    </div>
                    {preset.description && (
                      <p className="text-xs text-muted-foreground leading-snug">
                        {preset.description}
                      </p>
                    )}
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {
                          editorFonts.find((f) => f.value === preset.editorFont)
                            ?.label
                        }
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {
                          editorBackgrounds.find(
                            (b) => b.value === preset.editorBackground
                          )?.label
                        }
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {
                          contentWidths.find(
                            (w) => w.value === preset.contentWidth
                          )?.desc
                        }
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Effets Terminal — visibles uniquement quand le preset Terminal est actif */}
          {isTerminalActive && (
            <div className="border border-border rounded-lg p-4 space-y-4 bg-card/50">
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Effets CRT — Terminal
              </label>

              {/* Glitch */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Effet glitch</p>
                  <p className="text-xs text-muted-foreground">Micro-distorsions aléatoires subtiles</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={terminalEffects.glitch}
                  onClick={() => {
                    const next = { ...terminalEffects, glitch: !terminalEffects.glitch };
                    setTerminalEffects(next);
                    document.documentElement.dataset.glitch = String(next.glitch);
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    terminalEffects.glitch ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      terminalEffects.glitch ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Scan vertical */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Scan vertical</p>
                  <p className="text-xs text-muted-foreground">Bandeau lumineux simulant le balayage CRT</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={terminalEffects.scanVertical}
                  onClick={() => {
                    const next = { ...terminalEffects, scanVertical: !terminalEffects.scanVertical };
                    setTerminalEffects(next);
                    document.documentElement.dataset.scanVertical = String(next.scanVertical);
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    terminalEffects.scanVertical ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      terminalEffects.scanVertical ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Intensité scanlines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Intensité scanlines</p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {terminalEffects.scanlinesOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={terminalEffects.scanlinesOpacity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const next = { ...terminalEffects, scanlinesOpacity: v };
                    setTerminalEffects(next);
                    document.documentElement.style.setProperty(
                      "--terminal-scan-opacity",
                      (v / 1000).toFixed(3)
                    );
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Invisible</span>
                  <span>Maximum</span>
                </div>
              </div>
            </div>
          )}

          {/* Presets personnalisés */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">
                Mes presets personnalisés
              </label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => importRef.current?.click()}
                  title="Importer un preset JSON"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importer
                </Button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={openNewPresetForm}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Créer un preset
                </Button>
              </div>
            </div>

            {/* Formulaire de création/édition */}
            {showPresetForm && (
              <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {editingPreset
                      ? "Modifier le preset"
                      : "Sauvegarder la configuration actuelle"}
                  </p>
                  <button
                    onClick={() => {
                      setShowPresetForm(false);
                      setEditingPreset(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Nom</label>
                    <Input
                      ref={presetNameRef}
                      value={presetName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPresetName(e.target.value)
                      }
                      placeholder="Mon style"
                      className="h-8 text-sm"
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") saveCustomPreset();
                        if (e.key === "Escape") {
                          setShowPresetForm(false);
                          setEditingPreset(null);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Description (optionnel)
                    </label>
                    <Input
                      value={presetDescription}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPresetDescription(e.target.value)
                      }
                      placeholder="Pour mes rapports..."
                      className="h-8 text-sm"
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") saveCustomPreset();
                        if (e.key === "Escape") {
                          setShowPresetForm(false);
                          setEditingPreset(null);
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Les paramètres d&apos;apparence actuels seront sauvegardés
                    dans ce preset.
                  </p>
                  <Button
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={saveCustomPreset}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {editingPreset ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </div>
            )}

            {/* Liste des presets personnalisés */}
            {customPresets.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {customPresets.map((preset) => {
                  const active = isPresetActive(preset);
                  const accent = accentColors.find(
                    (a) => a.value === preset.accentColor
                  );
                  return (
                    <div
                      key={preset.id}
                      className={`group relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => applyPreset(preset)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{
                              backgroundColor: isDarkMode()
                                ? accent?.dark
                                : accent?.light,
                            }}
                          />
                          <span className="text-sm font-medium">
                            {preset.name}
                          </span>
                          {active && (
                            <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
                          )}
                        </div>
                        {preset.description && (
                          <p className="text-xs text-muted-foreground leading-snug mt-1">
                            {preset.description}
                          </p>
                        )}
                      </button>
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {
                            editorFonts.find(
                              (f) => f.value === preset.editorFont
                            )?.label
                          }
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {
                            editorBackgrounds.find(
                              (b) => b.value === preset.editorBackground
                            )?.label
                          }
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {
                            contentWidths.find(
                              (w) => w.value === preset.contentWidth
                            )?.desc
                          }
                        </span>
                      </div>
                      {/* Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportPresetJson(preset);
                          }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          title="Exporter en JSON"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sharePreset(preset);
                          }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          title="Partager avec la communauté"
                        >
                          <Share2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPresetForm(preset);
                          }}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          title="Modifier"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomPreset(preset.id);
                          }}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              !showPresetForm && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                  Aucun preset personnalisé. Configurez l&apos;apparence
                  ci-dessus puis cliquez sur « Créer un preset » pour
                  sauvegarder votre configuration.
                </p>
              )
            )}
          </div>

          {/* Presets de la communauté */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Bibliothèque communautaire
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  setShowShared(!showShared);
                  if (!showShared) loadSharedPresets();
                }}
              >
                {showShared ? "Masquer" : "Parcourir"}
              </Button>
            </div>

            {showShared && (
              <>
                {sharedPresets.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {sharedPresets.map((shared) => {
                      const config = shared.config as AppearancePreset;
                      const accent = accentColors.find(
                        (a) => a.value === config.accentColor
                      );
                      const isOwn = shared.userId === profile?.id;
                      return (
                        <div
                          key={shared.id}
                          className="group relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 border-border hover:border-primary/30 transition-all text-left"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{
                                backgroundColor: isDarkMode()
                                  ? accent?.dark
                                  : accent?.light,
                              }}
                            />
                            <span className="text-sm font-medium truncate">
                              {shared.name}
                            </span>
                          </div>
                          {shared.description && (
                            <p className="text-xs text-muted-foreground leading-snug">
                              {shared.description}
                            </p>
                          )}
                          <div className="flex gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {editorFonts.find((f) => f.value === config.editorFont)?.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {editorBackgrounds.find((b) => b.value === config.editorBackground)?.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Par {shared.authorName}
                          </p>
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => importSharedPreset(shared)}
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                              title="Ajouter à mes presets"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                applyPreset({
                                  id: shared.id,
                                  name: shared.name,
                                  accentColor: config.accentColor,
                                  editorFont: config.editorFont,
                                  editorBackground: config.editorBackground,
                                  contentWidth: config.contentWidth,
                                  fontSize: config.fontSize,
                                });
                              }}
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                              title="Prévisualiser"
                            >
                              <Palette className="h-3 w-3" />
                            </button>
                            {isOwn && (
                              <button
                                onClick={() => deleteSharedPreset(shared.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                title="Retirer du partage"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                    Aucun preset partagé pour le moment. Partagez vos presets
                    pour qu&apos;ils apparaissent ici.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Bouton sauvegarder */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>
    </div>
        )}
      </div>
    </div>
  );
}
