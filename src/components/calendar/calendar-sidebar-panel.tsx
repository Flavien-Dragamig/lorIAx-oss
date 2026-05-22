"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Calendar } from "@/types";

interface CalendarSidebarPanelProps {
  calendars: Calendar[];
  visibleIds: Set<string>;
  onToggleVisibility: (calendarId: string) => void;
  onCreateCalendar: () => void;
}

export default function CalendarSidebarPanel({
  calendars,
  visibleIds,
  onToggleVisibility,
  onCreateCalendar,
}: CalendarSidebarPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["personal", "team", "organization"])
  );

  const grouped = {
    personal: calendars.filter((c) => c.type === "personal"),
    team: calendars.filter((c) => c.type === "team"),
    organization: calendars.filter((c) => c.type === "organization"),
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const sectionLabels: Record<string, string> = {
    personal: "Mes calendriers",
    team: "Équipes",
    organization: "Organisation",
  };

  return (
    <div className="w-56 border-r border-border bg-card/50 p-3 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Calendriers</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCreateCalendar} title="Créer un calendrier">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {(["personal", "team", "organization"] as const).map((section) => {
        const cals = grouped[section];
        if (cals.length === 0) return null;
        const expanded = expandedSections.has(section);

        return (
          <div key={section}>
            <button
              onClick={() => toggleSection(section)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {sectionLabels[section]}
            </button>

            {expanded && (
              <div className="mt-1 space-y-0.5">
                {cals.map((cal) => {
                  const visible = visibleIds.has(cal.id);
                  return (
                    <button
                      key={cal.id}
                      onClick={() => onToggleVisibility(cal.id)}
                      className="flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-accent/50 transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: visible ? cal.color : "transparent",
                          border: `2px solid ${cal.color}`,
                        }}
                      />
                      <span className={`truncate ${visible ? "" : "text-muted-foreground"}`}>
                        {cal.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
