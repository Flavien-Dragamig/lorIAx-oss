"use client";

import type { CalendarEvent, Calendar } from "@/types";

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

const WEEKDAY_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTH_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default function DayView({
  currentDate,
  events,
  calendars,
  visibleCalendarIds,
  onEventClick,
  onDateClick,
}: DayViewProps) {
  const calColorMap = new Map(calendars.map((c) => [c.id, c.color]));

  const dayEvents = events.filter((e) => {
    if (!visibleCalendarIds.has(e.calendarId)) return false;
    const start = new Date(e.startAt);
    return isSameDay(start, currentDate);
  });

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  return (
    <div className="flex flex-col flex-1 overflow-hidden overflow-x-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold capitalize">
          {WEEKDAY_FR[currentDate.getDay()]} {currentDate.getDate()} {MONTH_FR[currentDate.getMonth()]}
        </h2>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/30 space-y-1">
          <span className="text-xs text-muted-foreground">Journée entière</span>
          {allDayEvents.map((event) => {
            const color = event.color || calColorMap.get(event.calendarId) || "#3b82f6";
            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="block w-full text-left text-sm px-2 py-1 rounded hover:opacity-80"
                style={{
                  backgroundColor: color + "20",
                  borderLeft: `3px solid ${color}`,
                  color,
                }}
              >
                {event.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Hourly grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {HOURS.map((hour) => {
            const hourEvents = timedEvents.filter((e) => new Date(e.startAt).getHours() === hour);

            return (
              <div
                key={hour}
                className="flex h-12 md:h-14 border-b border-border cursor-pointer hover:bg-accent/20"
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setHours(hour, 0, 0, 0);
                  onDateClick(d);
                }}
              >
                <div className="w-16 text-right pr-3 text-xs text-muted-foreground -mt-1.5 flex-shrink-0">
                  {formatHour(hour)}
                </div>
                <div className="flex-1 border-l border-border relative">
                  {hourEvents.map((event) => {
                    const start = new Date(event.startAt);
                    const end = new Date(event.endAt);
                    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
                    const topOffset = (start.getMinutes() / 60) * 56;
                    const height = Math.max(24, (durationMinutes / 60) * 56);
                    const color = event.color || calColorMap.get(event.calendarId) || "#3b82f6";

                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="absolute left-1 right-1 rounded px-2 py-1 z-10 hover:opacity-80"
                        style={{
                          top: `${topOffset}px`,
                          height: `${height}px`,
                          backgroundColor: color + "20",
                          borderLeft: `3px solid ${color}`,
                          color,
                        }}
                      >
                        <div className="text-sm font-medium truncate">{event.title}</div>
                        <div className="text-xs opacity-70">
                          {formatTime(start)} – {formatTime(end)}
                        </div>
                        {event.location && (
                          <div className="text-xs opacity-60 truncate">{event.location}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
