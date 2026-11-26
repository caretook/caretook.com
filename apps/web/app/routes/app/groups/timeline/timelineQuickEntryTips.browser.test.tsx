import type { DeviceRoute } from "../../../../../test/device";

import { afterEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { DICTATION_HINT } from "~/components/quick-entry/QuickEntryBox";
import { clearUndo } from "~/lib/medications/passUndo";
import * as timeline from "./route";
import { TIMELINE_URL } from "./timelineWorld";

// Quick entry's tips panel (B-621), on the test device: "Why don't you try"
// with the four examples, the two shorthands and the commas, floating under
// the empty box on a user's first three real focuses (a press or Tab, never
// a focus the app makes) while it's focused; the X ends it for good. It gives
// way to a card or the matching names, and storage that throws shows nothing.
// The examples name the group's own provider and medication, else the
// fictional defaults (B-833), and say "event", not "appt".

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/timeline", module: timeline }];
const METFORMIN = fx.medication({ name: "Metformin", strength: "500 mg", dose: "1 tablet" });
const OKAFOR = fx.provider({ name: "Dr. Ada Okafor" });
const KEY = `caretook:quickEntryTips:${TEST_USER.id}`;
/** The examples with the group's Metformin and Dr. Okafor. */
const EXAMPLES = ["bp 130/85 hr 72", "gave Metformin", "pain 4 left knee", "event Dr. Ada Okafor Friday 2pm"];
/** The fictional defaults, for a group with neither. */
const DEFAULTS = ["bp 130/85 hr 72", "gave metformin", "pain 4 left knee", "event Dr Lee Friday 2pm"];

const open = (fixtures = [METFORMIN, OKAFOR]) =>
  renderWithDevice({ route: ROUTES, url: TIMELINE_URL, fixtures });

const box = () => page.getByRole("textbox", { name: "What happened?" });
const field = () => box().element() as HTMLTextAreaElement;
const panel = () => document.querySelector<HTMLElement>("[data-quick-tips-panel]");
const hideButton = () => page.getByRole("button", { name: "Hide these tips for good" });
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
/** A real focus: a press on the empty box. */
const press = async () => {
  await userEvent.click(box());
  await expect.poll(() => document.activeElement).toBe(field());
};
const leave = async () => {
  field().blur();
  await expect.poll(panel).toBeNull();
};
/** The box's accessible description, all its parts. */
const description = () =>
  field()
    .getAttribute("aria-describedby")!
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

afterEach(() => {
  clearUndo();
  vi.restoreAllMocks();
});

describe("the tips panel", () => {
  test("shows on the first three focuses and not the fourth, and hides on blur", async () => {
    await open();
    for (let i = 1; i <= 3; i++) {
      await press();
      await expect.poll(panel).not.toBeNull();
      expect(panel()?.textContent).toContain("Why don’t you try");
      for (const line of EXAMPLES) await expect.poll(() => panel()?.textContent).toContain(line);
      expect(panel()?.textContent).toContain("for a note");
      expect(panel()?.textContent).toContain("for an event");
      expect(panel()?.textContent).toContain("Commas log several at once");
      await leave();
    }
    await press();
    // Give a fourth one the time to show, if it were going to.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(panel()).toBeNull();
    expect(stored()).toEqual({ seen: 3, dismissed: false });
  });

  test("its examples name the group's own provider and medication, and say event, not appt", async () => {
    await open();
    await press();
    const el = await found(panel);
    // The names arrive from the local database after mount.
    await expect.poll(() => el.textContent).toContain("event Dr. Ada Okafor Friday 2pm");
    for (const line of EXAMPLES) {
      expect(el.textContent).toContain(line);
      expect(description()).toContain(line);
    }
    expect(el.textContent).not.toContain("Dr Lee");
    expect(el.textContent).not.toMatch(/\bappt\b/);
    expect(description()).not.toMatch(/\bappt\b/);
  });

  test("with no provider or medication, the fictional defaults show", async () => {
    await open([]);
    await press();
    const el = await found(panel);
    for (const line of DEFAULTS) {
      expect(el.textContent).toContain(line);
      expect(description()).toContain(line);
    }
    expect(el.textContent).not.toMatch(/\bappt\b/);
  });

  test("the X hides it for good, and clicking it keeps focus in the box", async () => {
    await open();
    await press();
    await expect.element(hideButton()).toBeVisible();
    await userEvent.click(hideButton());
    await expect.poll(panel).toBeNull();
    expect(document.activeElement).toBe(field());
    await leave();
    await press();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(panel()).toBeNull();
    expect(stored()).toEqual({ seen: 1, dismissed: true });
  });

  test("focus on the X is still in the box: Tab to it, and Enter ends it with focus back in the box", async () => {
    await open();
    await press();
    await expect.element(hideButton()).toBeVisible();
    await userEvent.tab();
    expect(document.activeElement).toBe(hideButton().element());
    expect(panel()).not.toBeNull();
    await userEvent.keyboard("{Enter}");
    await expect.poll(panel).toBeNull();
    expect(document.activeElement).toBe(field());
  });

  test("a press on its words doesn't blur the box", async () => {
    await open();
    await press();
    await expect.poll(panel).not.toBeNull();
    await userEvent.click(page.getByText(EXAMPLES[0]));
    expect(document.activeElement).toBe(field());
    expect(panel()).not.toBeNull();
  });

  test("autofocus and the refocus after Save don't count", async () => {
    await open();
    // The app focusing the box (autofocus, Add an entry): nothing shows or counts.
    field().focus();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(panel()).toBeNull();
    expect(stored()).toBeNull();
    field().blur();
    // A real focus counts once; Save, then the box focused again by the app, doesn't.
    await press();
    await expect.poll(panel).not.toBeNull();
    await userEvent.type(box(), "pain 3 left knee");
    await expect.poll(panel).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => field().value).toBe("");
    field().focus();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(panel()).toBeNull();
    expect(stored()).toEqual({ seen: 1, dismissed: false });
  });

  test.each(["getItem", "setItem"] as const)("storage throwing on %s shows nothing", async (method) => {
    await open();
    const realGet = localStorage.getItem.bind(localStorage);
    const realSet = localStorage.setItem.bind(localStorage);
    const isTips = (key: string) => key.startsWith("caretook:quickEntryTips:");
    if (method === "getItem")
      vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
        if (isTips(key)) throw new Error("storage disabled");
        return realGet(key);
      });
    else
      vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
        if (isTips(key)) throw new Error("storage disabled");
        realSet(key, value);
      });
    await press();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(panel()).toBeNull();
  });

  test("name completions or a card take its place, and it's back when they go", async () => {
    await open();
    await press();
    await expect.poll(panel).not.toBeNull();
    await userEvent.type(box(), "gave met");
    await expect.element(page.getByRole("list", { name: "Matching names" })).toBeVisible();
    expect(panel()).toBeNull();
    await userEvent.clear(box());
    await expect.poll(panel).not.toBeNull();
    await userEvent.type(box(), "bp 120/80");
    await waitUntil(() => !!document.querySelector("[data-quick-card]"), "the card");
    expect(panel()).toBeNull();
  });

  test("it floats, pushing nothing, and fits at 320px; its words are the box's description already", async () => {
    await open();
    const section = field().closest<HTMLElement>("[data-quick-entry]")!;
    section.style.width = "320px";
    const height = section.getBoundingClientRect().height;
    await press();
    const el = await found(panel);
    expect(section.getBoundingClientRect().height).toBe(height);
    const tips = el.getBoundingClientRect();
    expect(tips.left).toBeGreaterThanOrEqual(section.getBoundingClientRect().left);
    expect(tips.right).toBeLessThanOrEqual(section.getBoundingClientRect().right);
    expect(tips.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth);
    // Screen readers hear the examples once, in the box's description; only the X is in the tree.
    await expect.poll(() => el.querySelector("[aria-hidden='true']")?.textContent).toContain(EXAMPLES[3]);
    const described = description();
    for (const line of EXAMPLES) expect(described).toContain(line);
    expect(described).toContain("“e:”");
  });

  test("it fades in like the kit's overlays, and not under reduced motion", async () => {
    const devtools = cdp() as unknown as { send: (method: string, params: object) => Promise<unknown> };
    await open();
    await press();
    expect(getComputedStyle(await found(panel)).transitionProperty).toBe("opacity");
    await leave();
    await devtools.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    try {
      await press();
      expect(parseFloat(getComputedStyle(await found(panel)).transitionDuration)).toBe(0);
    } finally {
      await devtools.send("Emulation.setEmulatedMedia", { features: [] });
    }
  });
});

describe("in Easy mode", () => {
  test("it floats over the dictation hint without moving it", async () => {
    const media = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((q) =>
      q.includes("pointer: coarse") ? { ...media(q), matches: true } : media(q),
    );
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
    localStorage.setItem(`caretook:settings:${TEST_USER.id}`, JSON.stringify({ easyMode: "easy" }));
    await renderWithDevice({
      route: ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/timeline`,
      role: null,
      frame: true,
      fixtures: [fx.member({ userId: TEST_USER.id, role: "caretaker" })],
    });
    await waitUntil(() => !!document.querySelector("[data-easy-timeline]"), "the easy view");
    const hint = page.getByText(DICTATION_HINT);
    await expect.element(hint).toBeVisible();
    const top = hint.element().getBoundingClientRect().top;
    await press();
    const el = await found(panel);
    expect(hint.element().getBoundingClientRect().top).toBe(top);
    // It sits above the hint, which shows again once the box is left.
    expect(Number(getComputedStyle(el).zIndex)).toBeGreaterThan(0);
    await leave();
    await expect.element(hint).toBeVisible();
  });
});
