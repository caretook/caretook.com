import type { CalendarSettings } from "../../../../../lib/calendars/calendarSettings";

import { describe, expect, it } from "vitest";
import { DETAILS_FORBIDDEN, detailsCardState, detailsExplained } from "./calendarPage";

const settings = (v: Partial<CalendarSettings> = {}): CalendarSettings => ({
  groupId: "g1",
  role: "viewer",
  remindersOn: false,
  reminderLeads: ["eveningBefore", 60],
  detailsConsent: false,
  detailsConsentAt: null,
  detailsConsentVersion: null,
  groupAllowsDetails: true,
  shareLevel: "generic",
  feed: { active: false, rotatedAt: null },
  ...v,
});

describe("detailsCardState", () => {
  it("has no switch until the settings are known", () => {
    expect(detailsCardState({ settings: null, allowed: true })).toEqual({ kind: "unknown" });
  });

  it("shows the member's consent while the owners allow details", () => {
    expect(detailsCardState({ settings: settings({ detailsConsent: true }), allowed: true })).toEqual({
      kind: "switch",
      on: true,
      disabled: false,
      note: null,
    });
  });

  it("is off and disabled, with the note, while the owners keep details private", () => {
    expect(detailsCardState({ settings: settings({ detailsConsent: true }), allowed: false })).toEqual({
      kind: "switch",
      on: false,
      disabled: true,
      note: DETAILS_FORBIDDEN,
    });
  });

  it("takes the device's copy of the owners' switch over the server's, and the server's until it syncs", () => {
    const forbidden = settings({ groupAllowsDetails: false });
    expect(detailsCardState({ settings: forbidden, allowed: true }).disabled).toBe(false);
    expect(detailsCardState({ settings: forbidden, allowed: null }).disabled).toBe(true);
  });
});

describe("detailsExplained", () => {
  it("names the recipient in the generic wording", () => {
    expect(detailsExplained("Pat")).toBe(
      'Emails, your calendar feed and Google Calendar say only "Appointment for Pat", the time and a link back to Caretook.',
    );
  });
});
