import type { TryStore } from "./uploadTries";

import { describe, expect, test } from "vitest";
import { SET_ASIDE_SPAN_MS, tryCounter, tryKey } from "./uploadTries";

// The upload's try counter (sync-safety slice 3, B-286): 5 failed tries of
// one op over at least 2 minutes set it aside; nothing else does.

const memoryStore = (): TryStore & { value: string | null } => {
  const store = {
    value: null as string | null,
    read: () => store.value,
    write: (value: string | null) => {
      store.value = value;
    },
  };
  return store;
};

const A = tryKey({ clientId: 7, table: "medication", id: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1b01" });
const B = tryKey({ clientId: 8, table: "provider", id: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c1b02" });
const T0 = Date.UTC(2027, 5, 9, 12);
const SECOND = 1000;

/** `n` tries of `key`, `gap` ms apart from `start`: what each answered. */
const tries = (counter: ReturnType<typeof tryCounter>, key: string, n: number, gap: number, start = T0) =>
  Array.from({ length: n }, (_, i) => counter.fail(key, start + i * gap));

describe("tryCounter", () => {
  test("4 tries don't set an op aside, however long they take", () => {
    expect(tries(tryCounter(memoryStore()), A, 4, 10 * 60 * SECOND)).toEqual([false, false, false, false]);
  });

  test("5 tries within a minute don't", () => {
    expect(tries(tryCounter(memoryStore()), A, 5, 10 * SECOND).at(-1)).toBe(false);
  });

  test("5 tries over 2 minutes do; until then a sixth or later keeps counting", () => {
    expect(tries(tryCounter(memoryStore()), A, 5, SET_ASIDE_SPAN_MS / 4)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    const quick = tryCounter(memoryStore());
    expect(tries(quick, A, 5, 5 * SECOND).at(-1)).toBe(false);
    expect(quick.fail(A, T0 + SET_ASIDE_SPAN_MS)).toBe(true);
  });

  test("a different op starts its own count and adds none to the first", () => {
    const counter = tryCounter(memoryStore());
    tries(counter, A, 4, 60 * SECOND);
    expect(counter.fail(B, T0 + 4 * 60 * SECOND)).toBe(false);
    // A starts over: its earlier tries are gone.
    expect(tries(counter, A, 4, 60 * SECOND, T0 + 5 * 60 * SECOND)).toEqual([false, false, false, false]);
  });

  test("the count clears when the op is acknowledged; another op's acknowledgement leaves it", () => {
    const store = memoryStore();
    const counter = tryCounter(store);
    tries(counter, A, 4, 60 * SECOND);
    counter.acknowledged([B]);
    expect(counter.fail(A, T0 + 4 * 60 * SECOND)).toBe(true);
    counter.acknowledged([B, A]);
    expect(store.value).toBeNull();
    expect(tries(counter, A, 4, 60 * SECOND)).toEqual([false, false, false, false]);
  });

  test("a count written, then read back by a fresh instance, carries on", () => {
    const store = memoryStore();
    tries(tryCounter(store), A, 4, 60 * SECOND);
    expect(tryCounter(store).fail(A, T0 + 4 * 60 * SECOND)).toBe(true);
  });

  test("an unreadable record starts over", () => {
    const store = memoryStore();
    store.value = "{not json";
    expect(tryCounter(store).fail(A, T0)).toBe(false);
    expect(JSON.parse(store.value)).toEqual({ key: A, count: 1, first: T0, last: T0 });
  });
});
