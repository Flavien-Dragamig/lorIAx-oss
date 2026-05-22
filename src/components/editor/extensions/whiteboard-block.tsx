"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { PenLine, GripHorizontal, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhiteboardModal } from "./whiteboard-modal";
import { useBlockLock } from "@/hooks/use-block-lock";
import { ModalLockBanner } from "@/components/editor/modal-lock-banner";

export function WhiteboardBlockView({ node, updateAttributes, editor, selected, deleteNode }: NodeViewProps) {
  const { canvasId, title, thumbnailUrl, lockedBy, lockedAt } = node.attrs;
  const [modalOpen, setModalOpen] = useState(false);
  const editable = editor?.isEditable;

  const { isLockedByOther, acquireLock, releaseLock } = useBlockLock({
    lockedBy,
    lockedAt,
    modalOpen,
    updateAttributes,
  });

  const handleOpen = useCallback(() => {
    if (isLockedByOther || !editable) return;
    acquireLock();
    setModalOpen(true);
  }, [isLockedByOther, editable, acquireLock]);

  const handleClose = useCallback((thumbnailDataUrl?: string) => {
    setModalOpen(false);

    // Mettre à jour la miniature si disponible (placeholder — sera implémenté plus tard)
    if (thumbnailDataUrl) {
      updateAttributes({ thumbnailUrl: thumbnailDataUrl });
    }

    releaseLock();
  }, [updateAttributes, releaseLock]);

  return (
    <NodeViewWrapper data-type="whiteboard-block" className={`editor-block-wrapper ${selected ? "is-selected" : ""}`}>
      <div className="editor-block" contentEditable={false}>
        {/* Toolbar */}
        <div className={`editor-block-toolbar ${selected ? "is-visible" : ""}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0" data-drag-handle>
            <GripHorizontal className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
            <PenLine className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={title || ""}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Tableau blanc"
              className="flex-1 px-1.5 py-0.5 text-xs font-medium rounded border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary truncate"
              readOnly={!editable}
            />
          </div>
          <div className="flex items-center gap-1">
            <ModalLockBanner isLocked={isLockedByOther} />
            {!isLockedByOther && editable && (
              <Button
                size="xs"
                onClick={handleOpen}
                title="Ouvrir le tableau blanc"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="text-[11px]">Ouvrir</span>
              </Button>
            )}
            {editable && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={deleteNode}
                title="Supprimer le bloc"
                aria-label="Supprimer le bloc tableau blanc"
                className="hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Contenu — miniature ou placeholder */}
        <div className="editor-block-content">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={title || "Tableau blanc"}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <PenLine className="h-10 w-10" />
              <span className="text-xs">
                Cliquer sur &laquo; Ouvrir &raquo; pour commencer
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modale plein écran — portal vers document.body pour éviter le containing block TipTap */}
      {modalOpen && canvasId && typeof document !== "undefined" && createPortal(
        <WhiteboardModal
          canvasId={canvasId}
          title={title || "Tableau blanc"}
          onClose={handleClose}
        />,
        document.body
      )}
    </NodeViewWrapper>
  );
}
