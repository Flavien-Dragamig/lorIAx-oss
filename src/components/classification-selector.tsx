"use client";

import { useEffect, useRef } from "react";
import {
  Globe,
  Building2,
  Shield,
  ShieldAlert,
  Check,
  type LucideIcon,
} from "lucide-react";

type ClassificationLevel = "public" | "internal" | "confidential" | "secret";

const classificationOptions: {
  value: ClassificationLevel;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Partageable à l'extérieur",
    icon: Globe,
  },
  {
    value: "internal",
    label: "Interne",
    description: "Visible par l'organisation",
    icon: Building2,
  },
  {
    value: "confidential",
    label: "Confidentiel",
    description: "Accès restreint aux membres",
    icon: Shield,
  },
  {
    value: "secret",
    label: "Secret",
    description: "Auteur et admins uniquement",
    icon: ShieldAlert,
  },
];

export function ClassificationSelector({
  current,
  allowedLevels,
  onChange,
  open,
  onClose,
}: {
  current: ClassificationLevel;
  allowedLevels: ClassificationLevel[];
  onChange: (level: ClassificationLevel) => void;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-72 bg-popover border border-border rounded-lg shadow-lg p-1"
    >
      <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
        Classification du document
      </p>
      {classificationOptions.map((opt) => {
        const Icon = opt.icon;
        const isActive = current === opt.value;
        const isAllowed = allowedLevels.includes(opt.value);

        return (
          <div key={opt.value} className="relative group">
            <button
              onClick={() => {
                if (!isAllowed) return;
                onChange(opt.value);
                onClose();
              }}
              disabled={!isAllowed}
              className={`w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                !isAllowed
                  ? "opacity-40 cursor-not-allowed"
                  : isActive
                    ? "bg-accent"
                    : "hover:bg-accent/50"
              }`}
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
              {isActive && (
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              )}
            </button>
            {!isAllowed && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-50 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background shadow">
                Non autorisé par la classification de l&apos;espace
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
