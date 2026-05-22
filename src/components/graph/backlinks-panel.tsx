"use client";

import Link from "next/link";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Backlink {
  sourceId: string;
  linkText: string;
  title: string;
  slug: string;
}

interface BacklinksPanelProps {
  backlinks: Backlink[];
  spaceSlug: string;
  onClose: () => void;
}

export function BacklinksPanel({
  backlinks,
  spaceSlug,
  onClose,
}: BacklinksPanelProps) {
  return (
    <aside className="w-72 border-l border-border bg-card overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">
          Backlinks ({backlinks.length})
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="Fermer">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-2">
        {backlinks.map((bl) => (
          <Link
            key={bl.sourceId}
            href={`/s/${spaceSlug}/${bl.sourceId}`}
            className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">{bl.title}</p>
              {bl.linkText && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  &ldquo;{bl.linkText}&rdquo;
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
