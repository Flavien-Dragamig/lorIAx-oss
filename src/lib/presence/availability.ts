export interface CalendarEvent {
  startAt: Date;
  endAt: Date;
  allDay: boolean;
}

export interface DayAvailability {
  date: string; // 'YYYY-MM-DD'
  morning: "free" | "busy" | "absent"; // 08h–12h
  afternoon: "free" | "busy" | "absent"; // 12h–18h
  evening: "free" | "busy" | "absent"; // 18h–22h
}

function isWeekend(day: Date): boolean {
  const dow = day.getUTCDay();
  return dow === 0 || dow === 6;
}

function hasAllDayEvent(day: Date, events: CalendarEvent[]): boolean {
  const dayStr = day.toISOString().slice(0, 10);
  return events.some((e) => {
    if (!e.allDay) return false;
    const startStr = e.startAt.toISOString().slice(0, 10);
    const endStr = e.endAt.toISOString().slice(0, 10);
    return startStr <= dayStr && dayStr <= endStr;
  });
}

function hasOverlappingEvent(
  day: Date,
  slotStartHour: number,
  slotEndHour: number,
  events: CalendarEvent[]
): boolean {
  const slotStart = new Date(day);
  slotStart.setUTCHours(slotStartHour, 0, 0, 0);
  const slotEnd = new Date(day);
  slotEnd.setUTCHours(slotEndHour, 0, 0, 0);

  return events.some(
    (e) => !e.allDay && e.startAt < slotEnd && e.endAt > slotStart
  );
}

export function computeSlotStatus(
  day: Date,
  slotStartHour: number,
  slotEndHour: number,
  events: CalendarEvent[]
): "free" | "busy" | "absent" {
  if (isWeekend(day)) return "absent";
  if (hasAllDayEvent(day, events)) return "absent";
  if (hasOverlappingEvent(day, slotStartHour, slotEndHour, events))
    return "busy";
  return "free";
}

export function computeDayAvailability(
  day: Date,
  events: CalendarEvent[]
): DayAvailability {
  return {
    date: day.toISOString().slice(0, 10),
    morning: computeSlotStatus(day, 8, 12, events),
    afternoon: computeSlotStatus(day, 12, 18, events),
    evening: computeSlotStatus(day, 18, 22, events),
  };
}
