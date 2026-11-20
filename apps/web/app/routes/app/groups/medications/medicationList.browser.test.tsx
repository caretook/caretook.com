import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import {
  $,
  $$,
  dayAgo,
  LIST,
  LISINOPRIL,
  listNames,
  MEDICATION_ROUTES,
  OXYBUTYNIN,
  rowText,
  SEEDED_CURRENT,
  SEEDED_STOPPED,
  world,
} from "./medicationWorld";

// The medication list (medications.mjs's list, search, status, tab, viewer
// and offline steps): the Medications section current in the tab bar (420)
// and the header (1280), current medications first by name and then the
// completed and discontinued ones with how and when they stopped, search and
// the status chips in the URL (kept when the page loads again), a viewer's
// list, and a medication stopped on another device moving down. The device
// is offline throughout, so every screen here is the offline one too. The
// tabs' order is frame.browser.test.tsx's; the list's order and matching
// rules are medicationList.test.ts's.

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: MEDICATION_ROUTES, url: LIST, fixtures: world(), ...options });

const TAB_BAR = 'nav.dock[aria-label="Group sections"]';
const HEADER_NAV = 'header [data-region="sections"] nav[aria-label="Group sections"]';
const current = (nav: string) =>
  $$(`${nav} a`)
    .filter((a) => a.getAttribute("aria-current") === "page")
    .map((a) => a.textContent?.trim());
const CURRENT = "Current medications";
const STOPPED = "Completed and discontinued medications";
const SEARCH = () => $<HTMLInputElement>('main input[type="search"]')!;
const chip = (label: string) =>
  $$<HTMLAnchorElement>('main nav[aria-label="Show medications"] a').find(
    (a) => a.textContent?.trim() === label,
  )!;
const currentChip = () =>
  $('main nav[aria-label="Show medications"] [aria-current="true"]')?.textContent?.trim();

describe("the list", () => {
  test("at 420 the tab bar has Medications current, and its link is the list; at 1280 the header's link is", async () => {
    const device = await open({ frame: true });
    await expect.element(page.getByRole("heading", { name: "Medications", level: 1 })).toBeVisible();
    expect(current(TAB_BAR)).toEqual(["Medications"]);
    const tab = $$<HTMLAnchorElement>(`${TAB_BAR} a`).find((a) => a.textContent?.trim() === "Medications")!;
    expect(tab.getAttribute("href")).toBe(LIST);
    await device.screen.unmount();

    await open({ frame: true, width: 1280 });
    await expect.element(page.getByRole("heading", { name: "Medications", level: 1 })).toBeVisible();
    expect(getComputedStyle($(HEADER_NAV)!).display).not.toBe("none");
    expect(current(HEADER_NAV)).toEqual(["Medications"]);
  });

  test("current medications first by name, then the completed and discontinued ones; each row's form, dose, schedule and reason, and how a stopped one ended", async () => {
    await open();
    expect(listNames(CURRENT)).toEqual(SEEDED_CURRENT);
    expect(listNames(STOPPED)).toEqual(SEEDED_STOPPED);
    expect(rowText("Metformin", "summary")).toBe("Tablet · 1 tablet · Morning and Evening");
    expect(rowText("Acetaminophen", "summary")).toBe("Tablet · 2 tablets · As needed, up to 4 a day");
    expect(rowText("Lisinopril", "reason")).toBe("Reason: Blood pressure");
    expect(rowText("Oxybutynin", "stopped")).toMatch(/^Discontinued \w{3} \d{1,2}, \d{4} · Side effects$/);
    expect(rowText("Amoxicillin", "stopped")).toMatch(/^Completed \w{3} \d{1,2}, \d{4}$/);
    // The name's link covers the row: a tap anywhere on it opens the page.
    const row = $(`main li[data-medication-id="${OXYBUTYNIN.id}"]`)!;
    expect(row.querySelector("a[data-medication-name]")?.getAttribute("href")).toBe(
      `${LIST}/${OXYBUTYNIN.id}`,
    );
  });

  test("search filters as it's typed (by reason too) and goes in the URL; the URL's search opens filtered", async () => {
    const device = await open();
    await userEvent.fill(SEARCH(), "blood");
    await expect.poll(() => listNames(CURRENT)).toEqual(["Lisinopril 10 mg"]);
    expect(listNames(STOPPED)).toEqual([]);
    await expect.poll(device.location).toBe(`${LIST}?q=blood`);
    await device.screen.unmount();

    await open({ url: `${LIST}?q=blood` });
    expect(SEARCH().value).toBe("blood");
    expect(listNames(CURRENT)).toEqual(["Lisinopril 10 mg"]);
  });

  test("the Discontinued chip shows only Oxybutynin and goes in the URL, which opens filtered; All shows everything again", async () => {
    const device = await open();
    await userEvent.click(chip("Discontinued"));
    await expect.poll(device.location).toBe(`${LIST}?status=discontinued`);
    await expect.poll(() => listNames("Discontinued medications")).toEqual(["Oxybutynin 5 mg"]);
    expect(listNames(CURRENT)).toEqual([]);
    await device.screen.unmount();

    const again = await open({ url: `${LIST}?status=discontinued` });
    await expect.poll(() => listNames("Discontinued medications")).toEqual(["Oxybutynin 5 mg"]);
    expect(listNames(CURRENT)).toEqual([]);
    expect(currentChip()).toBe("Discontinued");
    await userEvent.click(chip("All"));
    await expect.poll(again.location).toBe(LIST);
    await expect.poll(() => listNames(CURRENT)).toEqual(SEEDED_CURRENT);
    expect(listNames(STOPPED)).toEqual(SEEDED_STOPPED);
  });

  test("a viewer sees the list, told it's view-only, with no Add medication", async () => {
    await open({ role: "viewer" });
    expect(listNames(CURRENT)).toEqual(SEEDED_CURRENT);
    expect($("main header p")?.textContent).toContain("You can view this list");
    expect($("main [data-add-medication]")).toBeNull();
  });

  test("a medication stopped on another device moves below the current ones", async () => {
    const device = await open();
    // Another device discontinued it: the row arrives changed.
    await device.sync({
      ...LISINOPRIL,
      row: { ...LISINOPRIL.row, status: "discontinued", stop_reason: "ineffective", stopped_on: dayAgo(0) },
    });
    await device.settle();
    expect(listNames(CURRENT)).toEqual(SEEDED_CURRENT.filter((n) => !n.startsWith("Lisinopril")));
    expect(listNames(STOPPED)).toContain("Lisinopril 10 mg");
  });
});
