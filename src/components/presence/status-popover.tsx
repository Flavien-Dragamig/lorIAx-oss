"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmojiPickerPopover } from "@/components/emoji-picker-popover";

const PREDEFINED_STATUSES = [
  { value: "online" as const, label: "En ligne", emoji: "🟢" },
  { value: "away" as const, label: "Absent(e)", emoji: "🟡" },
  { value: "in_meeting" as const, label: "En réunion", emoji: "📅" },
  { value: "dnd" as const, label: "Ne pas déranger", emoji: "🔴" },
];

type TtlPreset = "30m" | "1h" | "4h" | "never" | "custom";

const TTL_PRESETS: { id: TtlPreset; label: string; getValue: () => string | null }[] = [
  { id: "30m", label: "30 min", getValue: () => new Date(Date.now() + 30 * 60_000).toISOString() },
  { id: "1h", label: "1 heure", getValue: () => new Date(Date.now() + 60 * 60_000).toISOString() },
  { id: "4h", label: "4 heures", getValue: () => new Date(Date.now() + 4 * 60 * 60_000).toISOString() },
  { id: "never", label: "Jamais", getValue: () => null },
  { id: "custom", label: "Sur mesure", getValue: () => null },
];

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface StatusPopoverProps {
  currentStatus: {
    status: string;
    customEmoji: string | null;
    customText: string | null;
    customExpiresAt: string | null;
  } | null;
  onUpdate: (payload: {
    status?: "online" | "away" | "in_meeting" | "dnd";
    customEmoji?: string | null;
    customText?: string | null;
    customExpiresAt?: string | null;
  }) => Promise<void>;
  children: React.ReactNode;
}

export function StatusPopover({ currentStatus, onUpdate, children }: StatusPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"online" | "away" | "in_meeting" | "dnd">(
    (currentStatus?.status as "online" | "away" | "in_meeting" | "dnd") ?? "online"
  );
  const [emoji, setEmoji] = useState<string | null>(currentStatus?.customEmoji ?? null);
  const [text, setText] = useState(currentStatus?.customText ?? "");
  const [ttlPreset, setTtlPreset] = useState<TtlPreset>("never");
  const [customDatetime, setCustomDatetime] = useState(() =>
    toDatetimeLocal(new Date(Date.now() + 60 * 60_000).toISOString())
  );
  const [saving, setSaving] = useState(false);

  const getExpiresAt = (): string | null => {
    if (ttlPreset === "custom") {
      return customDatetime ? new Date(customDatetime).toISOString() : null;
    }
    return TTL_PRESETS.find((p) => p.id === ttlPreset)?.getValue() ?? null;
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({
      status: selectedStatus,
      customEmoji: emoji || null,
      customText: text || null,
      customExpiresAt: getExpiresAt(),
    });
    setSaving(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent className="w-72 p-4" sideOffset={8}>
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-foreground">Mon statut</p>

          {/* Statuts prédéfinis */}
          <div className="grid grid-cols-2 gap-2">
            {PREDEFINED_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSelectedStatus(s.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  selectedStatus === s.value
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{s.emoji}</span>
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Message personnalisé */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Message personnalisé</p>
            <div className="flex gap-2 items-center">
              <EmojiPickerPopover value={emoji} onChange={setEmoji} size="sm" clearable />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 80))}
                placeholder="En train de travailler sur…"
                className="flex-1"
                maxLength={80}
                aria-label="Message de statut"
              />
            </div>
            <p className="text-right text-xs text-muted-foreground">{text.length}/80</p>
          </div>

          {/* Expiration */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Expiration</p>
            <div className="grid grid-cols-3 gap-1">
              {/* Ligne 1 : 30 min | 1 heure | 4 heures */}
              {TTL_PRESETS.slice(0, 3).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTtlPreset(opt.id)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs transition-colors",
                    ttlPreset === opt.id
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {/* Ligne 2 : Jamais (1 col) | Sur mesure (2 cols) */}
              <button
                type="button"
                onClick={() => setTtlPreset("never")}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs transition-colors",
                  ttlPreset === "never"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Jamais
              </button>
              <button
                type="button"
                onClick={() => setTtlPreset("custom")}
                className={cn(
                  "col-span-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                  ttlPreset === "custom"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Sur mesure
              </button>
            </div>
            {ttlPreset === "custom" && (
              <input
                type="datetime-local"
                value={customDatetime}
                min={toDatetimeLocal(new Date().toISOString())}
                onChange={(e) => setCustomDatetime(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label="Date et heure d'expiration"
              />
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
