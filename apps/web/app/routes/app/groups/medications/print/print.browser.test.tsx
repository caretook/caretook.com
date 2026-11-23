import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../../test/found";
import { getByCss } from "../../../../../../test/locators";
import { renderWithDevice } from "../../../../../../test/device";
import { allergy, condition } from "../../../../../../test/fixtures";
import { LIST, MEDICATION_ROUTES, MEDS, SCHEDULE, world } from "../medicationWorld";

// The printable sheets (medications.mjs's print, weekly and their offline
// steps): the list's Print menu with both sheets; the medication list's
// recipient, date of birth, group and day, current medications with their
// prescribers, stopped ones with how and why, and the prescriber's and
// pharmacy's first phones (their order, groups and wording are
// printSheet.test.ts's); Print calling window.print(); the weekly chart's
// days in the recipient's zone, its passes with amounts, times of their own
// and as-needed lines, the allergies first, and the week picker (across the
// fall clock change); and in print media at 420 and 1280, no frame or
// controls, everything within the page, black on white in the dark theme
// too, the weekly chart on a landscape page. The device is offline
// throughout, so the sheets here open offline too. How many sheets of paper
// the chart takes is a by-hand check (headless Chrome's PDF is the outer
// page's, not this frame's); printSheet.test.ts and weeklySheet.test.ts have
// the sheets' rules.

const PENICILLIN = allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" });
const DIABETES = condition({ name: "Type 2 diabetes", sinceYear: 2015 });
const PAST = condition({ name: "Hip fracture", status: "resolved", sinceYear: 2019 });
const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({
    route: MEDICATION_ROUTES,
    url,
    fixtures: [world(), PENICILLIN, DIABETES, PAST],
    frame: true,
    ...options,
  });

const PRINT_MENU = () =>
  [...document.querySelectorAll<HTMLButtonElement>("main button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === "Print",
  );
/** A Print menu item, by the start of its text (its description follows). */
const printItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) =>
    m.textContent?.trim().startsWith(label),
  );
const choosePrint = async (label: string) => {
  await waitUntil(() => !!PRINT_MENU(), "the Print menu");
  await userEvent.click(await found(PRINT_MENU));
  await waitUntil(() => !!printItem(label), `the menu item ${label}`);
  await userEvent.click(await found(() => printItem(label)));
};

const printField = (f: string) =>
  document.querySelector<HTMLElement>(`main [data-print-field="${f}"]`)?.textContent?.trim() ?? null;
const titleOf = (r: Element) => r.querySelector("[data-print-title]")?.firstChild?.textContent?.trim() ?? "";
const sheetState = () => ({
  name: printField("name"),
  dob: printField("dateOfBirth"),
  group: printField("group"),
  printed: printField("printed"),
  current: [...document.querySelectorAll<HTMLElement>("main tr[data-print-medication]")].map(titleOf),
  prescribers: Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>("main tr[data-print-medication]")].map((r) => [
      titleOf(r),
      r.querySelector("[data-print-prescriber]")?.textContent?.trim(),
    ]),
  ),
  stopped: [...document.querySelectorAll<HTMLElement>("main tr[data-print-stopped]")].map((r) => [
    r.querySelector("[data-print-title]")?.textContent?.trim(),
    r.querySelector("[data-print-when]")?.textContent?.trim(),
    r.querySelector("[data-print-why]")?.textContent?.trim(),
  ]),
  contacts: [...document.querySelectorAll<HTMLElement>("main tr[data-print-contact]")].map((r) => [
    r.querySelector("[data-print-title]")?.textContent?.trim(),
    r.querySelector("[data-print-phone]")?.firstChild?.textContent?.trim(),
  ]),
});

/** What printing shows: the frame and every control hidden, black on white, nothing wider than the page. */
const shown = (el: Element | null) =>
  !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
const printLayout = (sheet: string, cell: string) => {
  const tables = [...document.querySelectorAll<HTMLElement>(`main ${sheet} table`)];
  return {
    header: shown(document.querySelector<HTMLElement>("header.navbar")),
    tabBar: shown(document.querySelector<HTMLElement>('nav[data-tab-bar][aria-label="Group sections"]')),
    controls: [...document.querySelectorAll<HTMLElement>("button, a.btn, input, [role=button]")]
      .filter(shown)
      .map((el) => el.textContent?.trim() || el.tagName),
    tables: tables.length,
    fits: tables.every(
      (t) =>
        t.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5 &&
        t.scrollWidth <= t.clientWidth + 1,
    ),
    pageFits: document.documentElement.scrollWidth <= innerWidth,
    background: getComputedStyle(document.body).backgroundColor,
    color: getComputedStyle(document.querySelector<HTMLElement>(`main ${sheet} h1`)!).color,
    cell: getComputedStyle(document.querySelector<HTMLElement>(`main ${sheet} ${cell}`)!).color,
  };
};
const BLACK_ON_WHITE = { background: "rgb(255, 255, 255)", color: "rgb(0, 0, 0)", cell: "rgb(0, 0, 0)" };

afterEach(async () => {
  vi.restoreAllMocks();
  await commands.media(null);
});

/** The page's Back link ("← Medications"). */
const backHref = () =>
  [...document.querySelectorAll<HTMLElement>("main a")]
    .find((a) => a.textContent?.trim() === "Medications")
    ?.getAttribute("href") ?? null;

describe("the medication list sheet", () => {
  test("the Print menu offers both sheets; the list opens with the recipient, date of birth, group and day printed, Back going to the list", async () => {
    const device = await open(LIST);
    await waitUntil(() => !!PRINT_MENU(), "the Print menu");
    await userEvent.click(await found(PRINT_MENU));
    await waitUntil(() => !!printItem("Weekly chart"), "the menu");
    expect(
      [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].map((m) =>
        m.querySelector(".truncate")?.textContent?.trim(),
      ),
    ).toEqual(["Medication list", "Weekly chart"]);
    await userEvent.keyboard("{Escape}");
    // The closing menu fades with the same label as its button, so wait for it to go.
    await waitUntil(() => !document.querySelector("[role=menu]"), "the menu to close");
    await choosePrint("Medication list");
    await expect.poll(device.location).toBe(`${MEDS}/print`);
    await waitUntil(
      () => [...document.querySelectorAll<HTMLElement>("main [data-print-medication]")].length >= 4,
      "the sheet",
    );
    const sheet = sheetState();
    expect(sheet.name).toContain("Grandma June");
    expect(sheet.dob).toBe("Mar 14, 1941");
    expect(sheet.group).toBe("Moreno Family");
    expect(sheet.printed).toMatch(/^\w{3} \d{1,2}, \d{4}$/);
    expect(backHref()).toBe(LIST);
  });

  test("the sheet shows each current medication with its prescriber, the stopped ones with why, and the contacts' phones", async () => {
    await open(`${MEDS}/print`);
    await waitUntil(
      () => [...document.querySelectorAll<HTMLElement>("main [data-print-medication]")].length >= 4,
      "the sheet",
    );
    const sheet = sheetState();
    // Their order, grouping and wording are printSheet.test.ts's.
    expect(sheet.current).toHaveLength(4);
    expect(sheet.prescribers["Lisinopril 10 mg"]).toBe("Dr. Mira Lark");
    expect(sheet.stopped).toHaveLength(2);
    expect(sheet.stopped.some(([, , why]) => why?.startsWith("Side effects"))).toBe(true);
    expect(sheet.contacts).toContainEqual(["Elm Street Pharmacy", "(555) 010-4400"]);
  });

  test("the active conditions follow the allergies, past ones left out", async () => {
    await open(`${MEDS}/print`);
    const conditions = await found(() => document.querySelector("main [data-print-conditions]"), {
      message: "the conditions block",
    });
    const allergies = await found(() => document.querySelector("main [data-print-allergies]"));
    expect(
      [...document.querySelectorAll<HTMLElement>("main [data-print-condition]")].map((c) =>
        c.textContent?.trim(),
      ),
    ).toEqual(["Type 2 diabetes (since 2015)"]);
    expect(conditions.textContent).not.toContain("Hip fracture");
    expect(allergies.compareDocumentPosition(conditions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("Print calls window.print()", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await open(`${MEDS}/print`);
    await waitUntil(() => !!PRINT_MENU(), "the Print button");
    await userEvent.click(await found(PRINT_MENU));
    expect(print).toHaveBeenCalledTimes(1);
  });

  test.each([
    [420, "light"],
    [1280, "light"],
    [1280, "dark"],
  ] as const)(
    "printed at %i (%s theme): no header, tab bar or buttons, the tables within the page, black on white",
    async (width, theme) => {
      await open(`${MEDS}/print`, { width, theme });
      await waitUntil(
        () => [...document.querySelectorAll<HTMLElement>("main [data-print-medication]")].length >= 4,
        "the sheet",
      );
      await commands.media("print");
      const layout = printLayout("[data-print-sheet]", "td");
      expect(layout).toMatchObject({
        header: false,
        tabBar: false,
        controls: [],
        tables: 4, // a table for each type group (Prescriptions, Over the counter), the stopped ones and the contacts
        fits: true,
        pageFits: true,
        ...BLACK_ON_WHITE,
      });
    },
  );
});

describe("the weekly chart", () => {
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  /** This week's Monday (the test browser's zone is the recipient's), and a day moved by `n`. */
  const shiftDay = (day: string, n: number) => {
    const d = new Date(`${day}T12:00:00`);
    d.setDate(d.getDate() + n);
    return ymd(d);
  };
  const monday = () => {
    const d = new Date();
    return shiftDay(ymd(d), -((d.getDay() + 6) % 7));
  };
  const weekOf = (start: string) => Array.from({ length: 7 }, (_, i) => shiftDay(start, i));

  const weekState = () => ({
    days: [...document.querySelectorAll<HTMLElement>("main th[data-week-day]")].map((d) => d.dataset.weekDay),
    weekdays: [...document.querySelectorAll<HTMLElement>("main th[data-week-day]")].map((d) =>
      d.firstChild?.textContent?.trim(),
    ),
    groups: [...document.querySelectorAll<HTMLElement>("main tbody[data-week-group]")].map((g) => [
      g.querySelector("[data-week-group-name]")?.textContent?.trim(),
      [...g.querySelectorAll("tr[data-week-row], tr[data-week-as-needed] th")]
        .map((r) => {
          const th = r.matches("th") ? r : r.querySelector("th")!;
          return [
            th.querySelector("[data-week-title]")?.textContent?.trim(),
            [...th.querySelectorAll(".block")].map((m) => m.textContent?.trim()),
          ];
        })
        .filter(([t]) => t),
    ]),
    asNeededLines: [...document.querySelectorAll<HTMLElement>("main tr[data-week-as-needed]")].length,
    boxes: [...document.querySelectorAll<HTMLElement>("main tr[data-week-row] td[data-week-cell]")].length,
    rows: [...document.querySelectorAll<HTMLElement>("main tr[data-week-row]")].length,
  });
  const firstDay = () => document.querySelector<HTMLElement>("main th[data-week-day]")?.dataset.weekDay;
  const onWeek = () =>
    !!document.querySelector<HTMLElement>("main [data-week-sheet]") &&
    [...document.querySelectorAll<HTMLElement>("main tr[data-week-row]")].length >= 4;

  test("from Schedule's Print menu: this week, Monday to Sunday; the scheduled medications under their passes with amounts, then times of their own, then as-needed lines, a box a day; the allergies first; Back goes to Schedule", async () => {
    const device = await open(SCHEDULE);
    await choosePrint("Weekly chart");
    await waitUntil(onWeek, "the weekly chart");
    expect(device.location()).toBe(`${MEDS}/print/week`);
    expect(backHref()).toBe(SCHEDULE);
    const sheet = weekState();
    expect(sheet.days).toEqual(weekOf(monday()));
    expect([sheet.weekdays[0], sheet.weekdays[6]]).toEqual(["Mon", "Sun"]);
    expect(sheet.groups).toEqual([
      [
        "Morning · 8:00",
        [
          ["Lisinopril 10 mg", ["1 tablet"]],
          ["Metformin 500 mg", ["1 tablet"]],
        ],
      ],
      ["Evening · 20:00", [["Metformin 500 mg", ["1 tablet"]]]],
      ["21:00", [["Latanoprost 0.005%", ["1 drop in each eye"]]]],
      ["As needed · write the time", [["Acetaminophen 500 mg", ["2 tablets", "Up to 4 a day"]]]],
    ]);
    expect(sheet.boxes).toBe(sheet.rows * 7);
    expect(sheet.asNeededLines).toBeGreaterThanOrEqual(2);
    const allergies = await found(() => document.querySelector("main [data-print-allergies]"));
    const table = await found(() => document.querySelector("main [data-week-table]"));
    expect(allergies.textContent).toContain("Penicillin");
    expect(allergies.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(printField("name")).toContain("Grandma June");
    const conditions = document.querySelector<HTMLElement>("main [data-print-conditions]")!;
    expect(conditions.textContent).toContain("Type 2 diabetes (since 2015)");
    expect(allergies.compareDocumentPosition(conditions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("Next, Previous and This week move it by a week; a start day of its own shows that week (seven days across a clock change is weeklySheet.test.ts's)", async () => {
    const device = await open(`${MEDS}/print/week`);
    await waitUntil(onWeek, "the weekly chart");
    const start = monday();
    await userEvent.click(getByCss("main [data-week-next]"));
    await expect.poll(firstDay).toBe(shiftDay(start, 7));
    await userEvent.click(getByCss("main [data-week-previous]"));
    await userEvent.click(getByCss("main [data-week-previous]"));
    await expect.poll(firstDay).toBe(shiftDay(start, -7));
    await userEvent.click(getByCss("main [data-week-this]"));
    await expect.poll(firstDay).toBe(start);
    expect(document.querySelector<HTMLElement>("main [data-week-this]")?.getAttribute("aria-current")).toBe(
      "true",
    );

    await userEvent.fill(getByCss("main input[data-week-start]"), "2026-10-26");
    await expect.poll(firstDay).toBe("2026-10-26");
    expect(device.location()).toBe(`${MEDS}/print/week?start=2026-10-26`);
  });

  test.each([
    [420, "light"],
    [1280, "light"],
    [1280, "dark"],
  ] as const)(
    "printed at %i (%s theme): no frame or controls, within the page, black on white, on a landscape page",
    async (width, theme) => {
      await open(`${MEDS}/print/week`, { width, theme });
      await waitUntil(onWeek, "the weekly chart");
      await commands.media("print");
      const layout = printLayout("[data-week-sheet]", "th[data-week-day]");
      expect(layout).toMatchObject({
        header: false,
        tabBar: false,
        controls: [],
        fits: true,
        pageFits: true,
        ...BLACK_ON_WHITE,
      });
      const box = document.querySelector<HTMLElement>("main td[data-week-cell] span span");
      expect(box && getComputedStyle(box).borderTopColor).toBe("rgb(0, 0, 0)");
      // Its page is the landscape `@page weekly`.
      const sheet = await found(() => document.querySelector("main:has([data-week-sheet])"));
      expect(getComputedStyle(sheet).getPropertyValue("page")).toBe("weekly");
      const rules = [...document.styleSheets].flatMap((s) => {
        try {
          return [...s.cssRules];
        } catch {
          return [];
        }
      });
      const pageRules = rules.flatMap((r) => (r instanceof CSSMediaRule ? [...r.cssRules] : [r]));
      const weekly = pageRules.find(
        (r): r is CSSPageRule => r instanceof CSSPageRule && r.selectorText === "weekly",
      );
      expect(weekly?.style.getPropertyValue("size")).toBe("landscape");
    },
  );
});
