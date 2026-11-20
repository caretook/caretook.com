import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { fx, medicationPass } from "../../../../../../test/fixtures";
import { $, juneAge, openProfile, PRINT_URL, SAM } from "../profileWorld";

// The emergency sheet as a page (profiles.mjs's slice 6 steps): the
// profile's Print link, what the sheet shows from the device, the Print
// button, offline, and how it prints (print media at 420 and 1280, light and
// dark: no frame or controls, black on white, within one Letter page). The
// sheet's content rules are unit-tested (emergencyPrintSheet.test.ts), its
// allergies in emergencyPrintSheet.browser.test.tsx, and a viewer landing on
// the profile in ../profile.browser.test.tsx.

const SECTIONS = [
  "basics",
  "note",
  "contact",
  "insurance",
  "emergency",
  "medications",
  "allergies",
  "careTeam",
];

const PHARMACY = fx.provider({ type: "pharmacy", name: "Birch Street Pharmacy", specialty: null });
const DOCTOR = fx.provider({ name: "Dr. Mira Lark", isPrimary: 1 });
const MORNING = medicationPass({ name: "Morning", time: "08:00", sortOrder: 0 });
const EVENING = medicationPass({ name: "Evening", time: "20:00", sortOrder: 1 });
const MEDICATIONS = [
  fx.medication({
    name: "Metformin",
    strength: "500 mg",
    pharmacyId: PHARMACY.id,
    schedule: {
      type: "scheduled",
      slots: [{ passId: MORNING.id }, { passId: EVENING.id }],
    },
  }),
  fx.medication({ name: "Lisinopril", strength: "10 mg" }),
  fx.medication({ name: "Warfarin", strength: "5 mg", status: "discontinued" }),
];
const WORLD = [PHARMACY, DOCTOR, MORNING, EVENING, MEDICATIONS];

const sheet = () => $("main [data-emergency-sheet]");
const names = (sel: string) =>
  [...(sheet()?.querySelectorAll(sel) ?? [])].map(
    (el) =>
      (el.querySelector("[data-sheet-name]")?.textContent?.trim() ?? "") +
      (el.hasAttribute("data-primary") ? "*" : ""),
  );
const sheetSections = () =>
  [...(sheet()?.querySelectorAll<HTMLElement>("[data-sheet-section]") ?? [])].map(
    (s) => s.dataset.sheetSection,
  );

/** What printing shows: no frame or controls, black on white, nothing wider than the page. */
const printLayout = () => {
  const shown = (el: Element | null) =>
    !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const s = sheet()!;
  return {
    header: shown($("header.navbar")),
    tabBar: shown($('nav.dock[aria-label="Group sections"]')),
    controls: [...document.querySelectorAll("button, a.btn, input, [role=button]")]
      .filter(shown)
      .map((el) => el.textContent?.trim() || el.tagName),
    fits:
      s.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5 &&
      s.scrollWidth <= s.clientWidth + 1,
    pageFits: document.documentElement.scrollWidth <= innerWidth,
    background: getComputedStyle(document.body).backgroundColor,
    heading: getComputedStyle(s.querySelector("h1, [data-sheet-field=name]")!).color,
    text: getComputedStyle(s.querySelector("[data-sheet-section] li, [data-sheet-section] p")!).color,
  };
};

const CLEAN = {
  header: false,
  tabBar: false,
  controls: [],
  fits: true,
  pageFits: true,
  background: "rgb(255, 255, 255)",
  heading: "rgb(0, 0, 0)",
  text: "rgb(0, 0, 0)",
};

afterEach(async () => {
  await commands.printMedia(false);
  vi.restoreAllMocks();
});

describe("the emergency sheet", () => {
  test("the profile's Print link opens it: the name, birthday, age and day printed, every section in order, the contacts and team", async () => {
    const device = await openProfile({ fixtures: WORLD });
    await userEvent.click(page.getByRole("link", { name: "Print emergency sheet" }));
    await expect.poll(device.location).toBe(PRINT_URL);
    await expect.poll(sheetSections).toEqual(SECTIONS);
    const field = (f: string) => sheet()!.querySelector(`[data-sheet-field="${f}"]`)?.textContent?.trim();
    expect(field("name")).toBe("June Moreno (Grandma June)");
    expect(field("born")).toBe(`Born June 2, 1940 · ${juneAge()}`);
    expect(field("printed")).toMatch(/^Printed \w{3} \d{1,2}, \d{4}$/);
    expect(sheet()!.querySelector('[data-sheet-basic="codeStatus"] dd')?.textContent?.trim()).toBe("DNR");
    expect(sheet()!.querySelectorAll("[data-sheet-plan]")).toHaveLength(2);
    expect(names("[data-sheet-contact]")).toEqual(["Alex Moreno*", SAM.name, "Nora Example"]);
    expect(
      sheet()!.querySelector('[data-sheet-contact][data-primary] [data-sheet-badge="primary"]'),
    ).not.toBeNull();
    expect(names("[data-sheet-medication]")).toEqual(["Lisinopril 10 mg", "Metformin 500 mg"]);
    expect(
      [...sheet()!.querySelectorAll("[data-sheet-medication]")].find((m) =>
        m.textContent?.startsWith("Metformin"),
      )?.textContent,
    ).toMatch(/1 tablet · Morning and Evening/);
    expect(names("[data-sheet-provider]")).toEqual(["Dr. Mira Lark", "Birch Street Pharmacy"]);
  });

  test("Print calls the browser's print", async () => {
    await openProfile({ url: PRINT_URL, fixtures: WORLD });
    await expect.poll(sheetSections).toEqual(SECTIONS);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await userEvent.click(page.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  test("offline, it opens from the device's copy and prints", async () => {
    await openProfile({ url: PRINT_URL, fixtures: WORLD, connected: false });
    await expect.poll(sheetSections).toEqual(SECTIONS);
    expect(names("[data-sheet-contact]")).toEqual(["Alex Moreno*", SAM.name, "Nora Example"]);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await userEvent.click(page.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  test.each([
    [420, "light"],
    [1280, "light"],
    [1280, "dark"],
  ] as const)(
    "printed at %i (%s): no frame or controls, black on white, within the page",
    async (width, theme) => {
      await openProfile({ url: PRINT_URL, fixtures: WORLD, frame: true, width, theme });
      await expect.poll(sheetSections).toEqual(SECTIONS);
      expect(printLayout().header).toBe(true);
      await commands.printMedia(true);
      await expect.poll(printLayout).toEqual(CLEAN);
    },
  );

  test("printed on Letter (12 mm margins), it's one page", async () => {
    // The page's printable box at 96 px to the inch: 8.5 × 11 in less the margins.
    const margin = (12 / 25.4) * 96;
    const [width, height] = [8.5 * 96 - 2 * margin, 11 * 96 - 2 * margin];
    await openProfile({ url: PRINT_URL, fixtures: WORLD, frame: true, width: Math.floor(width) });
    await expect.poll(sheetSections).toEqual(SECTIONS);
    await commands.printMedia(true);
    await expect.poll(() => $("main")!.getBoundingClientRect().height).toBeLessThanOrEqual(height);
    // Laid out for print, not collapsed: most of the page is used.
    expect($("main")!.getBoundingClientRect().height).toBeGreaterThan(height / 2);
  });
});
