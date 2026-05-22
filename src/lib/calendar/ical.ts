import type { CalendarEvent, CalendarEventAttendee } from "@/types";

/**
 * Generate an iCalendar VCALENDAR string for a list of events.
 */
export function generateICalendar(
  calendarName: string,
  events: Array<CalendarEvent & { attendees?: CalendarEventAttendee[] }>
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LorIAx//Calendar//FR",
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(...generateVEvent(event));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function generateVEvent(
  event: CalendarEvent & { attendees?: CalendarEventAttendee[] }
): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];

  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
  lines.push(`SEQUENCE:${event.sequence}`);
  lines.push(`SUMMARY:${escapeICalText(event.title)}`);

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDateOnly(event.startAt)}`);
    lines.push(`DTEND;VALUE=DATE:${formatICalDateOnly(event.endAt)}`);
  } else {
    lines.push(`DTSTART:${formatICalDate(event.startAt)}`);
    lines.push(`DTEND:${formatICalDate(event.endAt)}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  if (event.recurrenceRule) {
    const rule = event.recurrenceRule.startsWith("RRULE:")
      ? event.recurrenceRule
      : `RRULE:${event.recurrenceRule}`;
    lines.push(rule);
  }

  const exceptions = event.recurrenceExceptions as string[] | null;
  if (exceptions && exceptions.length > 0) {
    lines.push(`EXDATE:${exceptions.map((d) => formatICalDate(new Date(d))).join(",")}`);
  }

  lines.push(`STATUS:${event.status.toUpperCase()}`);

  if (event.visibility === "private") {
    lines.push("CLASS:PRIVATE");
  } else if (event.visibility === "confidential") {
    lines.push("CLASS:CONFIDENTIAL");
  } else {
    lines.push("CLASS:PUBLIC");
  }

  if (event.progress > 0) {
    lines.push(`PERCENT-COMPLETE:${event.progress}`);
  }

  if (event.attendees) {
    for (const attendee of event.attendees) {
      const email = attendee.email || "unknown@loriax";
      const parts = [`ATTENDEE;ROLE=${attendeeRoleToICal(attendee.role)}`];
      parts.push(`PARTSTAT=${attendeeStatusToICal(attendee.status)}`);
      if (attendee.displayName) {
        parts.push(`CN=${escapeICalText(attendee.displayName)}`);
      }
      lines.push(`${parts.join(";")}:mailto:${email}`);
    }
  }

  lines.push(`CREATED:${formatICalDate(event.createdAt)}`);
  lines.push(`LAST-MODIFIED:${formatICalDate(event.updatedAt)}`);
  lines.push("END:VEVENT");

  return lines;
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatICalDateOnly(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function attendeeRoleToICal(role: string): string {
  switch (role) {
    case "organizer": return "CHAIR";
    case "required": return "REQ-PARTICIPANT";
    case "optional": return "OPT-PARTICIPANT";
    default: return "REQ-PARTICIPANT";
  }
}

function attendeeStatusToICal(status: string): string {
  switch (status) {
    case "accepted": return "ACCEPTED";
    case "declined": return "DECLINED";
    case "tentative": return "TENTATIVE";
    default: return "NEEDS-ACTION";
  }
}

/**
 * Parse a basic iCalendar file and extract events.
 * Returns an array of event data suitable for database insertion.
 */
export function parseICalendar(icsContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines = unfoldLines(icsContent);

  let inEvent = false;
  let currentEvent: Partial<ParsedEvent> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;
      if (currentEvent.uid && currentEvent.title && currentEvent.startAt) {
        events.push(currentEvent as ParsedEvent);
      }
      continue;
    }

    if (!inEvent) continue;

    const { name, params, value } = parseLine(line);

    switch (name) {
      case "UID":
        currentEvent.uid = value;
        break;
      case "SUMMARY":
        currentEvent.title = unescapeICalText(value);
        break;
      case "DESCRIPTION":
        currentEvent.description = unescapeICalText(value);
        break;
      case "LOCATION":
        currentEvent.location = unescapeICalText(value);
        break;
      case "DTSTART":
        currentEvent.startAt = parseICalDateTime(value, params);
        currentEvent.allDay = params.includes("VALUE=DATE");
        break;
      case "DTEND":
        currentEvent.endAt = parseICalDateTime(value, params);
        break;
      case "RRULE":
        currentEvent.recurrenceRule = value;
        break;
      case "EXDATE":
        currentEvent.recurrenceExceptions = value
          .split(",")
          .map((d) => parseICalDateTime(d.trim(), "").toISOString());
        break;
      case "STATUS":
        currentEvent.status = value.toLowerCase() as "confirmed" | "tentative" | "cancelled";
        break;
      case "SEQUENCE":
        currentEvent.sequence = parseInt(value, 10) || 0;
        break;
      case "PERCENT-COMPLETE":
        currentEvent.progress = parseInt(value, 10) || 0;
        break;
      case "CLASS":
        if (value === "PRIVATE") currentEvent.visibility = "private";
        else if (value === "CONFIDENTIAL") currentEvent.visibility = "confidential";
        else currentEvent.visibility = "public";
        break;
    }
  }

  return events;
}

export interface ParsedEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startAt: Date;
  endAt?: Date;
  allDay: boolean;
  recurrenceRule?: string;
  recurrenceExceptions?: string[];
  status?: "confirmed" | "tentative" | "cancelled";
  visibility?: "public" | "private" | "confidential";
  sequence?: number;
  progress?: number;
}

function unfoldLines(ics: string): string[] {
  // RFC 5545: long lines are folded by inserting CRLF + space/tab
  return ics
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseLine(line: string): { name: string; params: string; value: string } {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return { name: line, params: "", value: "" };

  const beforeColon = line.substring(0, colonIndex);
  const value = line.substring(colonIndex + 1);

  const semiIndex = beforeColon.indexOf(";");
  if (semiIndex === -1) {
    return { name: beforeColon, params: "", value };
  }

  return {
    name: beforeColon.substring(0, semiIndex),
    params: beforeColon.substring(semiIndex + 1),
    value,
  };
}

function parseICalDateTime(value: string, params: string): Date {
  // Date only: 20260316
  if (value.length === 8 || params.includes("VALUE=DATE")) {
    const year = parseInt(value.substring(0, 4));
    const month = parseInt(value.substring(4, 6)) - 1;
    const day = parseInt(value.substring(6, 8));
    return new Date(Date.UTC(year, month, day));
  }

  // DateTime: 20260316T140000Z or 20260316T140000
  const year = parseInt(value.substring(0, 4));
  const month = parseInt(value.substring(4, 6)) - 1;
  const day = parseInt(value.substring(6, 8));
  const hour = parseInt(value.substring(9, 11));
  const minute = parseInt(value.substring(11, 13));
  const second = parseInt(value.substring(13, 15));

  if (value.endsWith("Z")) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  return new Date(year, month, day, hour, minute, second);
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
