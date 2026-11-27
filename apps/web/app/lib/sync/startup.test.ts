import { afterEach, describe, expect, it } from "vitest";
import {
  advance,
  advanceStartup,
  barValue,
  downloadPercent,
  resetStartup,
  startupDisplay,
  startupState,
  subscribeStartup,
  type StartupState,
} from "./startup";

// The loading screen's startup steps (B-957): forward only, skipping what a
// returning device doesn't need, with the first sync's download as a percentage.

const at = (step: StartupState["step"], download: number | null = null): StartupState => ({ step, download });

describe("advance", () => {
  it("moves forward through the steps", () => {
    let state = at("app");
    for (const step of ["device", "sync", "screen"] as const) {
      state = advance(state, step);
      expect(state.step).toBe(step);
    }
  });

  it("never moves back: an earlier step, or a smaller download, is ignored", () => {
    const syncing = at("sync", 0.5);
    expect(advance(syncing, "device")).toBe(syncing);
    expect(advance(syncing, "sync", 0.4)).toBe(syncing);
    expect(advance(syncing, "sync", null)).toBe(syncing);
    expect(advance(at("screen"), "sync", 0.9)).toEqual(at("screen"));
  });

  it("skips steps: a returning device goes from its copy to the screen", () => {
    expect(advance(at("app"), "screen")).toEqual(at("screen"));
    expect(advance(at("device"), "screen")).toEqual(at("screen"));
  });

  it("takes in the download on the sync step, clamped", () => {
    expect(advance(at("device"), "sync")).toEqual(at("sync"));
    expect(advance(at("sync"), "sync", 0.25)).toEqual(at("sync", 0.25));
    expect(advance(at("device"), "sync", 1.7)).toEqual(at("sync", 1));
    expect(advance(at("sync"), "sync", Number.NaN)).toEqual(at("sync"));
  });
});

describe("the display", () => {
  it("maps the download to a whole percentage", () => {
    expect(downloadPercent(at("sync", 0.4))).toBe(40);
    expect(downloadPercent(at("sync", 0.999))).toBe(99);
    expect(downloadPercent(at("sync", 1))).toBe(100);
    expect(downloadPercent(at("sync"))).toBeNull();
    expect(startupDisplay(at("sync", 0.4))).toMatchObject({
      message: "Syncing your care groups…",
      detail: "40%",
    });
    expect(startupDisplay(at("sync")).detail).toBeUndefined();
  });

  it("the bar only grows, through every step and the download", () => {
    const states = [at("app"), at("device"), at("sync"), at("sync", 0.3), at("sync", 1), at("screen")];
    const values = states.map(barValue);
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    expect(values[0]).toBeGreaterThan(0);
    expect(values.at(-1)).toBeLessThanOrEqual(100);
  });

  it("speaks plainly: no technical words", () => {
    for (const step of ["app", "device", "sync", "screen"] as const) {
      expect(startupDisplay(at(step)).message).not.toMatch(/wasm|database|stream|sqlite|powersync/i);
    }
  });
});

describe("the store", () => {
  afterEach(resetStartup);

  it("starts at the first step and tells its readers each move forward, not a step back", () => {
    expect(startupState()).toEqual(at("app"));
    const seen: StartupState[] = [];
    const stop = subscribeStartup(() => seen.push(startupState()));
    advanceStartup("sync", 0.2);
    advanceStartup("device");
    advanceStartup("sync", 0.1);
    advanceStartup("screen");
    stop();
    advanceStartup("screen");
    expect(seen).toEqual([at("sync", 0.2), at("screen")]);
    resetStartup();
    expect(startupState()).toEqual(at("app"));
  });
});
