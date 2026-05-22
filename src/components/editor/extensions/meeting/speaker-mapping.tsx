"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface SpeakerMappingProps {
  speakers: Array<{ id: string; firstWords: string }>;
  participants: string[];
  onValidate: (mapping: Record<string, string>) => void;
  onSkip: () => void;
}

export function SpeakerMapping({
  speakers,
  participants,
  onValidate,
  onSkip,
}: SpeakerMappingProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    speakers.forEach((s, i) => {
      initial[s.id] = participants[i] || s.id;
    });
    return initial;
  });

  const handleChange = useCallback(
    (speakerId: string, name: string) => {
      setMapping((prev) => ({ ...prev, [speakerId]: name }));
    },
    []
  );

  return (
    <div className="border-t border-border/50 p-4">
      <div className="border border-border/50 rounded-md overflow-hidden">
        {speakers.map((speaker, i) => (
          <div
            key={speaker.id}
            className={`flex items-center gap-3 px-3 py-2 text-xs ${
              i % 2 === 0 ? "bg-muted/30" : ""
            } ${i < speakers.length - 1 ? "border-b border-border/50" : ""}`}
          >
            <span className="text-muted-foreground w-20 shrink-0">{speaker.id}</span>
            <span className="text-muted-foreground">→</span>
            <select
              value={mapping[speaker.id] || ""}
              onChange={(e) => handleChange(speaker.id, e.target.value)}
              className="h-6 rounded bg-primary text-primary-foreground px-2 text-xs border-0 cursor-pointer"
            >
              {participants.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value={speaker.id}>{speaker.id}</option>
            </select>
            <span className="text-muted-foreground/60 ml-auto truncate max-w-[180px]">
              « {speaker.firstWords} »
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Passer
        </Button>
        <Button size="sm" onClick={() => onValidate(mapping)}>
          Valider
        </Button>
      </div>
    </div>
  );
}
