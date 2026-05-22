"use client";

import { useEffect, useRef, useState } from "react";
import { X, Network } from "lucide-react";
import { createPortal } from "react-dom";
import "mind-elixir/style.css";

interface MindmapModalProps {
  mindmapId: string;
  title: string;
  onClose: (thumbnailUrl?: string) => void;
}

export function MindmapModal({ mindmapId, title, onClose }: MindmapModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      // Import dynamique (Mind Elixir est ESM)
      const MindElixir = (await import("mind-elixir")).default;

      // Charger les données existantes
      let data = MindElixir.new(title || "Nouvelle carte");
      try {
        const res = await fetch(`/api/mindmap/${mindmapId}`);
        const json = await res.json();
        if (json.data) data = typeof json.data === "string" ? JSON.parse(json.data) : json.data;
      } catch {
        // Conserver les données initiales en cas d'erreur
      }

      if (cancelled || !containerRef.current) return;

      const me = new MindElixir({
        el: containerRef.current,
        direction: MindElixir.RIGHT,
        draggable: true,
        contextMenu: true,
        toolBar: true,
        keypress: true,
        allowUndo: true,
      });
      me.init(data);
      meRef.current = me;
      setLoading(false);
      // Forcer le recalcul du layout après que le conteneur devient visible
      requestAnimationFrame(() => {
        me.toCenter?.();
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [mindmapId, title]);

  const handleClose = async () => {
    if (meRef.current) {
      try {
        const data = meRef.current.getData();

        const body: { data: string; thumbnailUrl?: string } = {
          data: JSON.stringify(data),
        };

        // exportSvg() retourne un Blob — lire le texte puis convertir en base64
        const svgBlob: Blob | undefined = meRef.current.exportSvg?.();
        if (svgBlob) {
          const svgStr = await svgBlob.text();
          const b64 = btoa(unescape(encodeURIComponent(svgStr)));
          body.thumbnailUrl = `data:image/svg+xml;base64,${b64}`;
        }

        await fetch(`/api/mindmap/${mindmapId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        onClose(body.thumbnailUrl);
      } catch {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Bloquer le scroll + touche Escape + bouton retour navigateur
  useEffect(() => {
    document.body.style.overflow = "hidden";

    // Pousser un état fantôme pour intercepter le bouton retour
    history.pushState({ mindmapOpen: true }, "");

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    const onPopstate = () => {
      // L'utilisateur a cliqué "retour" → fermer la modal sans naviguer
      handleClose();
    };

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("popstate", onPopstate);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("popstate", onPopstate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={title || "Mind map"}>
      {/* Barre titre */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-amber-400">Mind map</span>
          <span className="text-xs text-muted-foreground">—</span>
          <span className="text-sm text-foreground truncate">{title || "Mind map"}</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Fermer (Échap)"
          aria-label="Fermer la mind map"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Indicateur de chargement */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Chargement de la mind map...
        </div>
      )}

      {/* Conteneur Mind Elixir */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          visibility: loading ? "hidden" : "visible",
        }}
      />
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
