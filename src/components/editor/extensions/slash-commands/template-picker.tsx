"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import type { Editor } from "@tiptap/core";
import { markdownToHtml } from "./markdown-to-html";

// ---------------------------------------------------------------------------
// Template picker popup
// ---------------------------------------------------------------------------

interface TemplateEntry {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  réunion: "Réunion",
  projet: "Projet",
  commercial: "Commercial",
  documentation: "Documentation",
  savoir: "Savoir",
  personnel: "Personnel",
  résolution: "Résolution",
  rapport: "Rapport",
  "base de données": "Base de données",
  général: "Général",
};

export function openTemplatePicker(editor: Editor) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.zIndex = "9999";

  const { view } = editor;
  const coords = view.coordsAtPos(view.state.selection.from);
  container.style.left = `${coords.left}px`;
  container.style.top = `${coords.bottom + 4}px`;
  document.body.appendChild(container);

  const root = createRoot(container);

  function cleanup() {
    root.unmount();
    container.remove();
    document.removeEventListener("mousedown", handleOutsideClick);
  }

  function handleOutsideClick(e: MouseEvent) {
    if (!container.contains(e.target as Node)) {
      cleanup();
    }
  }

  setTimeout(() => {
    document.addEventListener("mousedown", handleOutsideClick);
  }, 100);

  function TemplatePicker() {
    const [templates, setTemplates] = React.useState<
      { id: string; name: string; icon: string; category: string; description: string }[]
    >([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedIndex, setSelectedIndex] = React.useState(0);

    React.useEffect(() => {
      fetch("/api/templates")
        .then((r: Response) => (r.ok ? r.json() : []))
        .then((data: TemplateEntry[]) => {
          if (Array.isArray(data)) setTemplates(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => {
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          cleanup();
          editor.chain().focus().run();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev: number) => (prev + 1) % templates.length);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev: number) => (prev + templates.length - 1) % templates.length);
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (templates[selectedIndex]) selectTemplate(templates[selectedIndex].id);
        }
      }
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [templates, selectedIndex]);

    async function selectTemplate(id: string) {
      try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) return;
        const tmpl = await res.json();

        if (tmpl.content?.database) {
          const dbDef = tmpl.content.database;
          const spaceId = typeof window !== "undefined"
            ? (window as Window & { __loriax_spaceId?: string }).__loriax_spaceId ?? ""
            : "";
          if (!spaceId) return;

          const dbRes = await fetch("/api/databases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: dbDef.name,
              spaceId,
              columns: dbDef.columns,
            }),
          });
          if (!dbRes.ok) return;
          const newDb = await dbRes.json();

          const liveEditor = ((document.querySelector(".ProseMirror") as (Element & { editor?: Editor }) | null)?.editor ?? editor) as Editor;
          liveEditor.chain().focus().insertContent({
            type: "databaseBlock",
            attrs: { databaseId: newDb.id, databaseName: newDb.name, viewMode: "table" },
          }).run();
        } else {
          const md = tmpl.content?.markdown || "";
          if (md) {
            const html = markdownToHtml(md);
            editor.chain().focus().insertContent(html).run();
          }
        }
      } catch {
        // silently fail
      }
      cleanup();
    }

    if (loading) {
      return React.createElement(
        "div",
        { className: "slash-command-menu" },
        React.createElement(
          "div",
          { className: "px-3 py-4 text-xs text-muted-foreground text-center" },
          "Chargement..."
        )
      );
    }

    if (templates.length === 0) {
      return React.createElement(
        "div",
        { className: "slash-command-menu" },
        React.createElement(
          "div",
          { className: "px-3 py-4 text-xs text-muted-foreground text-center" },
          "Aucun modèle disponible"
        )
      );
    }

    const categories = Array.from(new Set(templates.map((t: TemplateEntry) => t.category || "autre"))) as string[];
    let globalIndex = 0;

    return React.createElement(
      "div",
      { className: "slash-command-menu max-h-[320px] overflow-y-auto" },
      categories.map((cat: string) => {
        const catTemplates = templates.filter((t: TemplateEntry) => (t.category || "autre") === cat);
        if (catTemplates.length === 0) return null;
        return React.createElement(
          "div",
          { key: cat },
          React.createElement(
            "div",
            { className: "px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider" },
            CATEGORY_LABELS[cat] || cat
          ),
          catTemplates.map((t: TemplateEntry) => {
            const idx = globalIndex++;
            return React.createElement(
              "button",
              {
                key: t.id,
                className: `slash-command-item ${idx === selectedIndex ? "is-selected" : ""}`,
                onClick: () => selectTemplate(t.id),
                onMouseEnter: () => setSelectedIndex(idx),
              },
              React.createElement("div", { className: "icon text-base" }, t.icon || ""),
              React.createElement(
                "div",
                null,
                React.createElement("p", { className: "font-medium" }, t.name),
                t.description &&
                  React.createElement(
                    "p",
                    { className: "text-xs text-muted-foreground" },
                    t.description
                  )
              )
            );
          })
        );
      })
    );
  }

  root.render(React.createElement(TemplatePicker));
}
