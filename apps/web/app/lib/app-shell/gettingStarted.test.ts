import { GROUP_ROLE_NAMES } from "@caretook/data/permissions";
import { describe, expect, it } from "vitest";
import { inSetupWindow, SETUP_WINDOW_DAYS, timelineWelcome } from "./gettingStarted";

const text = (role: string) => timelineWelcome({ role, setsUp: false }) ?? "";

describe("timelineWelcome", () => {
  it.each(GROUP_ROLE_NAMES)("has a welcome for %s", (role) => {
    expect(text(role).length).toBeGreaterThan(20);
  });

  it.each(GROUP_ROLE_NAMES)("gives the setter none, as %s", (role) => {
    expect(timelineWelcome({ role, setsUp: true })).toBeNull();
  });

  it("offers each welcome only what the role can do", () => {
    expect(text("easy_helper")).toContain("log");
    expect(text("caretaker")).not.toMatch(/member|settings/i);
    expect(text("viewer")).not.toMatch(/\blog\b|\badd\b/i);
    expect(text("easy_viewer")).not.toMatch(/\blog\b|\badd\b|medication|provider/i);
    for (const role of ["viewer", "easy_helper", "easy_viewer"])
      expect(text(role)).toContain("todos assigned to you");
  });

  it("gives nothing to an unknown role or none", () => {
    expect(timelineWelcome({ role: "someone_new", setsUp: false })).toBeNull();
    expect(timelineWelcome({ role: "constructor", setsUp: false })).toBeNull();
    expect(timelineWelcome({ role: null, setsUp: false })).toBeNull();
  });
});

describe("inSetupWindow", () => {
  const joined = "2027-06-01T12:00:00.000Z";
  const at = Date.parse(joined);
  const windowMs = SETUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  it("holds through the window's last instant and not after", () => {
    expect(inSetupWindow(joined, at)).toBe(true);
    expect(inSetupWindow(joined, at + windowMs)).toBe(true);
    expect(inSetupWindow(joined, at + windowMs + 1)).toBe(false);
  });

  it("holds when the device's clock is behind the join", () => {
    expect(inSetupWindow(joined, at - 60_000)).toBe(true);
  });

  it("is false without a readable date", () => {
    expect(inSetupWindow(null, at)).toBe(false);
    expect(inSetupWindow("not a date", at)).toBe(false);
  });
});
