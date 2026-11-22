import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fixClock, found } from "../../../../../test/found";
import { fx, medicationPass } from "../../../../../test/fixtures";
import { pageHeader } from "../../../../../test/pageHeader";
import {
  clockAt,
  FORM,
  LIST,
  listNames,
  MEDICATION_ROUTES,
  menuItem,
  PASSES,
  SCHEDULE,
  SHEET,
  world,
  CLOCK,
} from "./medicationWorld";

// The Medications page's three tabs (B-226, B-424): one header (the title,
// Print, and for writers the `+` menu: Medication, Pass) over Schedule
// (Today), the list (the allergies, search, Filter and the list) and Passes
// (the group's rounds), each tab its own URL, the add sheet opening over
// Schedule or the list and closing back to it, the list's search kept.
// On the fixed clock (10:00), so a medication a few minutes back is due. What
// each tab does is today.browser.test.tsx's, medicationList.browser.test.tsx's
// and passes.browser.test.tsx's; `TabNav` itself is the primitives' tests'.

/** Due a few minutes back, so Schedule offers Given to a writer. */
const DUE = fx.medication({
  name: "Donepezil",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: clockAt(-5) }] },
});

const open = (url: string, role: "caretaker" | "viewer" = "caretaker", extra: unknown[] = []) =>
  renderWithDevice({ route: MEDICATION_ROUTES, url, role, fixtures: [world(), DUE, ...(extra as [])] });

const TABS = 'main nav[aria-label="Medications tabs"]';
const tabLink = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>(`${TABS} a`)].find(
    (a) => a.textContent?.trim() === label,
  ) ?? null;
const currentTab = () =>
  [...document.querySelectorAll<HTMLElement>(`${TABS} a`)]
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim());

/** What the page shows, by part. */
const parts = () => ({
  today: !!document.querySelector<HTMLElement>("main [data-today]"),
  allergies: !!document.querySelector<HTMLElement>("main [data-allergies]"),
  search: !!document.querySelector<HTMLElement>('main input[type="search"]'),
  filter: !!document.querySelector<HTMLElement>("main [data-filter-button]"),
  list: !!document.querySelector<HTMLElement>('main ul[aria-label="Current medications"]'),
  passes: !!document.querySelector<HTMLElement>("main [data-passes]"),
});
/** The shared header: its title, the `+` and Print. */
const header = () => ({
  h1: pageHeader().h1,
  add: !!document.querySelector<HTMLElement>("main header [data-add-medication]"),
  print: [...document.querySelectorAll<HTMLElement>("main header button")].some(
    (b) => b.getAttribute("aria-label") === "Print",
  ),
});
/** The header's `+`: the Add menu's trigger. */
const addButton = () => page.getByRole("button", { name: "Add", exact: true });
/** Open the `+` menu; its items' names. */
const addMenu = async () => {
  await userEvent.click(addButton());
  await expect.poll(() => !!menuItem("Medication")).toBe(true);
  return [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].map((m) => m.textContent?.trim());
};
const choose = async (item: string) => {
  await addMenu();
  await userEvent.click(await found(() => menuItem(item)));
};
const PASS_FORM = () => document.querySelector<HTMLElement>("[role=dialog] [data-pass-form]");
const doseButtons = () =>
  [...document.querySelectorAll<HTMLElement>("main [data-give], main [data-given-all]")].length;

beforeEach(() => {
  fixClock(CLOCK);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the tabs", () => {
  test("three tabs in order: Schedule, Medications, Passes, each linking to its own path", async () => {
    await open(SCHEDULE);
    // The tabs render after the first rows: wait on them, never read them at once.
    await expect
      .poll(() =>
        [...document.querySelectorAll<HTMLElement>(`${TABS} a`)].map((a) => [
          a.textContent?.trim(),
          a.getAttribute("href"),
        ]),
      )
      .toEqual([
        ["Schedule", SCHEDULE],
        ["Medications", LIST],
        ["Passes", PASSES],
      ]);
  });

  test("Schedule shows Today, not the allergies, search, Filter, list or passes, under the header", async () => {
    await open(SCHEDULE);
    await expect.poll(() => doseButtons()).toBeGreaterThan(0);
    expect(currentTab()).toEqual(["Schedule"]);
    expect(parts()).toEqual({
      today: true,
      allergies: false,
      search: false,
      filter: false,
      list: false,
      passes: false,
    });
    expect(header()).toEqual({ h1: "Medications", add: true, print: true });
  });

  test("the list tab shows the allergies, search, Filter and list, not Today or the passes, under the same header", async () => {
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

  test("the passes URL shows the Medications header with Passes current, one h1, no back link", async () => {
    await open(PASSES);
    await expect.poll(() => parts().passes).toBe(true);
    expect(currentTab()).toEqual(["Passes"]);
    expect(header()).toEqual({ h1: "Medications", add: true, print: true });
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    // The old page's back link ("Medications", to Schedule) is gone: only the tab bar links there.
    expect(
      [...document.querySelectorAll<HTMLElement>(`main a[href="${SCHEDULE}"]`)].filter(
        (a) => !a.closest(TABS),
      ),
    ).toEqual([]);
    expect(parts()).toMatchObject({ today: false, list: false, search: false });
  });

  test("a tap switches tabs, the URL and the marked tab following", async () => {
    const device = await open(SCHEDULE);
    await userEvent.click(await found(() => tabLink("Medications")));
    await expect.poll(device.location).toBe(LIST);
    await expect.poll(currentTab).toEqual(["Medications"]);
    await expect.poll(() => parts().list).toBe(true);
    expect(parts().today).toBe(false);

    await userEvent.click(await found(() => tabLink("Passes")));
    await expect.poll(device.location).toBe(PASSES);
    await expect.poll(currentTab).toEqual(["Passes"]);
    await expect.poll(() => parts().passes).toBe(true);
    expect(parts().list).toBe(false);

    await userEvent.click(await found(() => tabLink("Schedule")));
    await expect.poll(device.location).toBe(SCHEDULE);
    await expect.poll(currentTab).toEqual(["Schedule"]);
    await expect.poll(() => parts().today).toBe(true);
    expect(parts().passes).toBe(false);
  });

  test("a viewer reads the three tabs with neither the + nor the dose buttons, Print only", async () => {
    const device = await open(SCHEDULE, "viewer");
    await expect
      .poll(() => document.querySelector<HTMLElement>(`main [data-slot^="${DUE.id}@"]`))
      .toBeTruthy();
    expect(doseButtons()).toBe(0);
    expect(header()).toEqual({ h1: "Medications", add: false, print: true });
    await device.screen.unmount();

    const list = await open(LIST, "viewer");
    await expect.poll(() => listNames("Current medications")).toContain("Donepezil 5 mg");
    expect(header().add).toBe(false);
    await list.screen.unmount();

    await open(PASSES, "viewer");
    await expect.poll(() => parts().passes).toBe(true);
    expect(header()).toEqual({ h1: "Medications", add: false, print: true });
  });
});

describe("the header's +", () => {
  test("is the header's last control, named Add, and its menu lists Medication then Pass", async () => {
    await open(SCHEDULE);
    await expect.element(addButton()).toHaveAttribute("title", "Add");
    expect(addButton().element().textContent.trim()).toBe("");
    expect([...document.querySelectorAll("main header a, main header button")].at(-1)).toBe(
      addButton().element(),
    );
    expect(await addMenu()).toEqual(["Medication", "Pass"]);
  });

  test("from Passes, Medication opens the add sheet over the list", async () => {
    const device = await open(PASSES);
    await expect.poll(() => parts().passes).toBe(true);
    await choose("Medication");
    await expect.poll(() => !!FORM()).toBe(true);
    expect(device.location()).toBe(`${LIST}/new`);
    expect(currentTab()).toEqual(["Medications"]);
  });

  test.each([
    ["Schedule", SCHEDULE],
    ["the list", LIST],
    ["Passes", PASSES],
  ])("from %s, Pass opens the add-pass sheet on the Passes tab", async (_, url) => {
    const device = await open(url);
    await choose("Pass");
    await expect.poll(() => !!PASS_FORM()).toBe(true);
    expect(device.location()).toBe(`${PASSES}/new`);
    expect(currentTab()).toEqual(["Passes"]);
    expect(parts().passes).toBe(true);
  });

  test("with 8 passes the menu has no Pass", async () => {
    // The world has Morning and Evening: six more fill the group.
    const more = ["Noon", "Afternoon", "Supper", "Bedtime", "Night", "Late"].map((name, i) =>
      medicationPass({ name, time: `${String(9 + i).padStart(2, "0")}:30`, sortOrder: 2 + i }),
    );
    const device = await open(SCHEDULE, "caretaker", more);
    // The count is a live query: settled, it has answered.
    await device.settle();
    expect(await addMenu()).toEqual(["Medication"]);
  });
});

describe("the add sheet over a tab", () => {
  test("over Schedule: + Medication opens it there, with Schedule still underneath and marked; Cancel goes back to Schedule", async () => {
    const device = await open(SCHEDULE);
    await choose("Medication");
    await expect.poll(() => !!FORM()).toBe(true);
    expect(device.location()).toBe(`${SCHEDULE}/new`);
    expect(parts().today).toBe(true);
    expect(currentTab()).toEqual(["Schedule"]);
    const cancel = [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel")!;
    await userEvent.click(cancel);
    await expect.poll(() => !SHEET() && device.location()).toBe(SCHEDULE);
    expect(parts().today).toBe(true);
  });

  test("over the list: + Medication carries the search, the filtered list stays underneath, and Cancel comes back to it with the search kept", async () => {
    const device = await open(`${LIST}?q=done`);
    await expect.poll(() => listNames("Current medications")).toEqual(["Donepezil 5 mg"]);
    await choose("Medication");
    await expect.poll(() => !!FORM()).toBe(true);
    expect(device.location()).toBe(`${LIST}/new?q=done`);
    expect(listNames("Current medications")).toEqual(["Donepezil 5 mg"]);
    expect(currentTab()).toEqual(["Medications"]);
    const cancel = [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel")!;
    await userEvent.click(cancel);
    await expect.poll(() => !SHEET() && device.location()).toBe(`${LIST}?q=done`);
    expect(document.querySelector<HTMLInputElement>('main input[type="search"]')?.value).toBe("done");
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
  test.each([SCHEDULE, LIST, PASSES])("is one h1, Medications, on %s", async (url) => {
    await open(url);
    await expect.poll(() => document.querySelector("main h1")?.textContent).toBe("Medications");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
