import { describe, expect, it } from "vitest";
import type { SessionAnswer } from "./sessionRules";

import {
  OFFLINE_LIMIT_MS,
  RETRY_CAP_MS,
  askSession,
  offlineAllowed,
  retryDelay,
  sessionOutcome,
  withoutAnswer,
} from "./sessionRules";

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

  it("is rate-limited on a 429", () => {
    expect(sessionOutcome({ data: null, error: { status: 429 } })).toEqual({ kind: "rateLimited" });
  });

  it("is unknown on a server error", () => {
    expect(sessionOutcome({ data: null, error: { status: 500 } })).toEqual({ kind: "unknown" });
    expect(sessionOutcome({ data: null, error: { status: 503 } })).toEqual({ kind: "unknown" });
  });
});

describe("retryDelay", () => {
  it("waits as long as the header says, up to the cap", () => {
    expect(retryDelay("0")).toBe(0);
    expect(retryDelay("1")).toBe(1000);
    expect(retryDelay("10")).toBe(RETRY_CAP_MS);
    expect(RETRY_CAP_MS).toBe(2000);
  });

  it("waits a second with no usable header", () => {
    expect(retryDelay(null)).toBe(1000);
    expect(retryDelay("")).toBe(1000);
    expect(retryDelay("soon")).toBe(1000);
    expect(retryDelay("-3")).toBe(1000);
  });
});

/** A stubbed server: one answer per request, in order, and what was waited. */
const server = (...answers: ((SessionAnswer<{ id: string }> & { retryAfter?: string }) | Error)[]) => {
  const waits: number[] = [];
  let calls = 0;
  const ask = () => {
    const next = answers[calls++];
    if (!next) throw new Error("asked too often");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  const wait = (ms: number) => (waits.push(ms), Promise.resolve());
  return { ask, wait, waits, calls: () => calls };
};

const limited = { data: null, error: { status: 429 }, retryAfter: "1" };

describe("askSession", () => {
  const user = { id: "u1" };

  it("signs in when a 429 is followed by a session", async () => {
    const s = server(limited, { data: user, error: null });
    expect(await askSession(s.ask, s.wait)).toEqual({ kind: "ok", data: user });
    expect(s.waits).toEqual([1000]);
  });

  it("is rate-limited after a second 429", async () => {
    const s = server(limited, limited);
    expect(await askSession(s.ask, s.wait)).toEqual({ kind: "rateLimited" });
    expect(s.calls()).toBe(2);
  });

  it("asks once for any other answer", async () => {
    for (const answer of [
      { data: user, error: null },
      { data: null, error: { status: 401 } },
      { data: null, error: { status: 500 } },
    ]) {
      const s = server(answer);
      await askSession(s.ask, s.wait);
      expect(s.calls()).toBe(1);
      expect(s.waits).toEqual([]);
    }
  });

  it("is still signed out on a 401", async () => {
    const s = server({ data: null, error: { status: 401 } });
    expect(await askSession(s.ask, s.wait)).toEqual({ kind: "signedOut" });
  });

  it("is unknown when the network fails, and rethrows anything else", async () => {
    expect(await askSession(server(new TypeError("Failed to fetch")).ask)).toEqual({ kind: "unknown" });
    await expect(askSession(server(new Error("bug")).ask)).rejects.toThrow("bug");
  });
});

describe("withoutAnswer", () => {
  const cached = { id: "u1" };

  it("keeps the cached user through a rate limit or no answer, within the offline limit", () => {
    expect(withoutAnswer("rateLimited", cached, now - day, now)).toBe(cached);
    expect(withoutAnswer("unknown", cached, now - day, now)).toBe(cached);
  });

  it("is offline too long past the limit", () => {
    expect(withoutAnswer("rateLimited", cached, now - 4 * day, now)).toBe("offlineTooLong");
  });

  it("with nobody cached, a rate limit is rate-limited, not signed out", () => {
    expect(withoutAnswer("rateLimited", null, null, now)).toBe("rateLimited");
    expect(withoutAnswer("unknown", null, null, now)).toBe("signedOut");
  });
});
