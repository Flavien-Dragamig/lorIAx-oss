"use client";

import { useState, useEffect, useRef } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExportDropdownProps {
  title: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportDropdown({ title }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleExportMarkdown() {
    setOpen(false);
    const getMarkdown = (window as Window & { __loriax_getMarkdown?: () => string }).__loriax_getMarkdown;
    if (!getMarkdown) {
      toast.error("Impossible de récupérer le contenu");
      return;
    }
    const markdown = getMarkdown();
    const filename = `${slugify(title)}.md`;
    downloadFile(markdown, filename, "text/markdown;charset=utf-8");
    toast.success(`Exporté en Markdown : ${filename}`);
  }

  function handleExportPDF() {
    setOpen(false);
    // Set a temporary title for the print dialog
    const originalTitle = document.title;
    document.title = title;
    window.print();
    document.title = originalTitle;
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs gap-1.5"
        onClick={() => setOpen(!open)}
        title="Exporter le document"
      >
        <Download className="h-3.5 w-3.5" />
        Exporter
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-popover border border-border rounded-lg shadow-lg p-1">
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Exporter le document
          </p>
          <button
            onClick={handleExportMarkdown}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-accent/50"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">Markdown</p>
              <p className="text-xs text-muted-foreground">Fichier .md</p>
            </div>
          </button>
          <button
            onClick={handleExportPDF}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-accent/50"
          >
            <Printer className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">PDF</p>
              <p className="text-xs text-muted-foreground">Via impression navigateur</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
