import { RRule, rrulestr } from "rrule";

export interface ExpandedEvent {
  originalId: string;
  startAt: Date;
  endAt: Date;
  isRecurrenceInstance: boolean;
  recurrenceIndex: number;
}

/**
 * Expand a recurring event into individual occurrences within a date range.
 * Returns the original dates for each occurrence, preserving the event duration.
 */
export function expandRecurrence(
  rruleString: string,
  eventStart: Date,
  eventEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: string[] = [],
  eventId: string
): ExpandedEvent[] {
  const duration = eventEnd.getTime() - eventStart.getTime();

  let rule: RRule;
  try {
    // If it's a full RRULE string (with RRULE: prefix), parse it
    if (rruleString.startsWith("RRULE:") || rruleString.includes("\n")) {
      rule = rrulestr(rruleString) as RRule;
    } else {
      // Plain RRULE content (e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR")
      rule = rrulestr(`RRULE:${rruleString}`, { dtstart: eventStart }) as RRule;
    }
  } catch {
    // If parsing fails, return the original event as-is
    return [{
      originalId: eventId,
      startAt: eventStart,
      endAt: eventEnd,
      isRecurrenceInstance: false,
      recurrenceIndex: 0,
    }];
  }

  const exceptionSet = new Set(
    exceptions.map((d) => new Date(d).toISOString().split("T")[0])
  );

  const occurrences = rule.between(rangeStart, rangeEnd, true);

  return occurrences
    .filter((date) => {
      const dateStr = date.toISOString().split("T")[0];
      return !exceptionSet.has(dateStr);
    })
    .map((date, index) => ({
      originalId: eventId,
      startAt: date,
      endAt: new Date(date.getTime() + duration),
      isRecurrenceInstance: true,
      recurrenceIndex: index,
    }));
}

/**
 * Generate a human-readable description of a recurrence rule (in French).
 */
export function describeRecurrence(rruleString: string): string {
  try {
    const prefixed = rruleString.startsWith("RRULE:") ? rruleString : `RRULE:${rruleString}`;
    const rule = rrulestr(prefixed) as RRule;
    return rule.toText();
  } catch {
    return rruleString;
  }
}

/**
 * Validate an RRULE string.
 */
export function isValidRRule(rruleString: string): boolean {
  try {
    const prefixed = rruleString.startsWith("RRULE:") ? rruleString : `RRULE:${rruleString}`;
    rrulestr(prefixed);
    return true;
  } catch {
    return false;
  }
}
