"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

const STORAGE_KEY = "loriax-sidebar-sections";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  count?: number;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

function readSectionsState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSectionState(id: string, isOpen: boolean) {
  try {
    const state = readSectionsState();
    state[id] = isOpen;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponible
  }
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  count,
  actions,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hydrated = useRef(false);

  // Hydrater depuis localStorage après montage (évite mismatch SSR)
  useEffect(() => {
    const state = readSectionsState();
    if (id in state) {
      setIsOpen(state[id]);
    }
    hydrated.current = true;
  }, [id]);

  function toggle() {
    setIsOpen((prev) => {
      const next = !prev;
      writeSectionState(id, next);
      return next;
    });
  }

  return (
    <div className="border-t border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <ChevronRight
            className="h-3 w-3 text-muted-foreground transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] text-muted-foreground/70 ml-0.5">
              ({count})
            </span>
          )}
        </button>
        {actions && <div className="flex items-center">{actions}</div>}
      </div>

      {/* Contenu animé */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden min-h-0">{children}</div>
      </div>
    </div>
  );
}
