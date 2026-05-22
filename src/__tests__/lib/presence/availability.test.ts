import { describe, it, expect } from "vitest";
import {
  computeSlotStatus,
  computeDayAvailability,
  type CalendarEvent,
  type DayAvailability,
} from "@/lib/presence/availability";

const makeEvent = (
  startAt: Date,
  endAt: Date,
  allDay = false
): CalendarEvent => ({ startAt, endAt, allDay });

describe("computeSlotStatus", () => {
  const day = new Date("2026-05-08T00:00:00Z");

  it("retourne 'absent' si le jour est un samedi", () => {
    const saturday = new Date("2026-05-09T00:00:00Z"); // samedi
    expect(computeSlotStatus(saturday, 8, 12, [])).toBe("absent");
  });

  it("retourne 'absent' si le jour est un dimanche", () => {
    const sunday = new Date("2026-05-10T00:00:00Z"); // dimanche
    expect(computeSlotStatus(sunday, 8, 12, [])).toBe("absent");
  });

  it("retourne 'absent' si un événement all-day couvre le jour", () => {
    const allDay = makeEvent(
      new Date("2026-05-08T00:00:00Z"),
      new Date("2026-05-08T23:59:59Z"),
      true
    );
    expect(computeSlotStatus(day, 8, 12, [allDay])).toBe("absent");
  });

  it("retourne 'busy' si un événement non-all-day chevauche le slot", () => {
    const event = makeEvent(
      new Date("2026-05-08T09:00:00Z"),
      new Date("2026-05-08T10:30:00Z")
    );
    expect(computeSlotStatus(day, 8, 12, [event])).toBe("busy");
  });

  it("retourne 'free' si aucun événement ne chevauche", () => {
    const event = makeEvent(
      new Date("2026-05-08T13:00:00Z"),
      new Date("2026-05-08T14:00:00Z")
    );
    expect(computeSlotStatus(day, 8, 12, [event])).toBe("free");
  });
});

describe("computeDayAvailability", () => {
  it("retourne morning/afternoon/evening pour un jour ouvré sans événements", () => {
    const friday = new Date("2026-05-08T00:00:00Z"); // vendredi
    const result = computeDayAvailability(friday, []);
    expect(result).toEqual<DayAvailability>({
      date: "2026-05-08",
      morning: "free",
      afternoon: "free",
      evening: "free",
    });
  });
});
