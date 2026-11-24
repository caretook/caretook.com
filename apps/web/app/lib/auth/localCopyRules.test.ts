import { describe, expect, it } from "vitest";
import { KEPT_COPY_LIMIT_MS, keptCopyExpired, localCopyFate } from "./localCopyRules";

const NOW = Date.UTC(2027, 5, 9, 12);

describe("localCopyFate: what happens to the local copy", () => {
  it.each([
    ["signOut", 0, "wipe"],
    ["signOut", 3, "ask"],
    ["sessionEnded", 0, "wipe"],
    ["sessionEnded", 1, "keep"],
    ["otherUser", 0, "wipe"],
    ["otherUser", 2, "wipe"],
  ] as const)("%s with %i waiting: %s", (reason, waiting, fate) => {
    expect(localCopyFate({ reason, waiting, now: NOW })).toBe(fate);
  });

  it("keeps a kept copy just under its limit, and at the edge", () => {
    expect(
      localCopyFate({ reason: "keptCopy", waiting: 1, keptAt: NOW - KEPT_COPY_LIMIT_MS + 1, now: NOW }),
    ).toBe("keep");
    expect(
      localCopyFate({ reason: "keptCopy", waiting: 1, keptAt: NOW - KEPT_COPY_LIMIT_MS, now: NOW }),
    ).toBe("keep");
  });

  it("wipes a kept copy just over its limit, whatever is waiting", () => {
    expect(
      localCopyFate({ reason: "keptCopy", waiting: 4, keptAt: NOW - KEPT_COPY_LIMIT_MS - 1, now: NOW }),
    ).toBe("wipe");
  });

  it("is 30 days", () => {
    expect(KEPT_COPY_LIMIT_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("wipes a kept copy whose time is unknown", () => {
    expect(keptCopyExpired(null, NOW)).toBe(true);
    expect(keptCopyExpired(Number.NaN, NOW)).toBe(true);
  });

  it("counts a clock that moved back as no time passed", () => {
    expect(keptCopyExpired(NOW + 60_000, NOW)).toBe(false);
  });
});
