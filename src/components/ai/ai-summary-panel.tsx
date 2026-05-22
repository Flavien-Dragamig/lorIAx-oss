"use client";

import { useState } from "react";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface AISummaryPanelProps {
  documentId: string;
  onClose: () => void;
}

function SummaryShimmer() {
  return (
    <div className="space-y-3 py-2">
      <div className="shimmer-line h-3 w-full" />
      <div className="shimmer-line h-3 w-5/6" />
      <div className="shimmer-line h-3 w-4/5" />
      <div className="shimmer-line h-3 w-full" />
      <div className="shimmer-line h-3 w-3/4" />
      <div className="shimmer-line h-3 w-5/6" />
    </div>
  );
}

export function AISummaryPanel({ documentId, onClose }: AISummaryPanelProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erreur serveur");
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setError("Impossible de générer le résumé. Vérifiez la configuration IA.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Résumé IA
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} title="Fermer" aria-label="Fermer le résumé IA">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {summary === null && !loading && !error && (
          <EmptyState
            icon={Sparkles}
            title="Résumé automatique"
            description="Générez un résumé concis de ce document en un clic."
            size="sm"
            action={
              <Button onClick={generateSummary} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Générer le résumé
              </Button>
            }
          />
        )}

        {loading && <SummaryShimmer />}

        {error && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={generateSummary} disabled={loading}>
              Réessayer
            </Button>
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-3">
            <div className="prose prose-sm dark:prose-invert text-sm whitespace-pre-wrap">
              {summary}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={generateSummary}
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regénérer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
