import { afterEach, describe, expect, test } from "vitest";
import { at, fx, TEST_USER } from "../../../../../test/fixtures";
import { openTimeline, rowWith, rows, view, world } from "./timelineWorld";
import { waitUntil } from "../../../../../test/found";

// Settings come from the device's cache at once (lib/app-shell/me.ts,
// B-156); the server's copy arrives in the background, and the open
// timeline follows it through the settings store (`useMySettings`).

const SETTINGS_KEY = `caretook:settings:${TEST_USER.id}`;
const UNITS_F = { temperature: "f", weight: "lb", glucose: "mg/dL", volume: "mL" };
const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(`caretook:settings-pending:${TEST_USER.id}`);
});

describe("settings from the cache, refreshed in the background", () => {
  test("the timeline opens with the cached units, then shows the server's when they arrive", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ units: UNITS_F, timelineView: "rows" }));
    let answer!: (settings: unknown) => void;
    const server = new Promise((resolve) => (answer = resolve));
    await openTimeline({
      fixtures: [
        world(),
        fx.vital({ readings: [{ type: "temperature", value: 37 }], occurredAt: minutesAgo(5) }),
      ],
      // The server is slow: the timeline doesn't wait for it.
      api: { "me.get": () => server },
    });
    await waitUntil(() => rows().length > 0, "rows");
    await waitUntil(() => !!rowWith("°F"), "the temperature in °F");
    expect(rowWith("°C")).toBeUndefined();
    expect(view()).toBe("rows");

    answer({
      units: { ...UNITS_F, temperature: "c" },
      timelineView: "cards",
      easyMode: "group",
      daySummary: "highlights",
    });
    await waitUntil(() => !!rowWith("°C"), "the temperature in °C");
    expect(rowWith("°F")).toBeUndefined();
    await waitUntil(() => view() === "cards", "the server's layout");
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null")).toMatchObject({
      units: { temperature: "c" },
    });
  });
});
