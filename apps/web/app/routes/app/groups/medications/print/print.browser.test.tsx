import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { found } from "../../../../../../test/found";
import { renderWithDevice } from "../../../../../../test/device";
import { allergy, condition } from "../../../../../../test/fixtures";
import { $, $$, LIST, MEDICATION_ROUTES, SEEDED_CURRENT, waitUntil, world } from "../medicationWorld";

// The printable sheets (medications.mjs's print, weekly and their offline
// steps): the list's Print menu with both sheets; the medication list's
// recipient, date of birth, group and day, current medications with their
// prescribers, stopped ones with how and why, and the prescriber's and
// pharmacy's first phones; Print calling window.print(); the weekly chart's
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

const PRINT_MENU = () => $$<HTMLButtonElement>("main button").find((b) => b.textContent?.trim() === "Print");
/** A Print menu item, by the start of its text (its description follows). */
const printItem = (label: string) =>
  $$("[role=menuitem]").find((m) => m.textContent?.trim().startsWith(label));
const choosePrint = async (label: string) => {
  await waitUntil(() => !!PRINT_MENU(), 4000, "the Print menu");
  await userEvent.click(await found(PRINT_MENU));
  await waitUntil(() => !!printItem(label), 4000, `the menu item ${label}`);
  await userEvent.click(printItem(label)!);
};

const printField = (f: string) => $(`main [data-print-field="${f}"]`)?.textContent?.trim() ?? null;
const titleOf = (r: Element) => r.querySelector("[data-print-title]")?.firstChild?.textContent?.trim() ?? "";
const sheetState = () => ({
  name: printField("name"),
  dob: printField("dateOfBirth"),
  group: printField("group"),
  printed: printField("printed"),
  current: $$("main tr[data-print-medication]").map(titleOf),
  prescribers: Object.fromEntries(
    $$("main tr[data-print-medication]").map((r) => [
      titleOf(r),
      r.querySelector("[data-print-prescriber]")?.textContent?.trim(),
    ]),
  ),
  stopped: $$("main tr[data-print-stopped]").map((r) => [
    r.querySelector("[data-print-title]")?.textContent?.trim(),
    r.querySelector("[data-print-when]")?.textContent?.trim(),
    r.querySelector("[data-print-why]")?.textContent?.trim(),
  ]),
  contacts: $$("main tr[data-print-contact]").map((r) => [
    r.querySelector("[data-print-title]")?.textContent?.trim(),
    r.querySelector("[data-print-phone]")?.firstChild?.textContent?.trim(),
  ]),
});

/** What printing shows: the frame and every control hidden, black on white, nothing wider than the page. */
const shown = (el: Element | null) =>
  !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
const printLayout = (sheet: string, cell: string) => {
  const tables = $$(`main ${sheet} table`);
  return {
    header: shown($("header.navbar")),
    tabBar: shown($('nav.dock[aria-label="Group sections"]')),
    controls: $$("button, a.btn, input, [role=button]")
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
    color: getComputedStyle($(`main ${sheet} h1`)!).color,
    cell: getComputedStyle($(`main ${sheet} ${cell}`)!).color,
  };
};
const BLACK_ON_WHITE = { background: "rgb(255, 255, 255)", color: "rgb(0, 0, 0)", cell: "rgb(0, 0, 0)" };

afterEach(async () => {
  vi.restoreAllMocks();
  await commands.media(null);
});

describe("the medication list sheet", () => {
  test("the Print menu offers both sheets; the list opens with the recipient, date of birth, group and day printed", async () => {
    const device = await open(LIST);
    await waitUntil(() => !!PRINT_MENU(), 4000, "the Print menu");
    await userEvent.click(await found(PRINT_MENU));
    await waitUntil(() => !!printItem("Weekly chart"), 4000, "the menu");
    expect($$("[role=menuitem]").map((m) => m.querySelector(".truncate")?.textContent?.trim())).toEqual([
      "Medication list",
      "Weekly chart",
    ]);
    await userEvent.keyboard("{Escape}");
    await choosePrint("Medication list");
    await expect.poll(device.location).toBe(`${LIST}/print`);
    await waitUntil(() => $$("main [data-print-medication]").length >= 4, 4000, "the sheet");
    const sheet = sheetState();
    expect(sheet.name).toContain("Grandma June");
    expect(sheet.dob).toBe("Mar 14, 1941");
    expect(sheet.group).toBe("Moreno Family");
    expect(sheet.printed).toMatch(/^\w{3} \d{1,2}, \d{4}$/);
  });

  test("current medications by name with their prescriber; the completed and discontinued ones, most recently stopped first, with why; the prescriber's and pharmacy's first phones, once each", async () => {
    await open(`${LIST}/print`);
    await waitUntil(() => $$("main [data-print-medication]").length >= 4, 4000, "the sheet");
    const sheet = sheetState();
    expect(sheet.current).toEqual(SEEDED_CURRENT);
    expect(sheet.prescribers["Lisinopril 10 mg"]).toBe("Dr. Mira Lark");
    expect(sheet.prescribers["Latanoprost 0.005%"]).toBe("");
    expect(sheet.stopped).toHaveLength(2);
    expect(sheet.stopped[0]![0]).toBe("Amoxicillin 500 mg");
    expect(sheet.stopped[0]![1]).toMatch(/^Completed \w{3} \d{1,2}, \d{4}$/);
    expect(sheet.stopped[1]![0]).toMatch(/^Oxybutynin/);
    expect(sheet.stopped[1]![1]).toMatch(/^Discontinued \w{3} \d{1,2}, \d{4}$/);
    expect(sheet.stopped[1]![2]).toMatch(/^Side effects/);
    expect(sheet.contacts).toEqual([
      ["Dr. Mira Lark", "(555) 010-2200 x214"],
      ["Elm Street Pharmacy", "(555) 010-4400"],
    ]);
  });

  test("the active conditions follow the allergies, past ones left out", async () => {
    await open(`${LIST}/print`);
    await waitUntil(() => !!$("main [data-print-conditions]"), 4000, "the conditions block");
    const conditions = $("main [data-print-conditions]")!;
    expect($$("main [data-print-condition]").map((c) => c.textContent?.trim())).toEqual([
      "Type 2 diabetes (since 2015)",
    ]);
    expect(conditions.textContent).not.toContain("Hip fracture");
    expect(
      $("main [data-print-allergies]")!.compareDocumentPosition(conditions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("Print calls window.print()", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    await open(`${LIST}/print`);
    await waitUntil(() => !!PRINT_MENU(), 4000, "the Print button");
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
      await open(`${LIST}/print`, { width, theme });
      await waitUntil(() => $$("main [data-print-medication]").length >= 4, 4000, "the sheet");
      await commands.media("print");
      const layout = printLayout("[data-print-sheet]", "td");
      expect(layout).toMatchObject({
        header: false,
        tabBar: false,
        controls: [],
        tables: 3,
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
    days: $$("main th[data-week-day]").map((d) => d.dataset.weekDay),
    weekdays: $$("main th[data-week-day]").map((d) => d.firstChild?.textContent?.trim()),
    groups: $$("main tbody[data-week-group]").map((g) => [
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
    asNeededLines: $$("main tr[data-week-as-needed]").length,
    boxes: $$("main tr[data-week-row] td[data-week-cell]").length,
    rows: $$("main tr[data-week-row]").length,
  });
  const firstDay = () => $("main th[data-week-day]")?.dataset.weekDay;
  const onWeek = () => !!$("main [data-week-sheet]") && $$("main tr[data-week-row]").length >= 4;

  test("from the Print menu: this week, Monday to Sunday; the scheduled medications under their passes with amounts, then times of their own, then as-needed lines, a box a day; the allergies first", async () => {
    const device = await open(LIST);
    await choosePrint("Weekly chart");
    await waitUntil(onWeek, 4000, "the weekly chart");
    expect(device.location()).toBe(`${LIST}/print/week`);
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
    const allergies = $("main [data-print-allergies]")!;
    expect(allergies.textContent).toContain("Penicillin");
    expect(
      allergies.compareDocumentPosition($("main [data-week-table]")!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(printField("name")).toContain("Grandma June");
    const conditions = $("main [data-print-conditions]")!;
    expect(conditions.textContent).toContain("Type 2 diabetes (since 2015)");
    expect(allergies.compareDocumentPosition(conditions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("Next, Previous and This week move it by a week; a start day of its own shows that week, seven days across the clock change", async () => {
    const device = await open(`${LIST}/print/week`);
    await waitUntil(onWeek, 4000, "the weekly chart");
    const start = monday();
    await userEvent.click($("main [data-week-next]")!);
    await expect.poll(firstDay).toBe(shiftDay(start, 7));
    await userEvent.click($("main [data-week-previous]")!);
    await userEvent.click($("main [data-week-previous]")!);
    await expect.poll(firstDay).toBe(shiftDay(start, -7));
    await userEvent.click($("main [data-week-this]")!);
    await expect.poll(firstDay).toBe(start);
    expect($("main [data-week-this]")?.getAttribute("aria-current")).toBe("true");

    await userEvent.fill($<HTMLInputElement>("main input[data-week-start]")!, "2026-10-26");
    await expect.poll(firstDay).toBe("2026-10-26");
    expect(device.location()).toBe(`${LIST}/print/week?start=2026-10-26`);
    const dst = weekState();
    expect(dst.days).toEqual(weekOf("2026-10-26"));
    expect([dst.days[6], dst.weekdays[6]]).toEqual(["2026-11-01", "Sun"]);
  });

  test.each([
    [420, "light"],
    [1280, "light"],
    [1280, "dark"],
  ] as const)(
    "printed at %i (%s theme): no frame or controls, within the page, black on white, on a landscape page",
    async (width, theme) => {
      await open(`${LIST}/print/week`, { width, theme });
      await waitUntil(onWeek, 4000, "the weekly chart");
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
      const box = $("main td[data-week-cell] span span");
      expect(box && getComputedStyle(box).borderTopColor).toBe("rgb(0, 0, 0)");
      // Its page is the landscape `@page weekly`.
      expect(getComputedStyle($("main:has([data-week-sheet])")!).getPropertyValue("page")).toBe("weekly");
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
