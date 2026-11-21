import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { found } from "../../../../../test/found";
import { fx } from "../../../../../test/fixtures";
import { pageHeader } from "../../../../../test/pageHeader";
import {
  $,
  $$,
  clockAt,
  FORM,
  fixClock,
  LIST,
  listNames,
  MEDICATION_ROUTES,
  SCHEDULE,
  SHEET,
  world,
} from "./medicationWorld";

// The Medications page's two tabs (B-226): one header (the title, Add for
// writers, Print; Passes on Schedule only) over Schedule (Today) and the list
// (the allergies, search, Filter and the list), each tab its own URL, the add
// sheet opening over either and closing back to it, the list's search kept.
// On the fixed clock (10:00), so a medication a few minutes back is due. What
// each tab does is today.browser.test.tsx's and medicationList.browser.test.tsx's;
// `TabNav` itself is the primitives' tests'.

/** Due a few minutes back, so Schedule offers Given to a writer. */
const DUE = fx.medication({
  name: "Donepezil",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: clockAt(-5) }] },
});

const open = (url: string, role: "caretaker" | "viewer" = "caretaker") =>
  renderWithDevice({ route: MEDICATION_ROUTES, url, role, fixtures: [world(), DUE] });

const TABS = 'main nav[aria-label="Medications tabs"]';
const tabLink = (label: string) =>
  $$<HTMLAnchorElement>(`${TABS} a`).find((a) => a.textContent?.trim() === label) ?? null;
const currentTab = () =>
  $$(`${TABS} a`)
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim());

/** What the page shows, by part. */
const parts = () => ({
  today: !!$("main [data-today]"),
  allergies: !!$("main [data-allergies]"),
  search: !!$('main input[type="search"]'),
  filter: !!$("main [data-filter-button]"),
  list: !!$('main ul[aria-label="Current medications"]'),
  passes: !!$("main [data-passes-link]"),
});
/** The shared header: its title, Add and Print. */
const header = () => ({
  h1: pageHeader().h1,
  add: !!$("main header [data-add-medication]"),
  print: $$("main header button").some((b) => b.getAttribute("aria-label") === "Print"),
});
const doseButtons = () => $$("main [data-give], main [data-given-all]").length;

beforeEach(() => {
  fixClock();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the tabs", () => {
  test("Schedule shows Today and Passes, not the allergies, search, Filter or list, under the header", async () => {
    await open(SCHEDULE);
    await expect.poll(() => doseButtons()).toBeGreaterThan(0);
    expect(currentTab()).toEqual(["Schedule"]);
    expect(parts()).toEqual({
      today: true,
      allergies: false,
      search: false,
      filter: false,
      list: false,
      passes: true,
    });
    expect(header()).toEqual({ h1: "Medications", add: true, print: true });
  });

  test("the list tab shows the allergies, search, Filter and list, not Today or Passes, under the same header", async () => {
    await open(LIST);
    await expect.poll(() => listNames("Current medications")).toContain("Donepezil 5 mg");
    expect(currentTab()).toEqual(["Medications"]);
    expect(parts()).toEqual({
      today: false,
      allergies: true,
      search: true,
      filter: true,
      list: true,
      passes: false,
    });
    expect(header()).toEqual({ h1: "Medications", add: true, print: true });
  });

  test("a tap switches tabs, the URL and the marked tab following; each tab links to its own path", async () => {
    const device = await open(SCHEDULE);
    // The tabs render after the first rows: wait on them, never read them at once.
    await expect.poll(() => tabLink("Schedule")?.getAttribute("href")).toBe(SCHEDULE);
    await expect.poll(() => tabLink("Medications")?.getAttribute("href")).toBe(LIST);
    await userEvent.click(await found(() => tabLink("Medications")));
    await expect.poll(device.location).toBe(LIST);
    await expect.poll(currentTab).toEqual(["Medications"]);
    await expect.poll(() => parts().list).toBe(true);
    expect(parts().today).toBe(false);

    await userEvent.click(await found(() => tabLink("Schedule")));
    await expect.poll(device.location).toBe(SCHEDULE);
    await expect.poll(currentTab).toEqual(["Schedule"]);
    await expect.poll(() => parts().today).toBe(true);
    expect(parts().list).toBe(false);
  });

  test("a viewer reads both tabs with neither Add nor the dose buttons", async () => {
    const device = await open(SCHEDULE, "viewer");
    await expect.poll(() => $(`main [data-slot^="${DUE.id}@"]`)).toBeTruthy();
    expect(doseButtons()).toBe(0);
    expect(header()).toEqual({ h1: "Medications", add: false, print: true });
    await device.screen.unmount();

    await open(LIST, "viewer");
    await expect.poll(() => listNames("Current medications")).toContain("Donepezil 5 mg");
    expect(header().add).toBe(false);
  });
});

describe("the add sheet over a tab", () => {
  test("over Schedule: Add opens it there, with Schedule still underneath and marked; Cancel goes back to Schedule", async () => {
    const device = await open(SCHEDULE);
    await userEvent.click(await found(() => $("main [data-add-medication]")));
    await expect.poll(() => !!FORM()).toBe(true);
    expect(device.location()).toBe(`${SCHEDULE}/new`);
    expect(parts().today).toBe(true);
    expect(currentTab()).toEqual(["Schedule"]);
    const cancel = [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel")!;
    await userEvent.click(cancel);
    await expect.poll(() => !SHEET() && device.location()).toBe(SCHEDULE);
    expect(parts().today).toBe(true);
  });

  test("over the list: Add carries the search, the filtered list stays underneath, and Cancel comes back to it with the search kept", async () => {
    const device = await open(`${LIST}?q=done`);
    await expect.poll(() => listNames("Current medications")).toEqual(["Donepezil 5 mg"]);
    await userEvent.click(await found(() => $("main [data-add-medication]")));
    await expect.poll(() => !!FORM()).toBe(true);
    expect(device.location()).toBe(`${LIST}/new?q=done`);
    expect(listNames("Current medications")).toEqual(["Donepezil 5 mg"]);
    expect(currentTab()).toEqual(["Medications"]);
    const cancel = [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel")!;
    await userEvent.click(cancel);
    await expect.poll(() => !SHEET() && device.location()).toBe(`${LIST}?q=done`);
    expect($<HTMLInputElement>('main input[type="search"]')?.value).toBe("done");
    expect(listNames("Current medications")).toEqual(["Donepezil 5 mg"]);
  });

  test("opened by its URL over Schedule (a reload), closing replaces it with Schedule", async () => {
    const device = await open(`${SCHEDULE}/new`);
    await expect.poll(() => !!FORM()).toBe(true);
    const cancel = [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel")!;
    await userEvent.click(cancel);
    await expect.poll(() => !SHEET() && device.location()).toBe(SCHEDULE);
  });
});

describe("the page title", () => {
  test.each([SCHEDULE, LIST])("is one h1, Medications, on %s", async (url) => {
    await open(url);
    await expect.poll(() => document.querySelector("main h1")?.textContent).toBe("Medications");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
