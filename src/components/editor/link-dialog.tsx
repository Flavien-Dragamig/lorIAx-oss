"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Search, Loader2 } from "lucide-react";

interface DocumentResult {
  id: string;
  title: string;
  spaceSlug: string;
  spaceName: string;
}

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (url: string, text?: string) => void;
  initialUrl?: string;
}

type LinkMode = "document" | "external";

export function LinkDialog({ open, onOpenChange, onConfirm, initialUrl = "" }: LinkDialogProps) {
  const [mode, setMode] = useState<LinkMode>("document");
  const [url, setUrl] = useState(initialUrl);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocumentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialiser quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setQuery("");
      setResults([]);
      setMode("document");
    }
  }, [open, initialUrl]);

  // Recherche avec debounce
  useEffect(() => {
    if (!query.trim() || mode !== "document") {
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.results || [];
        setResults(
          items.map((r: { id: string; title: string; spaceSlug?: string; spaceName?: string }) => ({
            id: r.id,
            title: r.title,
            spaceSlug: r.spaceSlug || "",
            spaceName: r.spaceName || "",
          }))
        );
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, mode]);

  function handleSelectDocument(doc: DocumentResult) {
    const href = `/s/${doc.spaceSlug}/${doc.id}`;
    onConfirm(href, doc.title);
    onOpenChange(false);
  }

  function handleSubmitExternal(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim()) {
      onConfirm(url.trim());
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insérer un lien</DialogTitle>
        </DialogHeader>

        {/* Toggle mode */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("document")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors ${
              mode === "document"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            <FileText className="h-4 w-4" />
            Document
          </button>
          <button
            type="button"
            onClick={() => setMode("external")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors ${
              mode === "external"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            URL externe
          </button>
        </div>

        {mode === "document" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="doc-search">Rechercher un document</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="doc-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tapez pour rechercher..."
                  className="pl-9"
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {results.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {results.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleSelectDocument(doc)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      {doc.spaceName && (
                        <p className="text-xs text-muted-foreground">{doc.spaceName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.trim() && !searching && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun document trouvé
              </p>
            )}

            {!query.trim() && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Commencez à taper pour rechercher un document
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitExternal} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.fr"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={!url.trim()}>
                Insérer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
