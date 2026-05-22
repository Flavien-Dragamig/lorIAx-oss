"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ArrowRight, Clock } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepWelcomeProps {
  data: SetupData;
  onPurged: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepWelcome({ data, onPurged, onNext, onSkip }: StepWelcomeProps) {
  const [confirming, setConfirming] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurge() {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/purge", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la purge");
      }
      onPurged();
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setPurging(false);
    }
  }

  // Si déjà purgé (retour arrière), passer directement à la suite
  if (data.purged) {
    onNext();
    return null;
  }

  return (
    <div className="text-center space-y-6">
      <Sparkles className="h-16 w-16 text-primary mx-auto" />
      <h1 className="text-3xl font-bold">Bienvenue sur LorIAx</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        Configurez votre instance en quelques étapes : identité de votre
        organisation, utilisateurs, espaces de travail et autorisations.
      </p>

      {!confirming ? (
        <div className="flex flex-col gap-3 items-center pt-4">
          <Button size="lg" className="gap-2 w-64" onClick={() => setConfirming(true)}>
            Configurer mon instance
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={onSkip}>
            <Clock className="h-4 w-4" />
            Plus tard
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-6 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Cette opération va supprimer toutes les données de démonstration
            (utilisateurs, documents, espaces, etc.). Les fournisseurs IA et les
            prompts système seront conservés.
          </p>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={purging}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePurge}
              disabled={purging}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {purging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression en cours…
                </>
              ) : (
                "Confirmer et continuer"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
