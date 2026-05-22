"use client";

import { useMemo } from "react";
import { Clock, MapPin, Repeat } from "lucide-react";
import type { CalendarEvent, Calendar } from "@/types";

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  onEventClick: (event: CalendarEvent) => void;
}

const WEEKDAY_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function formatDate(date: Date): string {
  return `${WEEKDAY_FR[date.getDay()]} ${date.getDate()} ${MONTH_FR[date.getMonth()]}`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export default function AgendaView({
  currentDate: _currentDate,
  events,
  calendars,
  visibleCalendarIds,
  onEventClick,
}: AgendaViewProps) {
  const calColorMap = new Map(calendars.map((c) => [c.id, c.color]));
  const calNameMap = new Map(calendars.map((c) => [c.id, c.name]));

  const filteredEvents = events.filter((e) => visibleCalendarIds.has(e.calendarId));

  // Group events by day
  const grouped = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const start = new Date(event.startAt);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const list = groups.get(key) || [];
      list.push(event);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, events]) => ({
        date: new Date(events[0].startAt),
        events,
      }));
  }, [filteredEvents]);

  if (filteredEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
        <p className="text-sm">Aucun événement pour cette période</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-6">
      {grouped.map(({ date, events }) => (
        <div key={date.toISOString()}>
          {/* Day header */}
          <div
            className={`text-sm font-semibold mb-2 pb-1 border-b border-border ${
              isToday(date) ? "text-primary" : "text-foreground"
            }`}
          >
            {isToday(date) ? "Aujourd'hui — " : ""}
            {formatDate(date)}
          </div>

          {/* Events */}
          <div className="space-y-2">
            {events.map((event) => {
              const start = new Date(event.startAt);
              const end = new Date(event.endAt);
              const color = event.color || calColorMap.get(event.calendarId) || "#3b82f6";

              return (
                <button
                  key={`${event.id}-${start.toISOString()}`}
                  onClick={() => onEventClick(event)}
                  className="w-full text-left flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* Color bar */}
                  <div
                    className="w-1 rounded-full flex-shrink-0 self-stretch"
                    style={{ backgroundColor: color }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium truncate">{event.title}</h3>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {calNameMap.get(event.calendarId)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {event.allDay
                          ? "Journée entière"
                          : `${formatTime(start)} – ${formatTime(end)}`}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                      {event.recurrenceRule && (
                        <span className="flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          Récurrent
                        </span>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
