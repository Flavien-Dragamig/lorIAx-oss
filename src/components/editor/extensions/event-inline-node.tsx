"use client";

import { useState, useEffect, useCallback } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { Calendar as CalIcon, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import type { Calendar, CalendarEvent } from "@/types";

const EventFormDialog = dynamic(
  () => import("@/components/calendar/event-form-dialog"),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// EventInlineView
// ---------------------------------------------------------------------------

function formatShortDate(date: Date): string {
  const d = new Date(date);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatTime(date: Date): string {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function EventInlineView({
  node,
  updateAttributes,
}: Pick<NodeViewProps, "node" | "updateAttributes">) {
  const { eventId, title, startAt, color } = node.attrs;
  const [showTooltip, setShowTooltip] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [fullEvent, setFullEvent] = useState<CalendarEvent | null>(null);
  const [eventData, setEventData] = useState<{
    title: string;
    location?: string;
    startAt: string;
    endAt: string;
    allDay: boolean;
  } | null>(null);

  const displayDate = startAt ? formatShortDate(new Date(startAt)) : "";
  const displayColor = color || "#3b82f6";

  // Fetch event details on hover
  useEffect(() => {
    if (!showTooltip || !eventId || eventData) return;
    const controller = new AbortController();
    fetch(`/api/events/${eventId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setEventData(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [showTooltip, eventId, eventData]);

  // Open edit dialog on double-click
  const handleDoubleClick = useCallback(async () => {
    if (!eventId) return;
    setShowTooltip(false);

    // Fetch full event data + calendars in parallel
    const [eventRes, calRes] = await Promise.all([
      fetch(`/api/events/${eventId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/calendars").then((r) => (r.ok ? r.json() : [])),
    ]);

    if (eventRes) {
      setFullEvent(eventRes);
      setCalendars(calRes);
      setShowEditDialog(true);
    }
  }, [eventId]);

  // Save event updates
  const handleSave = useCallback(
    async (data: {
      calendarId: string;
      title: string;
      description: string;
      location: string;
      startAt: string;
      endAt: string;
      allDay: boolean;
      recurrenceRule: string;
      visibility: string;
      status: string;
      color: string;
    }) => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          location: data.location,
          startAt: new Date(data.startAt).toISOString(),
          endAt: new Date(data.endAt).toISOString(),
          allDay: data.allDay,
          recurrenceRule: data.recurrenceRule || null,
          visibility: data.visibility,
          status: data.status,
          color: data.color || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }

      const updated = await res.json();

      // Update inline node attributes to reflect changes
      updateAttributes({
        title: updated.title,
        startAt: updated.startAt,
        color: updated.color || color,
      });

      // Reset cached data so tooltip refetches
      setEventData(null);
      setFullEvent(null);
    },
    [eventId, color, updateAttributes]
  );

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity relative"
        style={{
          backgroundColor: displayColor + "15",
          color: displayColor,
          border: `1px solid ${displayColor}30`,
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onDoubleClick={handleDoubleClick}
      >
        <CalIcon className="h-3 w-3" />
        <span>{title || "Événement"}</span>
        {displayDate && (
          <span className="opacity-60 text-[10px]">{displayDate}</span>
        )}

        {/* Tooltip */}
        {showTooltip && !showEditDialog && eventData && (
          <span className="absolute bottom-full left-0 mb-1 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 min-w-[200px] text-left">
            <span className="block text-sm font-semibold text-foreground mb-1">
              {eventData.title}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {eventData.allDay
                ? `${formatShortDate(new Date(eventData.startAt))} — Journée entière`
                : `${formatShortDate(new Date(eventData.startAt))} ${formatTime(new Date(eventData.startAt))} – ${formatTime(new Date(eventData.endAt))}`}
            </span>
            {eventData.location && (
              <span className="block text-xs text-muted-foreground mt-1">
                📍 {eventData.location}
              </span>
            )}
          </span>
        )}
      </span>

      {/* Edit dialog */}
      {showEditDialog && fullEvent && (
        <EventFormDialog
          open
          onClose={() => setShowEditDialog(false)}
          onSave={handleSave}
          calendars={calendars}
          event={fullEvent}
        />
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// TipTap Extension
// ---------------------------------------------------------------------------

export const EventInlineNode = Node.create({
  name: "eventInline",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      eventId: { default: "" },
      title: { default: "" },
      startAt: { default: "" },
      color: { default: "#3b82f6" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="event-inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "event-inline" }),
      `📅 ${HTMLAttributes.title || "Événement"}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EventInlineView);
  },
});
