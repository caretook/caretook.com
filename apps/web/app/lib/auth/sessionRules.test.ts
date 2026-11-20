import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionAnswer } from "./sessionRules";

import {
  FRESH_MS,
  NETWORK_ANSWER_MS,
  OFFLINE_LIMIT_MS,
  RECHECK_MS,
  RETRY_CAP_MS,
  askSession,
  offlineAllowed,
  retryDelay,
  sessionFreshness,
  sessionOutcome,
  shouldRecheck,
  withTimeout,
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

describe("sessionFreshness", () => {
  it("is 15 minutes", () => expect(FRESH_MS).toBe(15 * 60 * 1000));

  it("is fresh up to exactly 15 minutes, then stale", () => {
    expect(sessionFreshness(now, now)).toBe("fresh");
    expect(sessionFreshness(now - FRESH_MS, now)).toBe("fresh");
    expect(sessionFreshness(now - FRESH_MS - 1, now)).toBe("stale");
    expect(sessionFreshness(now - 4 * day, now)).toBe("stale");
  });

  it("treats a clock that moved back as no time passed", () => {
    expect(sessionFreshness(now + day, now)).toBe("fresh");
  });

  it("is none with no record", () => {
    expect(sessionFreshness(null, now)).toBe("none");
    expect(sessionFreshness(Number.NaN, now)).toBe("none");
  });
});

describe("shouldRecheck", () => {
  it("rechecks a confirmation over a minute old", () => {
    expect(RECHECK_MS).toBe(60 * 1000);
    expect(shouldRecheck(now, now)).toBe(false);
    expect(shouldRecheck(now - RECHECK_MS, now)).toBe(false);
    expect(shouldRecheck(now - RECHECK_MS - 1, now)).toBe(true);
  });

  it("doesn't recheck after a clock moved back, and does with no record", () => {
    expect(shouldRecheck(now + day, now)).toBe(false);
    expect(shouldRecheck(null, now)).toBe(true);
    expect(shouldRecheck(Number.NaN, now)).toBe(true);
  });
});

/** A promise and the functions that settle it. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("passes an answer through in time", async () => {
    expect(await withTimeout(Promise.resolve("ok"), NETWORK_ANSWER_MS, () => "unknown")).toBe("ok");
  });

  it("resolves unknown at 3 s and ignores the late answer", async () => {
    vi.useFakeTimers();
    expect(NETWORK_ANSWER_MS).toBe(3000);
    const late = deferred<string>();
    let result: string | undefined;
    void withTimeout(late.promise, NETWORK_ANSWER_MS, () => "unknown").then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(NETWORK_ANSWER_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe("unknown");
    late.resolve("ok");
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBe("unknown");
  });

  it("ignores a late failure too, and rejects an early one", async () => {
    vi.useFakeTimers();
    const late = deferred<string>();
    const timed = withTimeout(late.promise, NETWORK_ANSWER_MS, () => "unknown");
    await vi.advanceTimersByTimeAsync(NETWORK_ANSWER_MS);
    late.reject(new Error("late"));
    expect(await timed).toBe("unknown");
    await expect(withTimeout(Promise.reject(new Error("bug")), 1000, () => "unknown")).rejects.toThrow("bug");
  });
});

describe("askSession under the timeout", () => {
  afterEach(() => vi.useRealTimers());
  const user = { id: "u1" };

  it("is unknown when the server doesn't answer within 3 s", async () => {
    vi.useFakeTimers();
    const asked = askSession(() => new Promise<never>(() => undefined));
    await vi.advanceTimersByTimeAsync(NETWORK_ANSWER_MS);
    expect(await asked).toEqual({ kind: "unknown" });
  });

  it("retries a 429 inside the budget", async () => {
    vi.useFakeTimers();
    const answers = [
      { data: null, error: { status: 429 }, retryAfter: "10" },
      { data: user, error: null },
    ];
    let calls = 0;
    const asked = askSession(() => Promise.resolve(answers[calls++]!));
    await vi.advanceTimersByTimeAsync(RETRY_CAP_MS);
    expect(await asked).toEqual({ kind: "ok", data: user });
    expect(calls).toBe(2);
  });

  it("doesn't retry when the wait would pass the budget", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const asked = askSession(() => {
      calls++;
      return new Promise<SessionAnswer<never> & { retryAfter: string }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { status: 429 }, retryAfter: "2" }), 1500),
      );
    });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await asked).toEqual({ kind: "rateLimited" });
    expect(calls).toBe(1);
  });

  it("is still rate-limited when the retry doesn't answer in time", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const asked = askSession(() =>
      calls++ === 0
        ? Promise.resolve({ data: null, error: { status: 429 }, retryAfter: "1" })
        : new Promise<never>(() => undefined),
    );
    await vi.advanceTimersByTimeAsync(NETWORK_ANSWER_MS);
    expect(await asked).toEqual({ kind: "rateLimited" });
    expect(calls).toBe(2);
  });
});
