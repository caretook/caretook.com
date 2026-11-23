import type { calendar_v3 } from "@googleapis/calendar";

import { describe, expect, it } from "vitest";
import { fromGoogle } from "./real";

// The real client's reading of Google's event (calendars-2): a typed fixture
// of the API's own shape, so a renamed field fails the typecheck. Made up.

const event: calendar_v3.Schema$Event = {
  id: "gevt1",
  etag: '"etag-1"',
  status: "confirmed",
  summary: "Eye exam",
  start: { dateTime: "2027-06-01T17:00:00Z", timeZone: "America/Los_Angeles" },
  end: { dateTime: "2027-06-01T18:00:00Z", timeZone: "America/Los_Angeles" },
  updated: "2026-11-18T17:59:00.000Z",
};

describe("fromGoogle", () => {
  it("reads an event with no recurring event id as a one-off", () => {
    expect(fromGoogle(event).recurring).toBe(false);
    expect(fromGoogle({ ...event, recurringEventId: null }).recurring).toBe(false);
  });

  it("reads an event with Google's recurring event id as an instance of a repeat", () => {
    const instance = { ...event, id: "gevt1_20270601T170000Z", recurringEventId: "gevt1" };
    expect(fromGoogle(instance)).toMatchObject({ id: "gevt1_20270601T170000Z", recurring: true });
  });
});
