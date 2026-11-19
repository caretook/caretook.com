import { describe, expect, it } from "vitest";
import { OFFLINE_LIMIT_MS, offlineAllowed, sessionOutcome } from "./sessionRules";

const now = Date.parse("2026-11-19T12:00:00Z");
const day = 24 * 60 * 60 * 1000;

describe("offlineAllowed", () => {
  it("is 3 days", () => expect(OFFLINE_LIMIT_MS).toBe(3 * day));

  it("allows a recent confirmation", () => {
    expect(offlineAllowed(now, now)).toBe(true);
    expect(offlineAllowed(now - day, now)).toBe(true);
  });

  it("allows exactly 3 days, not a moment more", () => {
    expect(offlineAllowed(now - OFFLINE_LIMIT_MS, now)).toBe(true);
    expect(offlineAllowed(now - OFFLINE_LIMIT_MS - 1, now)).toBe(false);
    expect(offlineAllowed(now - 4 * day, now)).toBe(false);
  });

  it("refuses when nothing was ever confirmed", () => {
    expect(offlineAllowed(null, now)).toBe(false);
    expect(offlineAllowed(Number.NaN, now)).toBe(false);
  });

  it("treats a clock that moved back as no time passed", () => {
    expect(offlineAllowed(now + day, now)).toBe(true);
  });
});

describe("sessionOutcome", () => {
  const user = { id: "u1" };

  it("is ok with a session", () => {
    expect(sessionOutcome({ data: user, error: null })).toEqual({ kind: "ok", data: user });
  });

  it("is signed out when the server says there's no session", () => {
    expect(sessionOutcome({ data: null, error: null })).toEqual({ kind: "signedOut" });
    expect(sessionOutcome({ data: null, error: { status: 401 } })).toEqual({ kind: "signedOut" });
    expect(sessionOutcome({ data: null, error: { status: 403 } })).toEqual({ kind: "signedOut" });
  });

  it("is unknown on a network error", () => {
    expect(sessionOutcome({ data: null, error: {} })).toEqual({ kind: "unknown" });
    expect(sessionOutcome({ data: null, error: { status: 0 } })).toEqual({ kind: "unknown" });
  });

  it("is unknown on a rate limit or a server error", () => {
    expect(sessionOutcome({ data: null, error: { status: 429 } })).toEqual({ kind: "unknown" });
    expect(sessionOutcome({ data: null, error: { status: 500 } })).toEqual({ kind: "unknown" });
    expect(sessionOutcome({ data: null, error: { status: 503 } })).toEqual({ kind: "unknown" });
  });
});
