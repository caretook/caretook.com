import type { PickableEvent, PickableMedication, PickableProvider } from "./taskLinks";

import { describe, expect, it } from "vitest";
import {
  chosenLinkChip,
  eventLinkOptions,
  eventWhen,
  LINK_PICKER_LIMIT,
  medicationLinkOptions,
  providerLinkOptions,
} from "./taskLinks";

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

describe("eventLinkOptions (the appointment picker)", () => {
  it("lists upcoming events soonest first, then the last 30 days' latest first", () => {
    const events = [
      event("past-2d", -2 * DAY),
      event("in-5d", 5 * DAY),
      event("past-29d", -29 * DAY),
      event("in-1h", HOUR),
      event("past-31d", -31 * DAY),
      event("past-1h", -HOUR),
      event("in-40d", 40 * DAY),
    ];
    expect(eventLinkOptions(events, "", NOW, WHERE).map((o) => o.id)).toEqual([
      "in-1h",
      "in-5d",
      "in-40d",
      "past-1h",
      "past-2d",
      "past-29d",
    ]);
  });

  it("counts one in progress and an all-day one today as upcoming", () => {
    const events = [
      event("tomorrow", DAY),
      event("now", -HOUR, { endsAt: at(HOUR) }),
      // Today in Los Angeles (all day: the start of the day there).
      event("today", -12 * HOUR, { allDay: true, occurredAt: "2026-11-20T08:00:00.000Z" }),
    ];
    expect(eventLinkOptions(events, "", NOW, WHERE).map((o) => o.id)).toEqual(["today", "now", "tomorrow"]);
  });

  it("leaves out cancelled, deleted and non-event entries, and matches every typed word of the title", () => {
    const events = [
      event("cancelled", DAY, { cancelledAt: at(-DAY) }),
      event("deleted", DAY, { deletedAt: at(-HOUR) }),
      event("note", DAY, { kind: "note" }),
      event("cardio", 2 * DAY, { title: "Cardiology follow-up: Dr. Patel" }),
      event("eye", 3 * DAY, { title: "Eye doctor" }),
    ];
    expect(eventLinkOptions(events, "", NOW, WHERE).map((o) => o.id)).toEqual(["cardio", "eye"]);
    expect(eventLinkOptions(events, "patel cardio", NOW, WHERE).map((o) => o.id)).toEqual(["cardio"]);
    expect(eventLinkOptions(events, "dentist", NOW, WHERE)).toEqual([]);
  });

  it("says what and when, an untitled one as an appointment", () => {
    const [first, second] = eventLinkOptions(
      [
        event("a", DAY, { title: null, occurredAt: "2026-11-21T18:30:00.000Z" }),
        event("b", 3 * DAY, {
          title: "Hospice intake",
          allDay: true,
          occurredAt: "2026-11-23T08:00:00.000Z",
        }),
      ],
      "",
      NOW,
      WHERE,
    );
    expect(first).toEqual({ id: "a", label: "Appointment", description: "Tomorrow 10:30 AM" });
    expect(second).toMatchObject({ label: "Hospice intake", description: "Monday, Nov 23 · All day" });
    expect(eventWhen(event("c", DAY, { endsAt: at(DAY + HOUR) }), NOW, WHERE)).toBe(
      "Tomorrow 12:00 PM–1:00 PM",
    );
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: LINK_PICKER_LIMIT + 5 }, (_, i) => event(`e${i}`, (i + 1) * HOUR));
    expect(eventLinkOptions(many, "", NOW, WHERE)).toHaveLength(LINK_PICKER_LIMIT);
  });
});

const provider = (id: string, v: Partial<PickableProvider> = {}): PickableProvider => ({
  id,
  type: "clinician",
  name: id,
  specialty: null,
  practiceId: null,
  status: "current",
  isPrimary: false,
  deletedAt: null,
  ...v,
});

describe("providerLinkOptions", () => {
  it("offers every live type in display order, matched by name, specialty or practice", () => {
    const providers = [
      provider("Westside Family Medicine", { type: "practice" }),
      provider("Dr. Alvarez", { practiceId: "Westside Family Medicine", specialty: "Primary care" }),
      provider("Cornerstone Pharmacy", { type: "pharmacy" }),
      provider("Dr. Old", { status: "past" }),
      provider("Dr. Gone", { deletedAt: "2026-11-01T00:00:00.000Z" }),
      provider("Dr. Patel", { isPrimary: true, specialty: "Cardiology" }),
    ];
    expect(providerLinkOptions(providers, "").map((o) => o.id)).toEqual([
      "Dr. Patel",
      "Cornerstone Pharmacy",
      "Dr. Alvarez",
      "Westside Family Medicine",
      "Dr. Old",
    ]);
    expect(providerLinkOptions(providers, "westside")).toEqual([
      {
        id: "Dr. Alvarez",
        label: "Dr. Alvarez",
        description: "Primary care · Westside Family Medicine",
      },
      { id: "Westside Family Medicine", label: "Westside Family Medicine", description: "Practice" },
    ]);
    expect(providerLinkOptions(providers, "old")[0]?.description).toBe("Clinician · Past");
  });
});

const medication = (id: string, v: Partial<PickableMedication> = {}): PickableMedication => ({
  id,
  name: id,
  strength: null,
  status: "current",
  deletedAt: null,
  ...v,
});

describe("medicationLinkOptions", () => {
  it("offers current, live medications by name, with their strength", () => {
    const medications = [
      medication("metformin", { name: "Metformin", strength: "500 mg" }),
      medication("amox", { name: "Amoxicillin", status: "completed" }),
      medication("gone", { name: "Aspirin", deletedAt: "2026-11-01T00:00:00.000Z" }),
      medication("lat", { name: "latanoprost" }),
    ];
    expect(medicationLinkOptions(medications, "")).toEqual([
      { id: "lat", label: "latanoprost" },
      { id: "metformin", label: "Metformin 500 mg" },
    ]);
    expect(medicationLinkOptions(medications, "500").map((o) => o.id)).toEqual(["metformin"]);
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
    expect(chosenLinkChip(null, "Chosen appointment")).toEqual({ label: "Chosen appointment", muted: true });
  });
});
