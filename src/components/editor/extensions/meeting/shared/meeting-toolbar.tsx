"use client";

import { useState, useRef, useCallback } from "react";
import { GripHorizontal, Pencil, Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MeetingToolbarProps {
  title: string;
  isEditable: boolean;
  isSelected: boolean;
  onTitleChange: (newTitle: string) => void;
  onDelete: () => void;
}

export function MeetingToolbar({
  title,
  isEditable,
  isSelected,
  onTitleChange,
  onDelete,
}: MeetingToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEditing = useCallback(() => {
    if (!isEditable) return;
    setEditValue(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [title, isEditable]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    }
    setEditing(false);
  }, [editValue, title, onTitleChange]);

  return (
    <div className={`meeting-block-toolbar ${isSelected ? "is-visible" : ""}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0" data-drag-handle>
        <GripHorizontal className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleSave}
              className="h-6 w-56 text-xs"
            />
            <button onClick={handleSave} className="meeting-block-action" aria-label="Valider le titre">
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEditing}
            className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors group text-left truncate"
            disabled={!isEditable}
          >
            {title}
            {isEditable && (
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isEditable && (
          <button
            onClick={onDelete}
            className="meeting-block-action text-destructive hover:text-destructive"
            title="Supprimer"
            aria-label="Supprimer le bloc réunion"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
