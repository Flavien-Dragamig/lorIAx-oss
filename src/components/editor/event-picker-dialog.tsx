"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Calendar as CalIcon,
  Clock,
  Search,
  Plus,
  MapPin,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Calendar } from "@/types";

// ─── Types ───

interface EventResult {
  id: string;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
  color?: string;
}

interface EventPickerResult {
  eventId: string;
  title: string;
  startAt: string;
  color: string;
}

interface EventPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: EventPickerResult) => void;
}

// ─── Helpers ───

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalDatetime(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function addHour(date: Date): Date {
  return new Date(date.getTime() + 60 * 60 * 1000);
}

// ─── Component ───

export default function EventPickerDialog({
  open,
  onClose,
  onSelect,
}: EventPickerDialogProps) {
  const [tab, setTab] = useState<"search" | "create">("search");
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EventResult[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create state
  const [newTitle, setNewTitle] = useState("");
  const [newCalendarId, setNewCalendarId] = useState("");
  const [newStartAt, setNewStartAt] = useState(toLocalDatetime(new Date()));
  const [newEndAt, setNewEndAt] = useState(toLocalDatetime(addHour(new Date())));
  const [newAllDay, setNewAllDay] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch calendars on open
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoadingCalendars(true);
    fetch("/api/calendars", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Calendar[]) => {
        setCalendars(data);
        if (data.length > 0) {
          setSelectedCalendarId(data[0].id);
          setNewCalendarId(data[0].id);
        }
        setLoadingCalendars(false);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadingCalendars(false); });
    return () => controller.abort();
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open && tab === "search") {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open, tab]);

  // Load upcoming events on open (default search)
  useEffect(() => {
    if (!open || loadingCalendars || calendars.length === 0) return;
    loadUpcomingEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingCalendars, calendars]);

  const loadUpcomingEvents = useCallback(async () => {
    if (calendars.length === 0) return;
    setSearching(true);
    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 jours

    try {
      const calIds = selectedCalendarId
        ? [selectedCalendarId]
        : calendars.map((c) => c.id);

      const allEvents: EventResult[] = [];
      for (const calId of calIds) {
        const res = await fetch(
          `/api/calendars/${calId}/events?start=${now.toISOString()}&end=${future.toISOString()}`
        );
        if (res.ok) {
          const events = await res.json();
          allEvents.push(...events);
        }
      }

      // Sort by date, limit to 20
      allEvents.sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
      setSearchResults(allEvents.slice(0, 20));
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, [calendars, selectedCalendarId]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      loadUpcomingEvents();
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchEvents(value.trim());
    }, 300);
  }

  async function searchEvents(query: string) {
    setSearching(true);
    const now = new Date();
    const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    try {
      const calIds = selectedCalendarId
        ? [selectedCalendarId]
        : calendars.map((c) => c.id);

      const allEvents: EventResult[] = [];
      for (const calId of calIds) {
        const res = await fetch(
          `/api/calendars/${calId}/events?start=${past.toISOString()}&end=${future.toISOString()}`
        );
        if (res.ok) {
          const events = await res.json();
          allEvents.push(...events);
        }
      }

      // Filter by title
      const q = query.toLowerCase();
      const filtered = allEvents.filter((e) =>
        e.title.toLowerCase().includes(q)
      );
      filtered.sort(
        (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
      );
      setSearchResults(filtered.slice(0, 20));
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  function selectEvent(event: EventResult) {
    const calendar = calendars.find((c) => c.id === event.calendarId);
    onSelect({
      eventId: event.id,
      title: event.title,
      startAt: event.startAt,
      color: event.color || calendar?.color || "#3b82f6",
    });
    resetAndClose();
  }

  async function createEvent() {
    if (!newTitle.trim() || !newCalendarId) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/calendars/${newCalendarId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          startAt: new Date(newStartAt).toISOString(),
          endAt: new Date(newEndAt).toISOString(),
          allDay: newAllDay,
          location: newLocation || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      const event = await res.json();
      const calendar = calendars.find((c) => c.id === newCalendarId);
      onSelect({
        eventId: event.id,
        title: event.title,
        startAt: event.startAt,
        color: event.color || calendar?.color || "#3b82f6",
      });
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCreating(false);
    }
  }

  function resetAndClose() {
    setSearchQuery("");
    setSearchResults([]);
    setNewTitle("");
    setNewLocation("");
    setNewAllDay(false);
    setError(null);
    setTab("search");
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={resetAndClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <CalIcon className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold">Insérer un événement</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={resetAndClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === "search"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("search")}
          >
            <Search className="h-3.5 w-3.5" />
            Rechercher
          </button>
          <button
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              tab === "create"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("create")}
          >
            <Plus className="h-3.5 w-3.5" />
            Créer
          </button>
        </div>

        {/* Calendar filter (shared) */}
        {calendars.length > 1 && (
          <div className="px-4 pt-3 pb-1">
            <select
              value={tab === "search" ? selectedCalendarId : newCalendarId}
              onChange={(e) => {
                if (tab === "search") {
                  setSelectedCalendarId(e.target.value);
                } else {
                  setNewCalendarId(e.target.value);
                }
              }}
              className="w-full text-xs bg-transparent border border-border rounded px-2 py-1.5"
            >
              {tab === "search" && (
                <option value="">Tous les calendriers</option>
              )}
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                  {cal.type === "personal"
                    ? " (personnel)"
                    : cal.type === "team"
                      ? " (équipe)"
                      : cal.type === "organization"
                        ? " (structure)"
                        : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {loadingCalendars ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tab === "search" ? (
          /* ─── Search Tab ─── */
          <div className="p-4 space-y-3">
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Chercher un événement par titre..."
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Escape") resetAndClose();
              }}
            />

            <div className="max-h-[280px] overflow-y-auto space-y-0.5">
              {searching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {searchQuery
                    ? "Aucun événement trouvé"
                    : "Aucun événement à venir"}
                </p>
              ) : (
                searchResults.map((event) => {
                  const cal = calendars.find((c) => c.id === event.calendarId);
                  const start = new Date(event.startAt);
                  return (
                    <button
                      key={`${event.id}-${event.startAt}`}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-3 group"
                      onClick={() => selectEvent(event)}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{
                          backgroundColor:
                            event.color || cal?.color || "#3b82f6",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {event.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {event.allDay
                            ? formatDate(start)
                            : `${formatDate(start)} ${formatTime(start)}`}
                          {cal && (
                            <span className="ml-1.5 opacity-60">
                              · {cal.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* ─── Create Tab ─── */
          <div className="p-4 space-y-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre de l'événement"
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) createEvent();
                if (e.key === "Escape") resetAndClose();
              }}
            />

            {/* Date/time */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newAllDay}
                    onChange={(e) => setNewAllDay(e.target.checked)}
                    className="rounded"
                  />
                  Journée entière
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type={newAllDay ? "date" : "datetime-local"}
                  value={
                    newAllDay ? newStartAt.slice(0, 10) : newStartAt
                  }
                  onChange={(e) => setNewStartAt(e.target.value)}
                  className="h-7 text-xs"
                />
                <Input
                  type={newAllDay ? "date" : "datetime-local"}
                  value={newAllDay ? newEndAt.slice(0, 10) : newEndAt}
                  onChange={(e) => setNewEndAt(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Lieu (optionnel)"
                className="h-7 text-xs border-0 border-b rounded-none px-0 focus-visible:ring-0"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={resetAndClose}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={createEvent}
                disabled={creating || !newTitle.trim() || !newCalendarId}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Création...
                  </>
                ) : (
                  "Créer et insérer"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
