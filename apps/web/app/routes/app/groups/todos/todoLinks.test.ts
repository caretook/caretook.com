import type { PickableEvent } from "./todoLinks";

import { describe, expect, it } from "vitest";
import { chosenLinkChip, eventWhen } from "./todoLinks";

const ZONE = "America/Los_Angeles";
const WHERE = { locale: "en-US", timeZone: ZONE };
// Thursday, Nov 20 2026, 12:00 in Los Angeles.
const NOW = new Date("2026-11-20T20:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const event = (id: string, offset: number, v: Partial<PickableEvent> = {}): PickableEvent => ({
  id,
  kind: "event",
  title: `Visit ${id}`,
  occurredAt: at(offset),
  timeZone: ZONE,
  endsAt: null,
  allDay: false,
  cancelledAt: null,
  deletedAt: null,
  ...v,
});

describe("eventWhen", () => {
  it("says when, in the device's zone, an all-day one by its own day", () => {
    expect(eventWhen(event("a", DAY, { occurredAt: "2026-11-21T18:30:00.000Z" }), NOW, WHERE)).toBe(
      "Tomorrow 10:30 AM",
    );
    expect(
      eventWhen(event("b", 3 * DAY, { allDay: true, occurredAt: "2026-11-23T08:00:00.000Z" }), NOW, WHERE),
    ).toBe("Monday, Nov 23 · All day");
    expect(eventWhen(event("c", DAY, { endsAt: at(DAY + HOUR) }), NOW, WHERE)).toBe(
      "Tomorrow 12:00 PM–1:00 PM",
    );
  });
});

describe("chosenLinkChip", () => {
  it("names the link, greyed when removed or cancelled, or a fallback while it isn't on the device", () => {
    expect(chosenLinkChip({ label: "Dr. Lark" }, "Chosen provider")).toEqual({
      label: "Dr. Lark",
      muted: false,
    });
    expect(chosenLinkChip({ label: "Dr. Lark", deleted: true }, "x")).toEqual({
      label: "Dr. Lark (removed)",
      muted: true,
    });
    expect(chosenLinkChip({ label: "Eye doctor", cancelled: true }, "x").label).toBe(
      "Eye doctor (cancelled)",
    );
    expect(chosenLinkChip(null, "Chosen event")).toEqual({ label: "Chosen event", muted: true });
  });
});
