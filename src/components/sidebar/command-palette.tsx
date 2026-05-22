"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  FileText,
  Search,
  Plus,
  Network,
  Sparkles,
  Settings,
  Home,
} from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  spaceSlug: string;
  spaceName: string;
  excerpt?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchDocuments = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      if (Array.isArray(data.results)) {
        setResults(data.results);
      }
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchDocuments(query), 200);
    return () => clearTimeout(timer);
  }, [query, searchDocuments]);

  function navigate(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        <Command shouldFilter={false}>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher un document, une commande..."
            className="w-full px-4 py-3 text-sm bg-transparent border-b border-border outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun resultat
            </Command.Empty>

            {results.length > 0 && (
              <Command.Group heading="Documents">
                {results.map((r) => (
                  <Command.Item
                    key={r.id}
                    onSelect={() =>
                      navigate(`/s/${r.spaceSlug}/${r.id}`)
                    }
                    className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.spaceName}
                      </p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions rapides">
              <Command.Item
                onSelect={() => navigate("/")}
                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
              >
                <Home className="h-4 w-4 text-muted-foreground" />
                Accueil
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/search")}
                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                Recherche avancee
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/graph")}
                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
              >
                <Network className="h-4 w-4 text-muted-foreground" />
                Graphe de connaissances
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/ai")}
                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
              >
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Assistant IA
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/new")}
                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
                Nouveau document
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/settings")}
                className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm aria-selected:bg-accent"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Parametres
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex gap-4">
            <span>
              <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd>{" "}
              Naviguer
            </span>
            <span>
              <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">↵</kbd>{" "}
              Ouvrir
            </span>
            <span>
              <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Esc</kbd>{" "}
              Fermer
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
