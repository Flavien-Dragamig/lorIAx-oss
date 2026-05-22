"use client";

import { DoorOpen } from "lucide-react";
import type { CalendarEvent, Calendar } from "@/types";

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendars: Calendar[];
  visibleCalendarIds: Set<string>;
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export default function WeekView({
  currentDate,
  events,
  calendars,
  visibleCalendarIds,
  onEventClick,
  onDateClick,
}: WeekViewProps) {
  const weekStart = getWeekStart(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const calColorMap = new Map(calendars.map((c) => [c.id, c.color]));

  const getEventsForDay = (day: Date) => {
    return events.filter((e) => {
      if (!visibleCalendarIds.has(e.calendarId)) return false;
      const start = new Date(e.startAt);
      return isSameDay(start, day);
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
        <div /> {/* Time column spacer */}
        {days.map((day, i) => (
          <div
            key={i}
            className={`text-center py-2 border-l border-border ${isToday(day) ? "bg-primary/5" : ""}`}
          >
            <div className="text-xs text-muted-foreground">{DAY_NAMES[i]}</div>
            <div
              className={`text-sm font-medium w-7 h-7 mx-auto flex items-center justify-center rounded-full ${
                isToday(day) ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              {/* Time label */}
              <div className="h-12 flex items-start justify-end pr-2 text-[10px] text-muted-foreground -mt-1.5">
                {formatHour(hour)}
              </div>
              {/* Day cells */}
              {days.map((day, di) => {
                const dayEvents = getEventsForDay(day);
                const hourEvents = dayEvents.filter((e) => {
                  const start = new Date(e.startAt);
                  return start.getHours() === hour;
                });

                return (
                  <div
                    key={di}
                    className="h-12 border-l border-t border-border relative cursor-pointer hover:bg-accent/20"
                    onClick={() => {
                      const clickDate = new Date(day);
                      clickDate.setHours(hour);
                      onDateClick(clickDate);
                    }}
                  >
                    {hourEvents.map((event) => {
                      const start = new Date(event.startAt);
                      const end = new Date(event.endAt);
                      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
                      const topOffset = (start.getMinutes() / 60) * 48;
                      const height = Math.max(20, (durationMinutes / 60) * 48);
                      const color = event.color || calColorMap.get(event.calendarId) || "#3b82f6";

                      return (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className="absolute left-0.5 right-0.5 rounded text-[10px] leading-tight px-1 py-0.5 overflow-hidden z-10 hover:opacity-80"
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            backgroundColor: color + "20",
                            borderLeft: `2px solid ${color}`,
                            color,
                          }}
                        >
                          <div className="font-medium truncate flex items-center gap-1">
                            {event.meetingRoomId && (
                              <DoorOpen className="h-2.5 w-2.5 shrink-0" aria-label="Salle de réunion" />
                            )}
                            <span className="truncate">{event.title}</span>
                          </div>
                          <div className="opacity-70">{formatTime(start)}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
