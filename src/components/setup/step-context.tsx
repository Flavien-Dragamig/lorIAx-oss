"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, SkipForward, Briefcase } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

const SECTORS = [
  "Agriculture",
  "Artisanat",
  "Association",
  "BTP / Construction",
  "Commerce / Distribution",
  "Communication / Média",
  "Conseil",
  "Culture / Loisirs",
  "Éducation / Formation",
  "Énergie / Environnement",
  "Finance / Assurance",
  "Immobilier",
  "Industrie / Fabrication",
  "Informatique / Numérique",
  "Juridique",
  "Logistique / Transport",
  "Recherche / Science",
  "Santé / Social",
  "Services aux entreprises",
  "Tourisme / Hôtellerie",
];

interface StepContextProps {
  data: SetupData;
  onUpdate: (context: SetupData["context"]) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export function StepContext({ data, onUpdate, onNext, onSkip, onBack }: StepContextProps) {
  const [website, setWebsite] = useState(data.context.website);
  const [sector, setSector] = useState(data.context.sector);
  const [presentation, setPresentation] = useState(data.context.presentation);
  const [values, setValues] = useState(data.context.values);
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    setSaving(true);
    try {
      const res = await fetch("/api/setup/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website, sector, presentation, values }),
      });
      if (!res.ok) throw new Error("Erreur");

      onUpdate({ website, sector, presentation, values });
      onNext();
    } catch {
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Briefcase className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Contexte métier</h2>
        <p className="text-muted-foreground mt-1">
          Ces informations permettront à l&apos;assistant IA de mieux comprendre votre activité.
          Tous les champs sont facultatifs.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ctx-website">Site web institutionnel</Label>
          <Input
            id="ctx-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://www.monorganisation.fr"
            type="url"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctx-sector">Secteur d&apos;activité</Label>
          <Input
            id="ctx-sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="Ex : Conseil, Éducation, Santé..."
            list="sectors-list"
          />
          <datalist id="sectors-list">
            {SECTORS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctx-presentation">Présentation de l&apos;organisation</Label>
          <textarea
            id="ctx-presentation"
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            placeholder="Décrivez brièvement votre organisation, ses missions..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctx-values">Valeurs et mission</Label>
          <textarea
            id="ctx-values"
            value={values}
            onChange={(e) => setValues(e.target.value)}
            placeholder="Les valeurs fondatrices, la mission principale..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <div className="flex gap-2">
          {onBack && (
            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>
          )}
          <Button variant="ghost" onClick={onSkip} className="gap-2">
            <SkipForward className="h-4 w-4" />
            Passer
          </Button>
        </div>
        <Button onClick={handleNext} disabled={saving} className="gap-2">
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
