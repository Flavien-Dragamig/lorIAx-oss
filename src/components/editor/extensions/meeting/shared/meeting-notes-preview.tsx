"use client";

import { useState, useCallback } from "react";
import { Loader2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingNotesPreviewProps {
  meetingId: string;
  notesDocumentId: string | null;
  status: string;
}

export function MeetingNotesPreview({
  meetingId,
  notesDocumentId,
  status,
}: MeetingNotesPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [spaceSlug, setSpaceSlug] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!expanded && content === null && meetingId) {
      setLoading(true);
      try {
        const res = await fetch(`/api/meet/rooms/${meetingId}/notes`);
        if (res.ok) {
          const data = await res.json();
          setContent(data.content || "");
          setSpaceSlug(data.spaceSlug);
          setDocId(data.documentId);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  }, [expanded, content, meetingId]);

  if (status !== "completed" || !notesDocumentId) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleToggle}>
          {expanded ? (
            <ChevronDown className="h-4 w-4 mr-1" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-1" />
          )}
          Compte-rendu
        </Button>
        {spaceSlug && docId && (
          <a href={`/s/${spaceSlug}/${docId}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" title="Ouvrir le document">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border/50 p-4 mt-4 -mx-4 -mb-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du compte-rendu...
            </div>
          ) : content ? (
            <div className="prose prose-sm dark:prose-invert max-h-80 overflow-y-auto whitespace-pre-wrap text-sm">
              {content}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Compte-rendu introuvable.</p>
          )}
        </div>
      )}
    </>
  );
}
