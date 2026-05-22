"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState, useCallback } from "react";
import Image from "next/image";
import { Network, GripHorizontal, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MindmapModal } from "./mindmap-modal";
import { useBlockLock } from "@/hooks/use-block-lock";
import { ModalLockBanner } from "@/components/editor/modal-lock-banner";

export function MindmapBlockView({ node, updateAttributes, editor, selected, deleteNode }: NodeViewProps) {
  const { mindmapId, title, thumbnailUrl, lockedBy, lockedAt } = node.attrs;
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

  const handleClose = useCallback((newThumbnailUrl?: string) => {
    setModalOpen(false);

    // Mettre à jour la miniature si disponible
    if (newThumbnailUrl) {
      updateAttributes({ thumbnailUrl: newThumbnailUrl });
    }

    releaseLock();
  }, [updateAttributes, releaseLock]);

  return (
    <NodeViewWrapper data-type="mindmap-block" className={`editor-block-wrapper ${selected ? "is-selected" : ""}`}>
      <div className="editor-block" contentEditable={false}>
        {/* Toolbar */}
        <div className={`editor-block-toolbar ${selected ? "is-visible" : ""}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0" data-drag-handle>
            <GripHorizontal className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
            <Network className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
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
              placeholder="Mind map"
              className="flex-1 px-1.5 py-0.5 text-xs font-medium rounded border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary truncate"
              readOnly={!editable}
            />
          </div>
          <div className="flex items-center gap-1">
            <ModalLockBanner isLocked={isLockedByOther} />
            {!isLockedByOther && editable && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleOpen}
                title="Ouvrir la mind map"
                className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
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
                aria-label="Supprimer le bloc mind map"
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
            <Image
              src={thumbnailUrl}
              alt={title || "Mind map"}
              width={400}
              height={300}
              unoptimized
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <Network className="h-10 w-10" />
              <span className="text-xs">
                Cliquer sur &laquo; Ouvrir &raquo; pour commencer
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modale plein écran */}
      {modalOpen && mindmapId && (
        <MindmapModal
          mindmapId={mindmapId}
          title={title || "Mind map"}
          onClose={handleClose}
        />
      )}
    </NodeViewWrapper>
  );
}
