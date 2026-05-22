"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Loader2,
  User,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { EmojiPickerPopover } from "@/components/emoji-picker-popover";

const spaceTypes = [
  {
    value: "personal" as const,
    label: "Personnel",
    description: "Votre espace privé",
    icon: User,
  },
  {
    value: "organization" as const,
    label: "Organisation",
    description: "Visible par toute l'organisation",
    icon: Building2,
  },
];

const spacePresets = [
  { name: "Ressources Humaines", icon: "👥", description: "Procédures RH, fiches de poste, on-boarding" },
  { name: "Communication", icon: "📢", description: "Charte graphique, modèles, campagnes" },
  { name: "Commercial", icon: "💼", description: "Fiches produits, argumentaires, CRM" },
  { name: "Catalogues", icon: "📦", description: "Catalogues produits et services" },
  { name: "Formation", icon: "🎓", description: "Supports de formation, tutoriels" },
  { name: "Technique", icon: "🔧", description: "Documentation technique, procédures" },
  { name: "Base de connaissances", icon: "📚", description: "Wiki général de l'organisation" },
];

interface CreateSpaceDialogProps {
  onCreated?: () => void;
}

export function CreateSpaceDialog({ onCreated }: CreateSpaceDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [type, setType] = useState<"personal" | "team" | "organization">("personal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setDescription("");
    setIcon(null);
    setType("personal");
    setError("");
    setLoading(false);
  }

  async function handleCreate() {
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          icon: icon || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors de la création");
        setLoading(false);
        return;
      }

      const space = await res.json();
      toast.success("Espace créé");
      setOpen(false);
      reset();
      onCreated?.();
      router.push(`/s/${space.slug}`);
    } catch {
      toast.error("Erreur réseau");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Nouvel espace" />
        }
      >
        <Plus className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvel espace</DialogTitle>
          <DialogDescription>
            Créez un espace pour organiser vos documents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="space-name">Nom de l&apos;espace</Label>
            <div className="flex items-center gap-2">
              <EmojiPickerPopover
                value={icon}
                onChange={setIcon}
                size="md"
              />
              <Input
                id="space-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mon espace..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) handleCreate();
                }}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="space-description">Description (optionnel)</Label>
            <Input
              id="space-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="À quoi sert cet espace..."
            />
          </div>

          <div className="space-y-2">
            <Label>Type d&apos;espace</Label>
            <div className="grid grid-cols-2 gap-2">
              {spaceTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                    type === t.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <t.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Modèles d'espaces prédéfinis */}
          {type !== "personal" && (
            <div className="space-y-2">
              <Label>Modèles rapides</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {spacePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setName(preset.name);
                      setDescription(preset.description);
                      setIcon(preset.icon);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm transition-colors ${
                      name === preset.name
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <span className="text-base">{preset.icon}</span>
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer l&apos;espace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
