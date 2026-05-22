"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, LayoutGrid, Plus, X } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepSpacesProps {
  data: SetupData;
  onUpdate: (spaces: SetupData["spaces"]) => void;
  onNext: () => void;
  onBack?: () => void;
}

interface SpaceRow {
  name: string;
  description: string;
  classification: "public" | "internal" | "confidential" | "secret";
  icon: string | null;
}

const CLASSIFICATION_LABELS: Record<SpaceRow["classification"], string> = {
  public: "Public",
  internal: "Interne",
  confidential: "Confidentiel",
  secret: "Secret",
};

const DEFAULT_SPACES: SpaceRow[] = [
  {
    name: "Général",
    description: "Informations générales et annonces",
    classification: "internal",
    icon: null,
  },
  {
    name: "Direction",
    description: "Stratégie et décisions de direction",
    classification: "confidential",
    icon: null,
  },
  {
    name: "RH",
    description: "Ressources humaines et recrutement",
    classification: "confidential",
    icon: null,
  },
  {
    name: "Projets",
    description: "Suivi de projets et livrables",
    classification: "internal",
    icon: null,
  },
];

export function StepSpaces({ onUpdate, onNext, onBack }: StepSpacesProps) {
  const [rows, setRows] = useState<SpaceRow[]>(DEFAULT_SPACES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateRow(index: number, patch: Partial<SpaceRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { name: "", description: "", classification: "internal", icon: null },
    ]);
  }

  async function handleNext() {
    for (const row of rows) {
      if (!row.name.trim()) {
        setError("Le nom de chaque espace est obligatoire");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/setup/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaces: rows }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la création des espaces");
      }

      const result = await res.json();
      const ids: string[] = result.ids ?? [];

      const created: SetupData["spaces"] = rows.map((row, i) => ({
        id: ids[i] ?? "",
        name: row.name.trim(),
        slug: "",
        description: row.description.trim(),
        classification: row.classification,
        icon: row.icon,
      }));

      onUpdate(created);
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <LayoutGrid className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Espaces de travail</h2>
        <p className="text-muted-foreground mt-1">
          Définissez les espaces qui structureront votre base de connaissances.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md border border-input bg-background p-3"
          >
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Input
                placeholder="Nom de l'espace"
                value={row.name}
                onChange={(e) => updateRow(index, { name: e.target.value })}
              />
              <Input
                placeholder="Description"
                value={row.description}
                onChange={(e) =>
                  updateRow(index, { description: e.target.value })
                }
              />
            </div>

            <Select
              value={row.classification}
              onValueChange={(value) =>
                updateRow(index, {
                  classification: value as SpaceRow["classification"],
                })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(CLASSIFICATION_LABELS) as [
                    SpaceRow["classification"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              aria-label="Supprimer l'espace"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={addRow} className="gap-2 w-full">
        <Plus className="h-4 w-4" />
        Ajouter un espace
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>
        )}
        <Button onClick={handleNext} disabled={saving} className="gap-2 ml-auto">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Suivant
        </Button>
      </div>
    </div>
  );
}
