"use client";

import { useState, useEffect, useCallback } from "react";
import type { Calendar, CalendarEvent } from "@/types";

export function useCalendars() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalendars = useCallback(async () => {
    try {
      const res = await fetch("/api/calendars");
      if (res.ok) setCalendars(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  return { calendars, loading, refetch: fetchCalendars };
}

export function useCalendarEvents(
  calendarIds: string[],
  start: Date,
  end: Date
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (calendarIds.length === 0) {
      setEvents([]);
      return;
    }

    setLoading(true);
    try {
      const allEvents: CalendarEvent[] = [];
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      await Promise.all(
        calendarIds.map(async (calId) => {
          const res = await fetch(
            `/api/calendars/${calId}/events?start=${startISO}&end=${endISO}`
          );
          if (res.ok) {
            const data = await res.json();
            allEvents.push(
              ...data.map((e: CalendarEvent) => ({
                ...e,
                startAt: new Date(e.startAt),
                endAt: new Date(e.endAt),
                createdAt: new Date(e.createdAt),
                updatedAt: new Date(e.updatedAt),
              }))
            );
          }
        })
      );

      allEvents.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
      setEvents(allEvents);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [calendarIds.join(","), start.toISOString(), end.toISOString()]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
