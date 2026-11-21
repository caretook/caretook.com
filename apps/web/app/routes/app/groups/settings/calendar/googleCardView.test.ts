import { describe, expect, it } from "vitest";
import { GOOGLE_ERROR_TEXT, googleCardView, googleConnectHref, showsGoogleCard } from "./googleCardView";

// The Google Calendar card's pure parts (appointments-2 slice 7).

const connected = {
  connected: true as const,
  configured: true,
  calendarName: "Caretook: Grandma June",
  lastPushedAt: "2026-11-18T17:05:00.000Z",
  lastPulledAt: null,
  error: null,
};

describe("showsGoogleCard", () => {
  it("is on the web target only: Connect needs web-only routes", () => {
    expect(showsGoogleCard("web")).toBe(true);
    expect(showsGoogleCard("native")).toBe(false);
  });
});

describe("googleConnectHref", () => {
  it("goes to the web-only Connect route for the group", () => {
    expect(googleConnectHref("g1")).toBe("/api/google/connect?groupId=g1");
  });
});

describe("googleCardView", () => {
  const view = (v: Partial<Parameters<typeof googleCardView>[0]>) =>
    googleCardView({ online: true, status: null, failed: false, timeZone: "America/Los_Angeles", ...v });

  it("needs a connection, then waits for the status", () => {
    expect(view({ online: false, status: connected })).toEqual({ kind: "offline" });
    expect(view({})).toEqual({ kind: "loading" });
    expect(view({ failed: true })).toEqual({ kind: "failed" });
  });

  it("offers Connect, unless Google isn't set up here", () => {
    expect(view({ status: { connected: false, configured: true } })).toEqual({ kind: "connect" });
    expect(view({ status: { connected: false, configured: false } })).toEqual({ kind: "unavailable" });
  });

  it("shows the calendar and when it last synced, in the viewer's zone", () => {
    expect(view({ status: connected })).toEqual({
      kind: "connected",
      calendarName: "Caretook: Grandma June",
      lastSynced: "18 Nov, 9:05",
      error: null,
      reconnect: false,
    });
    expect(view({ status: { ...connected, lastPushedAt: null } })).toMatchObject({ lastSynced: null });
  });

  it("says Reconnect Google after a refused token, and what to do when the calendar is gone", () => {
    expect(view({ status: { ...connected, error: "revoked" } })).toMatchObject({
      error: GOOGLE_ERROR_TEXT.revoked,
      reconnect: true,
    });
    expect(view({ status: { ...connected, error: "calendarGone" } })).toMatchObject({
      error: GOOGLE_ERROR_TEXT.calendarGone,
      reconnect: false,
    });
  });
});
