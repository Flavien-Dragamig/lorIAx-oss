"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import dynamic from "next/dynamic";
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  Trash2,
  LayoutGrid,
  GanttChart,
  GripHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Calendar, CalendarEvent } from "@/types";

const GanttView = dynamic(
  () => import("@/components/gantt/gantt-view").then((m) => ({ default: m.GanttView })),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Mini Month Grid (reusable)
// ---------------------------------------------------------------------------

const DAY_NAMES = ["L", "M", "M", "J", "V", "S", "D"];

function getMonthGrid(date: Date): Date[][] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const start = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }
  const lastWeek = weeks[weeks.length - 1];
  if (lastWeek[0].getMonth() !== month) weeks.pop();
  return weeks;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

const MONTH_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ---------------------------------------------------------------------------
// CalendarBlockView
// ---------------------------------------------------------------------------

export function CalendarBlockView({
  node,
  updateAttributes,
  selected,
  deleteNode,
}: Pick<NodeViewProps, "node" | "updateAttributes" | "selected" | "deleteNode">) {
  const calendarIds: string[] = (() => {
    try {
      return JSON.parse(node.attrs.calendarIds || "[]");
    } catch {
      return [];
    }
  })();
  const viewMode: "month" | "gantt" = node.attrs.viewMode || "month";
  const showTitle = node.attrs.showTitle !== false;
  const blockHeight: number = node.attrs.height || 400;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(calendarIds.length === 0);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync fullscreen state with native API (Escape, etc.)
  useEffect(() => {
    const handleChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Resize handle state
  const resizeStartY = useRef<number | null>(null);
  const resizeStartHeight = useRef<number>(blockHeight);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = blockHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (resizeStartY.current === null) return;
      const delta = ev.clientY - resizeStartY.current;
      const newHeight = Math.max(200, resizeStartHeight.current + delta);
      updateAttributes({ height: Math.round(newHeight) });
    };

    const onMouseUp = () => {
      resizeStartY.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [blockHeight, updateAttributes]);

  // Fetch calendars
  useEffect(() => {
    fetch("/api/calendars")
      .then((r) => r.json())
      .then((data) => setCalendars(data))
      .catch(() => {});
  }, []);

  // Fetch events
  useEffect(() => {
    if (calendarIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0).toISOString();

    Promise.all(
      calendarIds.map((id) =>
        fetch(`/api/calendars/${id}/events?start=${start}&end=${end}`)
          .then((r) => r.json())
          .catch(() => [])
      )
    )
      .then((results) => {
        const all = results.flat().map((e: CalendarEvent) => ({
          ...e,
          startAt: new Date(e.startAt),
          endAt: new Date(e.endAt),
        }));
        setEvents(all);
      })
      .finally(() => setLoading(false));
  }, [calendarIds.join(","), currentDate.getMonth(), currentDate.getFullYear()]);

  const weeks = getMonthGrid(currentDate);
  const currentMonth = currentDate.getMonth();
  const calColorMap = new Map(calendars.map((c) => [c.id, c.color]));

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.startAt), day));

  // Config panel
  if (showConfig) {
    return (
      <NodeViewWrapper className={`my-4 ${selected ? "ring-2 ring-primary/50 rounded-lg" : ""}`}>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <CalIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Configurer le bloc calendrier</span>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Calendriers à afficher :</label>
            {calendars.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={calendarIds.includes(cal.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...calendarIds, cal.id]
                      : calendarIds.filter((id) => id !== cal.id);
                    updateAttributes({ calendarIds: JSON.stringify(ids) });
                  }}
                  className="rounded"
                />
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cal.color }} />
                {cal.name}
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => setShowConfig(false)}>
              Appliquer
            </Button>
            <Button size="sm" variant="ghost" onClick={deleteNode}>
              Supprimer
            </Button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className={`my-4 ${selected ? "ring-2 ring-primary/50 rounded-lg" : ""}`}>
      <div ref={containerRef} className={`border border-border rounded-lg bg-card overflow-hidden ${fullscreen ? "flex flex-col h-screen bg-background" : ""}`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <CalIcon className="h-4 w-4 text-primary" />
          {showTitle && (
            <span className="text-sm font-medium">
              {calendars.filter((c) => calendarIds.includes(c.id)).map((c) => c.name).join(", ") || "Calendrier"}
            </span>
          )}
          <div className="flex-1" />

          {/* View mode toggle: Mois / Gantt */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 rounded-none px-2 gap-1 text-xs"
              onClick={() => updateAttributes({ viewMode: "month" })}
              title="Vue mois"
            >
              <LayoutGrid className="h-3 w-3" />
              Mois
            </Button>
            <Button
              variant={viewMode === "gantt" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 rounded-none px-2 gap-1 text-xs"
              onClick={() => updateAttributes({ viewMode: "gantt" })}
              title="Vue Gantt"
            >
              <GanttChart className="h-3 w-3" />
              Gantt
            </Button>
          </div>

          {/* Month navigation — visible in month mode only */}
          {viewMode === "month" && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })} title="Mois précédent">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium min-w-[100px] text-center">
                {MONTH_FR[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} title="Mois suivant">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleFullscreen} title={fullscreen ? "Quitter le plein écran" : "Plein écran"}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowConfig(true)} title="Configurer">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={deleteNode} title="Supprimer">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Gantt view */}
        {viewMode === "gantt" ? (
          <div className={fullscreen ? "flex-1" : ""} style={fullscreen ? undefined : { height: blockHeight }}>
            {calendarIds.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Aucun calendrier sélectionné — configurez le bloc pour continuer.
              </div>
            ) : (
              <GanttView
                calendarId={calendarIds[0]}
                height={fullscreen ? undefined : blockHeight}
                embedded
              />
            )}
          </div>
        ) : (
          /* Mini month grid */
          loading ? (
            <div className={`flex items-center justify-center ${fullscreen ? "flex-1" : "py-8"}`}>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={`p-2 ${fullscreen ? "flex-1 flex flex-col justify-center" : ""}`}>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0">
                {DAY_NAMES.map((name, i) => (
                  <div key={i} className="text-center text-[10px] text-muted-foreground py-1">
                    {name}
                  </div>
                ))}
              </div>
              {/* Weeks */}
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0">
                  {week.map((day, di) => {
                    const dayEv = eventsForDay(day);
                    const isMonth = day.getMonth() === currentMonth;

                    return (
                      <div
                        key={di}
                        className={`text-center py-1 text-xs ${
                          isMonth ? "" : "text-muted-foreground/40"
                        }`}
                      >
                        <span
                          className={`inline-block w-6 h-6 leading-6 rounded-full ${
                            isToday(day) ? "bg-primary text-primary-foreground" : ""
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {dayEv.length > 0 && (
                          <div className="flex justify-center gap-0.5 mt-0.5">
                            {dayEv.slice(0, 3).map((ev, i) => (
                              <span
                                key={i}
                                className="w-1 h-1 rounded-full"
                                style={{
                                  backgroundColor: ev.color || calColorMap.get(ev.calendarId) || "#3b82f6",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        )}

        {/* Resize handle */}
        <div
          className="flex items-center justify-center h-4 cursor-ns-resize bg-muted/20 hover:bg-muted/50 transition-colors border-t border-border"
          onMouseDown={handleResizeMouseDown}
          title="Redimensionner"
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground/50" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

