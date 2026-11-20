import { describe, expect, it } from "vitest";
import { settingsPlan } from "./settingsPlan";

const change = { timelineView: "cards" };

describe("settingsPlan", () => {
  it("answers from the cache, sending nothing, with a cache and nothing pending", () => {
    expect(settingsPlan({ cached: true, pending: null })).toEqual({ answer: "cache", send: null });
  });

  it("answers from the cache and sends the pending change, with both", () => {
    expect(settingsPlan({ cached: true, pending: change })).toEqual({ answer: "cache", send: change });
  });

  it("waits for the server with no cache and nothing pending", () => {
    expect(settingsPlan({ cached: false, pending: null })).toEqual({ answer: "wait", send: null });
  });

  it("waits and sends the pending change with no cache", () => {
    expect(settingsPlan({ cached: false, pending: change })).toEqual({ answer: "wait", send: change });
  });

  it("treats an empty pending change as nothing to send", () => {
    expect(settingsPlan({ cached: true, pending: {} })).toEqual({ answer: "cache", send: null });
  });
});
