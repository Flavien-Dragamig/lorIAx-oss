"use client";

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ParticipantChipsProps {
  participants: string[];
  onChange: (participants: string[]) => void;
  maxParticipants?: number;
  readOnly?: boolean;
}

export function ParticipantChips({
  participants,
  onChange,
  maxParticipants = 10,
  readOnly = false,
}: ParticipantChipsProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || participants.length >= maxParticipants || participants.includes(trimmed)) return;
    onChange([...participants, trimmed]);
    setInputValue("");
  }, [inputValue, participants, maxParticipants, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(participants.filter((_, i) => i !== index));
    },
    [participants, onChange]
  );

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="text-xs text-muted-foreground mb-2">
        Participants ({participants.length}/{maxParticipants})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {participants.map((name, i) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
          >
            {name}
            {!readOnly && (
              <button
                onClick={() => handleRemove(i)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && participants.length < maxParticipants && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="+ Ajouter"
            className="h-6 w-28 text-xs border-dashed border-primary/50 bg-transparent placeholder:text-primary/60"
          />
        )}
      </div>
    </div>
  );
}
