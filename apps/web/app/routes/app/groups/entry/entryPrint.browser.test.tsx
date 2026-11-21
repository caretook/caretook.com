import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, TEST_GROUP } from "../../../../../test/fixtures";
import * as timeline from "../timeline/route";
import * as entryRoute from "./route";

// Print from a note's or event's ⋯ menu, for everyone: the print view holds
// the title, time, place, With providers and text, and is all that prints
// (hidden on screen); a row's Print opens the page, which prints once. How
// it looks on paper is a by-hand check at landing.

const GROUP = TEST_GROUP.id;
const entryPath = (id: string) => `/app/groups/${GROUP}/entries/${id}`;
const TIMELINE = `/app/groups/${GROUP}/timeline`;
const ROUTES = [
  { path: "/app/groups/:groupId/timeline", module: timeline },
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
];

const LARK = fx.provider({ name: "Dr. Mira Lark", address: "12 Elm Street\nSpringfield" });
const PT = fx.provider({ name: "Jo Park", specialty: "Physical therapy" });
const VISIT = fx.event({
  title: "Visit with Dr. Lark",
  occurredAt: at(new Date(Date.now() - 20 * 60_000)),
  text: "Blood pressure is better.\n• Keep the dose\n• Recheck in May",
});
const NOTE = fx.note({ title: null, text: "Slept well", occurredAt: at(new Date(Date.now() - 10 * 60_000)) });
const world = () => [
  LARK,
  PT,
  VISIT,
  fx.link(VISIT.id, LARK.id, { createdAt: hoursAgo(2) }),
  fx.link(VISIT.id, PT.id),
  NOTE,
];

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const VIEW = () => $("[data-print-entry]");
const part = (name: string) => VIEW()?.querySelector(`[data-print="${name}"]`)?.textContent ?? null;
const MENU = () =>
  $<HTMLButtonElement>('main header [data-region="actions"] button[aria-label^="Actions for"]');
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitUntil = async (test: () => boolean, ms = 8000, what = "condition") => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return;
    await pause(25);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const printed = () => vi.spyOn(window, "print").mockImplementation(() => undefined);
afterEach(() => vi.restoreAllMocks());

describe("the print view", () => {
  test("an event's: title, time, its provider's address as the place, With, and the text; hidden on screen", async () => {
    await renderWithDevice({ route: ROUTES, url: entryPath(VISIT.id), fixtures: world() });
    await waitUntil(() => !!part("text")?.includes("Recheck in May"), 8000, "the print view");
    await expect.poll(() => part("title")).toBe("Visit with Dr. Lark");
    await expect.poll(() => part("time")).toMatch(/^Event · Today, /);
    await expect.poll(() => part("place")).toBe("Place: 12 Elm Street, Springfield (from Dr. Mira Lark)");
    await expect.poll(() => part("with")).toBe("With: Dr. Mira Lark, Jo Park");
    expect(
      [...(await found(VIEW)).querySelectorAll("[data-print=text] li")].map((li) => li.textContent),
    ).toEqual(["Keep the dose", "Recheck in May"]);
    expect(getComputedStyle(await found(VIEW)).display).toBe("none");
    // On paper the page's controls give way to it.
    expect($("main > div.print\\:hidden")).toBeTruthy();
  });

  test("a typed place wins, and a note has no place or With", async () => {
    const typed = fx.event({ title: "Lab", place: "Main St Lab", text: "Fasting" });
    const device = await renderWithDevice({
      route: ROUTES,
      url: entryPath(typed.id),
      fixtures: [world(), typed, fx.link(typed.id, LARK.id)],
    });
    await waitUntil(() => part("text") === "Fasting");
    await expect.poll(() => part("place")).toBe("Place: Main St Lab");
    await device.screen.unmount();
    await renderWithDevice({ route: ROUTES, url: entryPath(NOTE.id), fixtures: world() });
    await waitUntil(() => part("text") === "Slept well");
    await expect.poll(() => part("title")).toBe("Note");
    expect([part("place"), part("with")]).toEqual([null, null]);
  });
});

describe("Print in the ⋯ menu", () => {
  test("a writer's event menu has Print before Delete; it prints the page", async () => {
    const print = printed();
    await renderWithDevice({ route: ROUTES, url: entryPath(VISIT.id), fixtures: world(), role: "caretaker" });
    await waitUntil(() => !!MENU());
    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Print"), 4000, "the menu");
    expect(menuItems().slice(-2)).toEqual(["Print", "Delete"]);
    await userEvent.click(await found(() => menuItem("Print")));
    expect(print).toHaveBeenCalledTimes(1);
  });

  test("a viewer's is Print alone, and it prints", async () => {
    const print = printed();
    await renderWithDevice({ route: ROUTES, url: entryPath(NOTE.id), fixtures: world(), role: "viewer" });
    await waitUntil(() => !!MENU());
    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Print"), 4000, "the menu");
    expect(menuItems()).toEqual(["Print"]);
    await userEvent.click(await found(() => menuItem("Print")));
    expect(print).toHaveBeenCalledTimes(1);
  });

  test("a timeline row's Print opens the page, which prints once and drops ?print", async () => {
    const print = printed();
    const device = await renderWithDevice({
      route: ROUTES,
      url: TIMELINE,
      fixtures: world(),
      role: "viewer",
    });
    const actions = () =>
      [...document.querySelectorAll<HTMLButtonElement>('ol button[aria-label^="Actions for event"]')][0];
    await waitUntil(() => !!actions(), 8000, "the event's ⋯");
    await userEvent.click(actions()!);
    await waitUntil(() => !!menuItem("Print"), 4000, "the menu");
    await userEvent.click(await found(() => menuItem("Print")));
    await expect.poll(() => print.mock.calls.length, { timeout: 4000 }).toBe(1);
    await expect.poll(() => device.location()).toBe(entryPath(VISIT.id));
    await expect.poll(() => part("title")).toBe("Visit with Dr. Lark");
    await pause(300);
    expect(print).toHaveBeenCalledTimes(1);
  });
});
