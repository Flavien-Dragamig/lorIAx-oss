"use client";

import { useState, useEffect } from "react";
import { Clock, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Commit {
  sha: string;
  message: string;
  author: string;
  timestamp: number;
}

interface HistoryPanelProps {
  documentId: string;
  onRestore?: (content: string) => void;
  onClose: () => void;
}

export function HistoryPanel({ documentId, onRestore, onClose }: HistoryPanelProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/history`)
      .then((r) => r.json())
      .then((data) => {
        setCommits(data.commits || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [documentId]);

  async function loadVersion(sha: string) {
    setSelectedSha(sha);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/history?sha=${sha}`);
      const data = await res.json();
      setPreview(data.content || "");
    } catch {
      setPreview(null);
    }
    setLoadingPreview(false);
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" />
          Historique
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} title="Fermer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground animate-pulse">
            Chargement...
          </div>
        ) : commits.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Aucun historique disponible
          </div>
        ) : (
          <div className="divide-y divide-border">
            {commits.map((commit) => (
              <button
                key={commit.sha}
                onClick={() => loadVersion(commit.sha)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                  selectedSha === commit.sha ? "bg-muted" : ""
                }`}
              >
                <p className="text-sm font-medium truncate">
                  {commit.message || "Modification"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {commit.author} · {formatDate(commit.timestamp)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {preview !== null && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap">
            {loadingPreview ? "Chargement..." : preview.slice(0, 500)}
            {!loadingPreview && preview.length > 500 && "…"}
          </div>
          {onRestore && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => onRestore(preview)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurer cette version
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
