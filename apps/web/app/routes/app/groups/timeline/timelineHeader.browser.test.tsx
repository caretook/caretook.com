import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx, TEST_RECIPIENT, TEST_USER } from "../../../../../test/fixtures";
import { TEST_NOW, fixClock, found, waitUntil } from "../../../../../test/found";
import {
  chooseEasyMode,
  frames,
  openTimeline,
  pressEasyMode,
  rows,
  TIMELINE_URL,
  world,
} from "./timelineWorld";

// The timeline's header on a phone and a desktop (quick-fixes slice 39): the
// latest vitals only from `sm`, and the care period in each day's sticky
// header instead of the page's. The + menu is on each day's heading
// (quick-fixes slice 44): today's adds start at now, another day's at 12:00.

const ready = () => waitUntil(() => rows().length > 0, "the first rows");
const addButton = () => page.getByRole("button", { name: "Add to Today" });
const menuItems = () => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')];
const dayHeaders = () => [...document.querySelectorAll<HTMLElement>("[data-day-header]")];
const plusOf = (header: Element) => header.querySelector<HTMLElement>('button[aria-label^="Add to "]');
/** The day header two days back (the filler's): a past day other than Yesterday. */
const pastDay = () => {
  const t = new Date();
  t.setDate(t.getDate() - 2);
  const key = t.toLocaleDateString("en-CA");
  return { key, header: document.getElementById(`day-${key}`)!.closest<HTMLElement>("[data-day-header]")! };
};
/** The sheet's When, as the local "YYYY-MM-DDTHH:mm" it shows, and as a moment. */
const when = () => {
  const value = document.querySelector<HTMLInputElement>('[role=dialog] input[name="occurredAt"]')!.value;
  return { local: value.slice(0, 16), at: new Date(value.replace(/\[.*\]$/, "")).getTime() };
};
const VITAL_LABELS = new Set<string>(VITAL_TYPES.map((t) => VITALS[t].label));
/** + → `name`, expanding Vitals first for a vital type. */
const pick = async (name: string, button: Parameters<typeof userEvent.click>[0] = addButton()) => {
  await userEvent.click(button);
  await expect.element(page.getByRole("menu")).toBeVisible();
  if (VITAL_LABELS.has(name)) await userEvent.click(page.getByRole("menuitem", { name: "Vitals" }));
  await userEvent.click(page.getByRole("menuitem", { name, exact: true }));
};

describe("the heading", () => {
  test("is a plain “Timeline” h1, with no recipient card or profile link in main, and View options still opens", async () => {
    await openTimeline();
    await ready();
    const main = page.getByRole("main");
    await expect
      .element(main.getByRole("heading", { level: 1, name: "Timeline", exact: true }))
      .toBeVisible();
    expect([...document.querySelectorAll("main h1")].map((h) => h.textContent)).toEqual(["Timeline"]);
    expect(main.getByRole("link", { name: /profile/i }).query()).toBeNull();
    expect(document.querySelector("main header")?.textContent).not.toContain(TEST_RECIPIENT.preferredName);
    await userEvent.click(page.getByRole("button", { name: "View options" }));
    await expect.element(page.getByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
  });
});

describe("the Easy mode button", () => {
  const easyButton = () => document.querySelector<HTMLElement>('main header button[data-easy-toggle="easy"]');
  const isEasy = () => !!document.querySelector("[data-easy-timeline]");

  test("a caretaker's header has it beside “Timeline”; pressing it shows the easy view, whose “Full app” returns, and the choice survives a reload", async () => {
    const device = await openTimeline({ role: "caretaker" });
    await ready();
    const button = await found(easyButton);
    expect(button.textContent?.trim()).toBe("Easy mode");
    const h1 = document.querySelector("main h1")!.getBoundingClientRect();
    expect(button.getBoundingClientRect().left).toBeGreaterThan(h1.left);
    await pressEasyMode();
    await waitUntil(isEasy, "the easy view");
    await userEvent.click(page.getByRole("button", { name: "Full app" }));
    await waitUntil(() => !isEasy(), "the full timeline");
    await pressEasyMode();
    await waitUntil(isEasy, "the easy view again");
    await device.screen.unmount();
    await openTimeline({ role: "caretaker" });
    await waitUntil(isEasy, "the easy view after a reload");
  });

  test("View options has Layout and Day summaries and no view switch", async () => {
    await openTimeline({ role: "caretaker" });
    await ready();
    await userEvent.click(page.getByRole("button", { name: "View options" }));
    await expect.element(page.getByRole("menu")).toBeVisible();
    const text = [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((el) =>
      el.textContent?.trim(),
    );
    expect(text.some((t) => t?.startsWith("Rows"))).toBe(true);
    expect(text.some((t) => t?.startsWith("Highlights"))).toBe(true);
    expect(text.some((t) => /easy/i.test(t ?? ""))).toBe(false);
    expect(document.querySelector('[role="menu"]')?.textContent).toMatch(/Layout/);
    expect(document.querySelector('[role="menu"]')?.textContent).toMatch(/Day summaries/);
    await userEvent.keyboard("{Escape}");
  });

  test("a viewer gets the button too", async () => {
    await openTimeline({ role: "viewer" });
    await ready();
    expect(await found(easyButton)).toBeTruthy();
  });

  test("an Easy helper, who can't toggle, has none in either view", async () => {
    await openTimeline({ role: "easy_helper" });
    await waitUntil(isEasy, "the easy view");
    expect(document.querySelector("[data-easy-toggle]")).toBeNull();
    expect(page.getByRole("button", { name: "Full app" }).query()).toBeNull();
  });

  test("at phone width the title and the button share a row, the button 44 px tall", async () => {
    await openTimeline({ role: "caretaker", width: 360 });
    await ready();
    const button = await found(easyButton);
    const h1 = document.querySelector("main h1")!.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.top).toBeLessThan(h1.bottom);
    expect(b.right).toBeLessThanOrEqual(360);
  });

  test("at phone width the button and the title share a vertical center, within 1 px", async () => {
    await openTimeline({ role: "caretaker", width: 360 });
    await ready();
    const button = await found(easyButton);
    const center = (r: DOMRect) => r.top + r.height / 2;
    const h1 = document.querySelector("main h1")!.getBoundingClientRect();
    expect(Math.abs(center(button.getBoundingClientRect()) - center(h1))).toBeLessThanOrEqual(1);
  });
});

describe("the toolbar", () => {
  test("View options sits at the right end of the filter row, after Filter, one circle like it; none in the page header", async () => {
    await openTimeline({ width: 420 });
    await ready();
    const eye = await found(() => document.querySelector<HTMLElement>('button[aria-label="View options"]'));
    const toolbar = document.querySelector<HTMLElement>("[data-timeline-filters]")!;
    expect(toolbar.contains(eye)).toBe(true);
    expect(document.querySelector('main header button[aria-label="View options"]')).toBeNull();
    const filter = toolbar.querySelector<HTMLElement>("button[data-filter-button]")!;
    expect(filter.compareDocumentPosition(eye) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const [f, v] = [filter, eye].map((el) => el.getBoundingClientRect()) as [DOMRect, DOMRect];
    expect([v.width, v.height]).toEqual([f.width, f.height]);
    expect(
      Math.abs(v.right - (filter.parentElement?.getBoundingClientRect().right ?? Number.NaN)),
    ).toBeLessThan(1);
    await userEvent.click(eye);
    await expect.element(page.getByRole("menu", { name: "View options" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
  });
});

describe("the + menu", () => {
  test("a writer's + opens every add kind in the bar's order, Vitals expanding to each vital type; there's no add bar", async () => {
    await openTimeline({ role: "caretaker" });
    await ready();
    expect(document.querySelector('[aria-label="Add to the timeline"]')).toBeNull();
    await userEvent.click(addButton());
    await expect.element(page.getByRole("menu", { name: "Add to Today" })).toBeVisible();
    expect(menuItems().map((el) => el.textContent?.trim())).toEqual([
      "Note",
      "Event",
      "Dose",
      "Symptom",
      "Vitals",
    ]);
    await userEvent.click(page.getByRole("menuitem", { name: "Vitals" }));
    await expect
      .poll(() => menuItems().map((el) => el.textContent?.trim()))
      .toEqual(["Note", "Event", "Dose", "Symptom", "Vitals", ...VITAL_TYPES.map((t) => VITALS[t].label)]);
    await userEvent.keyboard("{Escape}");
  });

  test("every day heading has its own +, named for the day, beside its heading; the timeline header has none", async () => {
    await openTimeline();
    await ready();
    const headers = dayHeaders();
    expect(headers.length).toBeGreaterThan(2);
    for (const header of headers) {
      const label = header.querySelector("h3")!.textContent;
      expect(plusOf(header)?.getAttribute("aria-label")).toBe(`Add to ${label}`);
      // In the day's actions, on the heading's row of the sticky header, and last (the far right).
      const actions = header.querySelector("[data-day-actions]")!;
      expect(actions.parentElement).toBe(header.querySelector("h3")!.parentElement);
      expect(actions.lastElementChild?.contains(plusOf(header))).toBe(true);
    }
    expect(headers[0] && plusOf(headers[0])?.getAttribute("aria-label")).toBe("Add to Today");
    expect(headers[1] && plusOf(headers[1])?.getAttribute("aria-label")).toBe("Add to Yesterday");
    expect(document.querySelector('main > header button[aria-label^="Add to "]')).toBeNull();
  });

  test("Symptom opens the add sheet over the timeline; a vital type opens it with that type; Note opens the new note page", async () => {
    const device = await openTimeline();
    await ready();
    await pick("Symptom");
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(device.location()).toBe(`${TIMELINE_URL}/new/symptom`);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    await pick("Heart rate");
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(device.location()).toBe(`${TIMELINE_URL}/new/vital?type=heartRate`);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    await pick("Note");
    await expect.element(page.getByRole("heading", { name: /^Entry page new/ })).toBeVisible();
    expect(device.location()).toMatch(/\/entries\/new\?kind=note$/);
  });

  test("today's + starts the sheet at now; a past day's + at 12:00 that day", async () => {
    const device = await openTimeline();
    await ready();
    await pick("Symptom");
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    // Now on the test clock: no earlier than its start, no later than this line.
    expect(when().at).toBeGreaterThanOrEqual(TEST_NOW);
    expect(when().at).toBeLessThanOrEqual(Date.now());
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    const { key, header } = pastDay();
    await pick("Symptom", plusOf(header)!);
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(device.location()).toMatch(new RegExp(`^${TIMELINE_URL}/new/symptom\\?at=`));
    expect(when().local).toBe(`${key}T12:00`);
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(TIMELINE_URL);

    // A vital from that day too.
    await pick("Heart rate", plusOf(pastDay().header)!);
    await expect.element(page.getByRole("dialog", { name: "Add to the timeline" })).toBeVisible();
    expect(when().local).toBe(`${key}T12:00`);
  });

  test("a viewer sees no + button", async () => {
    await openTimeline({ role: "viewer" });
    await ready();
    expect(page.getByRole("button", { name: /^Add to / }).query()).toBeNull();
    expect(dayHeaders().length).toBeGreaterThan(2);
    expect(dayHeaders().some(plusOf)).toBe(false);
    expect(page.getByRole("button", { name: "View options" }).query()).not.toBeNull();
  });

  test("a writer's timeline with nothing today still has Today's +", async () => {
    await openTimeline({ fixtures: [fx.symptom({ name: "Sore knee", occurredAt: at(pastNoon(3)) })] });
    await waitUntil(() => rows().length === 1, "the row");
    const headers = dayHeaders();
    expect(headers.map((h) => h.querySelector("h3")!.textContent)[0]).toBe("Today");
    expect(headers).toHaveLength(2);
    expect(headers[0] && plusOf(headers[0])?.getAttribute("aria-label")).toBe("Add to Today");
  });
});

/** `d` days back at 12:00 local. */
const pastNoon = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(12, 0, 0, 0);
  return t;
};

describe("the Today card's vitals", () => {
  const vitals = () =>
    document.querySelector<HTMLElement>('main [data-today-card] [data-today-row="vitals"]');
  const shown = () => {
    const s = vitals();
    return !!s && s.getBoundingClientRect().height > 0 && s.checkVisibility();
  };

  test("show at every width: 420 and 1280 (opened: the card starts collapsed)", async () => {
    await openTimeline({ width: 420 });
    await ready();
    const toggle = await found(() =>
      document.querySelector<HTMLElement>("main [data-today-card][data-collapsed] [data-today-toggle]"),
    );
    await userEvent.click(toggle);
    await waitUntil(shown, "the vitals row");
    await page.viewport(1280, 900);
    await frames();
    expect(shown()).toBe(true);
  });
});

describe("the care period in the day headers", () => {
  const daysAgo = (d: number, hour: number) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(hour, 0, 0, 0);
    return t;
  };
  const key = (d: Date) => d.toLocaleDateString("en-CA");
  /** In hospital from noon three days ago: the filler's days before that are outside any period. */
  const hospital = fx.period({ type: "hospital", startedAt: at(daysAgo(3, 12)) });
  const header = (day: Date) => document.getElementById(`day-${key(day)}`)?.closest("[data-day-header]");

  test("a day inside the period shows it in its sticky header; a day before it doesn't; the main header doesn't", async () => {
    await openTimeline({ fixtures: [...world(), hospital] });
    await ready();
    await waitUntil(() => !!header(daysAgo(0, 12))?.querySelector("[data-period-line]"), "today's period");

    for (const d of [0, 1, 3]) {
      const line = header(daysAgo(d, 12))!.querySelector<HTMLElement>("[data-period-line]");
      expect(line?.dataset.periodLine, `${d} days ago`).toBe(hospital.id);
      expect(line?.textContent).toMatch(/^In hospital · day \d+/);
    }
    expect(header(daysAgo(0, 12))?.querySelector("h3")?.textContent).toBe("Today");
    expect(getComputedStyle(await found(() => header(daysAgo(0, 12)))).position).toBe("sticky");
    // Only today's header offers Change.
    expect(document.querySelectorAll("[data-period-change]")).toHaveLength(1);
    expect(header(daysAgo(0, 12))?.querySelector("[data-period-change]")).not.toBeNull();

    expect(header(daysAgo(4, 12))).toBeTruthy();
    expect(header(daysAgo(4, 12))?.querySelector("[data-period-line]")).toBeNull();

    // Nothing about the period above the list any more.
    expect(document.querySelectorAll("main [data-period-line]")).toHaveLength(
      document.querySelectorAll("[data-day-header] [data-period-line]").length,
    );
    expect(document.querySelector("main > div > header")?.textContent).not.toMatch(/hospital/i);
    expect(document.querySelector('[data-period-line="empty"]')).toBeNull();
  });

  describe("with the recipient three hours behind the viewer, just after the viewer's midnight", () => {
    // The browser is in Los Angeles; in June, Honolulu is three hours behind. At 00:34 on the 9th here it
    // is still 21:34 on the 8th there, so both headers' moments fall on one recipient date.
    const local = (day: number, hour: number, minute = 0) => new Date(2027, 5, day, hour, minute);
    const openAtMidnight = (fixtures: Parameters<typeof fx.period>[0][]) => {
      fixClock(local(9, 0, 34));
      return openTimeline({
        bareDevice: true,
        fixtures: [
          fx.group(),
          fx.recipient({ timeZone: "Pacific/Honolulu" }),
          fx.member({ userId: TEST_USER.id, role: "owner" }),
          fx.note({ text: "Settled in", occurredAt: at(local(9, 0, 10)) }),
          fx.note({ text: "Evening walk", occurredAt: at(local(8, 20)) }),
          ...fixtures.map((v) => fx.period(v)),
        ],
      });
    };
    const lineOf = (day: number) =>
      header(local(day, 12))?.querySelector("[data-period-current]")?.textContent?.trim();

    test("Today and Yesterday show consecutive day numbers", async () => {
      await openAtMidnight([{ type: "home", startedAt: at(local(3, 12)) }]);
      await waitUntil(() => lineOf(9) && lineOf(8), "both days' period lines");
      expect(header(local(8, 12))?.querySelector("h3")?.textContent).toBe("Yesterday");
      expect(lineOf(9)).toBe("At home · day 7");
      expect(lineOf(8)).toBe("At home · day 6");
    });

    test("a period that began late yesterday shows on both headers, counted from its start", async () => {
      await openAtMidnight([
        { type: "home", startedAt: at(local(3, 12)) },
        { type: "hospital", startedAt: at(local(8, 22)) },
      ]);
      await waitUntil(() => lineOf(9) && lineOf(8), "both days' period lines");
      expect(lineOf(9)).toBe("In hospital · day 2");
      expect(lineOf(8)).toBe("In hospital · day 1");
    });
  });

  test("with the recipient in New York and a start at 00:30 there, the viewer's earlier date has no number and the start date is day 1", async () => {
    // The browser is in Los Angeles: 00:30 on the 9th in New York is 21:30 on the 8th here.
    const local = (day: number, hour: number, minute = 0) => new Date(2027, 5, day, hour, minute);
    fixClock(local(9, 10));
    await openTimeline({
      bareDevice: true,
      fixtures: [
        fx.group(),
        fx.recipient({ timeZone: "America/New_York" }),
        fx.member({ userId: TEST_USER.id, role: "owner" }),
        fx.note({ text: "Morning walk", occurredAt: at(local(9, 9)) }),
        fx.note({ text: "Late arrival", occurredAt: at(local(8, 22)) }),
        fx.period({ type: "home", startedAt: at(local(8, 21, 30)) }),
      ],
    });
    const lineOf = (day: number) =>
      header(local(day, 12))?.querySelector("[data-period-current]")?.textContent?.trim();
    await waitUntil(() => lineOf(9) && lineOf(8), "both days' period lines");
    expect(lineOf(8)).toBe("At home");
    expect(lineOf(9)).toBe("At home · day 1");
  });
});

describe("the header's width", () => {
  test("1440: the heading, Today card and entries share the column's left and right edges", async () => {
    await openTimeline({ role: "caretaker", width: 1440 });
    await waitUntil(() => rows().length > 0, "the rows");
    const edges = (el: Element) => {
      const r = el.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.right)];
    };
    const list = edges(document.querySelector("main ol")!);
    expect(edges(await found(() => document.querySelector("main > div > header")?.parentElement))).toEqual(
      list,
    );
    const card = await found(() => document.querySelector("main [data-today-card]"));
    expect(edges(card)).toEqual(list);
  });
});

describe("the empty Today", () => {
  const emptyToday = () => document.querySelector<HTMLElement>("[data-empty-today]");
  const todaySection = () => dayHeaders()[0]?.closest("section");
  const olderDays = [
    fx.symptom({ name: "Sore knee", occurredAt: at(pastNoon(2)) }),
    fx.note({ text: "Quiet afternoon", occurredAt: at(pastNoon(3)) }),
  ];

  test("a writer with nothing today sees the line under Today, older days below; Add an entry focuses the quick-entry field", async () => {
    await openTimeline({ role: "caretaker", fixtures: olderDays });
    await waitUntil(() => rows().length === 2, "the rows");
    const prompt = await found(emptyToday);
    expect(todaySection()?.querySelector("h3")?.textContent).toBe("Today");
    expect(todaySection()?.contains(prompt)).toBe(true);
    expect(prompt.textContent).toContain("Nothing logged today yet.");
    expect(dayHeaders()).toHaveLength(3);
    expect(document.querySelector("[data-empty]")).toBeNull();

    await userEvent.click(page.getByRole("button", { name: "Add an entry" }));
    const field = document.querySelector<HTMLTextAreaElement>('textarea[name="quickEntry"]')!;
    await expect.poll(() => document.activeElement).toBe(field);
    // It only focuses the field: no suggestions open.
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  test("it sits in a bordered, rounded box like an entry row's list, and still offers Add an entry", async () => {
    await openTimeline({ role: "caretaker", fixtures: olderDays });
    await waitUntil(() => rows().length === 2, "the rows");
    const box = await found(emptyToday);
    const list = document.querySelector("main ol")!;
    const [a, b] = [getComputedStyle(box), getComputedStyle(list)];
    expect(a.borderTopWidth).toBe(b.borderTopWidth);
    expect(a.borderTopColor).toBe(b.borderTopColor);
    expect(a.borderTopLeftRadius).toBe(b.borderTopLeftRadius);
    expect(parseFloat(a.borderTopWidth)).toBeGreaterThan(0);
    expect(box.querySelector("button")?.textContent).toBe("Add an entry");
  });

  test("something logged today shows no prompt", async () => {
    await openTimeline({ role: "caretaker" });
    await ready();
    expect(emptyToday()).toBeNull();
  });

  test.each([
    ["a viewer", () => openTimeline({ role: "viewer", fixtures: olderDays })],
    ["a kind filter", () => openTimeline({ role: "caretaker", fixtures: olderDays, query: "?kind=symptom" })],
    [
      "easy mode",
      () => {
        chooseEasyMode();
        return openTimeline({
          role: null,
          frame: true,
          fixtures: [fx.member({ userId: TEST_USER.id, role: "caretaker" }), ...olderDays],
        });
      },
    ],
  ])("%s shows no empty-Today prompt", async (_, open) => {
    await open();
    await waitUntil(() => rows().length > 0, "the rows");
    expect(emptyToday()).toBeNull();
    expect(page.getByRole("button", { name: "Add an entry" }).query()).toBeNull();
  });

  test("a writer's empty timeline shows the Today prompt, not “Nothing on the timeline yet.”", async () => {
    await openTimeline({ role: "caretaker", fixtures: [] });
    await found(emptyToday);
    expect(dayHeaders().map((h) => h.querySelector("h3")!.textContent)).toEqual(["Today"]);
    expect(document.querySelector("[data-empty]")).toBeNull();
    expect(document.body.textContent).not.toContain("Nothing on the timeline yet.");
  });
});
