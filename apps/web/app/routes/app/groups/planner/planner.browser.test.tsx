import { localDate } from "@caretook/data/schema";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fx, medicationPass, TEST_GROUP, TEST_TIME_ZONE, todo } from "../../../../../test/fixtures";
import { fixClock } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { pageHeader } from "../../../../../test/pageHeader";
import {
  BLOOD_DRAW,
  CARDIOLOGY,
  DENTIST,
  EYES_NEW,
  EYES_OLD,
  HEARING,
  HOSPICE,
  laTime,
  listed,
  NOW,
  NURSE,
  openPlanner,
  PAST_NOTE,
  PAST_URL,
  PODIATRY,
  RIDE,
  rowOf,
  SAM,
  THERAPY,
  UPCOMING_LIVE,
  PLANNER_URL,
  TODOS_URL,
} from "./plannerWorld";
import * as todosRoute from "../todos/route";
import * as pastRoute from "./past/route";
import * as plannerRoute from "./route";

// The Planner on the test device (from upcoming.mjs; the section current in
// the tab bar and the header is frame.browser.test.tsx's): the shared header on its two tabs (the heading,
// the tabs, the Add menu), Upcoming | Past, the Filter menu, the Planner tab's list (order, days, Now, all
// day, ranges, cancelled and rescheduled, call and map),
// the kind and author filters in the URL, the Past tab (newest first,
// cancelled ones, paging), items leaving as their time passes, no due doses
// or passes, the viewer and a non-member. The device never connects, so every
// test here is also "offline, from the device's copy". The rules themselves
// (timing, order, labels, filters, actions) are the pure modules' unit
// tests; this is what's on the screen.

const MINUTE = 60_000;
/** The Filter button, by its exact name: the menu ("Filter the Planner") and the chips ("Filters on") are named alike. */
const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
/** The labels of the "Filters on" chips. */
const filterChips = () =>
  [...document.querySelectorAll<HTMLAnchorElement>('main nav[aria-label="Filters on"] a')].map((a) =>
    a.textContent?.trim().replace(/^[A-Z]{1,2}(?=By )/, ""),
  );
/** Opens the Filter menu and chooses an option (the menu closes). */
const choose = async (option: string) => {
  await expect.element(filterButton()).toBeVisible();
  await userEvent.click(filterButton());
  await userEvent.click(page.getByRole("menuitemradio", { name: option, exact: true }));
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
};
const TABS = 'main nav[aria-label="Planner or todos"]';
const VIEWS = 'main nav[aria-label="Upcoming or past"]';
/** The Upcoming | Past chip, by its label. */
const view = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>(`${VIEWS} a`)].find(
    (a) => a.textContent?.trim() === label,
  )!;
const tab = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>(`${TABS} a`)].find(
    (a) => a.textContent?.trim() === label,
  )!;
/** The tabs as read: name, where it goes, and which is current. */
const tabs = () =>
  [...document.querySelectorAll<HTMLAnchorElement>(`${TABS} a`)].map((a) => [
    a.textContent?.trim(),
    a.getAttribute("href")!.split("?")[0],
    a.getAttribute("aria-current"),
  ]);
const addButton = () => page.getByRole("button", { name: "Add", exact: true });

beforeEach(() => fixClock(NOW));
afterEach(() => {
  vi.useRealTimers();
});

describe("the header", () => {
  const G = `/app/groups/${TEST_GROUP.id}`;
  test("two tabs, Planner and Todos: each current on its own page, and Planner stays current on Past", async () => {
    const device = await openPlanner();
    const expected = (current: string) =>
      [
        ["Planner", `${G}/planner`],
        ["Todos", `${G}/todos`],
      ].map(([name, href]) => [name, href, name === current ? "page" : null]);
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });
    expect(tabs()).toEqual(expected("Planner"));

    await userEvent.click(tab("Todos"));
    await expect.poll(() => device.location()).toBe(TODOS_URL);
    await expect.poll(() => tabs()).toEqual(expected("Todos"));
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });

    await userEvent.click(tab("Planner"));
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await userEvent.click(view("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.poll(() => tabs()).toEqual(expected("Planner"));
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });
  });

  test("the page titles: Planner, Todos and Past", () => {
    const title = (meta: () => { title: string }[]) => meta()[0]?.title;
    expect([title(plannerRoute.meta), title(todosRoute.meta), title(pastRoute.meta)]).toEqual([
      "Planner · Caretook",
      "Todos · Caretook",
      "Past · Caretook",
    ]);
  });

  test("the tabs carry what each reads: Planner what it shows and the author, Todos its chip; Upcoming | Past carry the author", async () => {
    await openPlanner({ url: `${PLANNER_URL}?kind=event&author=${SAM.id}` });
    expect(tab("Planner").getAttribute("href")).toBe(`${PLANNER_URL}?kind=event&author=${SAM.id}`);
    expect(view("Past").getAttribute("href")).toBe(`${PAST_URL}?author=${SAM.id}`);
    expect(tab("Todos").getAttribute("href")).toBe(TODOS_URL);
    await userEvent.click(tab("Todos"));
    await userEvent.click(page.getByRole("button", { name: /^Filter(, \d+ on)?$/ }));
    await userEvent.click(page.getByRole("menuitemradio", { name: "Mine", exact: true }));
    await expect.poll(() => tab("Todos").getAttribute("href")).toBe(`${TODOS_URL}?who=mine`);
    expect(tab("Planner").getAttribute("href")).toBe(PLANNER_URL);
  });
});
describe("the list", () => {
  test("soonest first, a section per day: Now (in progress, until its end), Today, Tomorrow, then dates; all day first in its day; a range with an end", async () => {
    await openPlanner();
    const rows = listed();
    expect(rows.map((r) => r.id)).toEqual([
      NURSE.id,
      THERAPY.id,
      CARDIOLOGY.id,
      HOSPICE.id,
      RIDE.id,
      DENTIST.id,
      EYES_OLD.id,
      EYES_NEW.id,
    ]);
    expect([...new Set(rows.map((r) => r.heading))]).toEqual([
      "Now",
      "Today",
      "Tomorrow",
      "Friday, Nov 20",
      "Saturday, Nov 21",
      "Monday, Nov 23",
      "Tuesday, Nov 24",
    ]);
    expect(rowOf(NURSE.id)?.when).toBe("Now · until 10:45 AM");
    expect(rowOf(THERAPY.id)?.when).toBe("2:00 PM");
    expect(rowOf(CARDIOLOGY.id)?.when).toBe("10:30 AM–11:15 AM");
    expect(rowOf(HOSPICE.id)?.when).toBe("All day");
  });

  test("cancelled items are struck through and labelled; a rescheduled one names its new day and links to it", async () => {
    await openPlanner();
    const dentist = rowOf(DENTIST.id)!;
    expect(dentist).toMatchObject({ cancelled: true, struck: true });
    expect(dentist.text).toContain("Cancelled");
    const old = rowOf(EYES_OLD.id)!;
    expect(old).toMatchObject({ cancelled: true, struck: true });
    const moved = document.querySelector(`[data-upcoming-item="${EYES_OLD.id}"] [data-rescheduled-to]`)!;
    expect(moved.textContent).toBe("Rescheduled to Tue, Nov 24");
    expect(moved.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/entries/${EYES_NEW.id}`);
    expect(rowOf(EYES_NEW.id)?.cancelled).toBe(false);
    expect(
      listed()
        .filter((r) => !r.cancelled)
        .map((r) => r.id),
    ).toEqual(UPCOMING_LIVE.map((e) => e.id));
  });

  test("call and map on a row with a provider and a place; a call alone with only a phone; nothing on a row with neither", async () => {
    await openPlanner();
    const cardiology = rowOf(CARDIOLOGY.id)?.actions ?? [];
    expect(cardiology.map((a) => a.kind)).toEqual(["call", "map"]);
    expect(cardiology[0]?.href).toBe("tel:5550103300");
    expect(cardiology[0]?.label).toMatch(/^Call Dr\. Ana Tran/);
    expect(cardiology[1]?.href).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=48%20Harbor/,
    );
    expect(rowOf(THERAPY.id)?.actions).toEqual([
      expect.objectContaining({ kind: "call", href: "tel:+15550105500" }),
    ]);
    expect(rowOf(RIDE.id)?.actions).toEqual([]);
  });

  test("an item leaves the Planner tab once its end (in progress) or its start passes, without a reload", async () => {
    const device = await openPlanner();
    const mounted = document.querySelector("main[data-planner]");
    expect(rowOf(NURSE.id)?.heading).toBe("Now");
    // 10:46: the visit has ended.
    await vi.advanceTimersByTimeAsync(46 * MINUTE);
    await device.settle();
    await expect.poll(() => rowOf(NURSE.id)).toBeUndefined();
    expect(rowOf(THERAPY.id)?.heading).toBe("Today");
    // 2:01 PM: therapy has started (no end: it's past).
    await vi.advanceTimersByTimeAsync(4 * 60 * MINUTE - 45 * MINUTE);
    await device.settle();
    await expect.poll(() => rowOf(THERAPY.id)).toBeUndefined();
    expect(listed()[0]?.id).toBe(CARDIOLOGY.id);
    expect(document.querySelector("main[data-planner]")).toBe(mounted);
  });
});

describe("adding", () => {
  const items = () =>
    [...document.querySelectorAll("[role=menu] [role=menuitem]")].map((m) => m.textContent?.trim());

  test("a writer's + is the header's Add menu, with Appointment and Todo; Appointment is a draft that picks the time first", async () => {
    const device = await openPlanner({ role: "caretaker" });
    // The header's +: its last control, icon only, "Add" its name and tooltip.
    await expect.element(addButton()).toHaveAttribute("title", "Add");
    expect(addButton().element().textContent.trim()).toBe("");
    expect([...document.querySelectorAll("main header a, main header button")].at(-1)).toBe(
      addButton().element(),
    );
    await userEvent.click(addButton());
    await expect.poll(items).toEqual(["Appointment", "Todo"]);
    const base = `/app/groups/${TEST_GROUP.id}/entries/new`;
    await userEvent.click(page.getByRole("menuitem", { name: "Appointment" }));
    await expect.poll(() => device.location()).toBe(`${base}?kind=event&when=pick`);
  });

  for (const [name, tabName, url] of [
    ["Planner", "Planner", () => PLANNER_URL],
    ["Past", "Planner", () => PAST_URL],
    ["Todos", "Todos", () => TODOS_URL],
  ] as const)
    test(`on ${name}: Todo opens the add sheet, and Cancel comes back to ${name}`, async () => {
      const device = await openPlanner({ role: "caretaker", url: url() });
      await userEvent.click(addButton());
      await userEvent.click(page.getByRole("menuitem", { name: "Todo" }));
      const dialog = page.getByRole("dialog", { name: "Add a todo" });
      await expect.element(dialog).toBeInTheDocument();
      expect(device.location()).toBe(`${TODOS_URL}/new`);
      await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
      await expect.poll(() => device.location()).toBe(url());
      await expect.poll(() => tab(tabName).getAttribute("aria-current")).toBe("page");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

  test("a viewer sees the Planner with the same header and no Add menu, on every tab", async () => {
    const device = await openPlanner({ role: "viewer" });
    expect(listed().map((r) => r.id)).toContain(CARDIOLOGY.id);
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });
    expect(addButton().query()).toBeNull();
    await userEvent.click(tab("Todos"));
    await expect.poll(() => device.location()).toBe(TODOS_URL);
    expect(addButton().query()).toBeNull();
    await userEvent.click(tab("Planner"));
    await expect.poll(() => view("Past")).toBeTruthy();
    await userEvent.click(view("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    expect(addButton().query()).toBeNull();
    expect(device.location()).toBe(PAST_URL);
  });
});
describe("filters", () => {
  const TODAY_TODO = () =>
    todo({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7c21",
      title: "Fax the form",
      dueOn: localDate(new Date(), TEST_TIME_ZONE),
    });
  const todoRows = () => document.querySelectorAll("main [data-planner-todo]").length;

  test("Upcoming | Past at the left of the row (Upcoming current), the Filter button at its right end, no chip row while All", async () => {
    await openPlanner();
    expect(
      [...document.querySelectorAll(`${VIEWS} a`)].map((a) => [
        a.textContent?.trim(),
        a.getAttribute("aria-current"),
      ]),
    ).toEqual([
      ["Upcoming", "true"],
      ["Past", null],
    ]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
    expect(document.querySelector('main nav[aria-label="Filters on"]')).toBeNull();
    expect(document.querySelector('main nav[aria-label="Show items"]')).toBeNull();
  });

  test("Events shows only events, in the URL, with its chip, Filter, 1 on, and survives a reload; its ✕ returns to All", async () => {
    const device = await openPlanner({ extra: [TODAY_TODO()] });
    await expect.poll(todoRows).toBe(1);
    await choose("Events");
    await expect.poll(() => device.location()).toBe(`${PLANNER_URL}?kind=event`);
    expect(listed().every((r) => r.kindLink === "Show only events")).toBe(true);
    expect(todoRows()).toBe(0);
    expect(filterChips()).toEqual(["Events"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    // A reload: the screen opened at that URL.
    await device.screen.unmount();
    const again = await openPlanner({ url: device.location(), extra: [TODAY_TODO()] });
    expect(filterChips()).toEqual(["Events"]);
    expect(listed().length).toBeGreaterThan(0);
    expect(todoRows()).toBe(0);
    await userEvent.click(page.getByRole("link", { name: "Events: clear this filter" }));
    await expect.poll(() => again.location()).toBe(PLANNER_URL);
    await expect.poll(todoRows).toBe(1);
    expect(listed().length).toBe(8);
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
  });

  test("Todos shows only todos (no events), with its chip and Filter, 1 on; its ✕ returns to All", async () => {
    const device = await openPlanner({ extra: [TODAY_TODO()] });
    await choose("Todos");
    await expect.poll(() => device.location()).toBe(`${PLANNER_URL}?show=todos`);
    await expect.poll(() => listed().length).toBe(0);
    expect(todoRows()).toBe(1);
    expect(filterChips()).toEqual(["Todos"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    await userEvent.click(page.getByRole("link", { name: "Todos: clear this filter" }));
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.poll(() => listed().length).toBe(8);
    expect(todoRows()).toBe(1);
  });

  test("an empty Todos list says what is on", async () => {
    await openPlanner({ url: `${PLANNER_URL}?show=todos` });
    await expect.element(page.getByText("No upcoming todos.")).toBeVisible();
  });

  test("an author's initials show only their items, with a chip naming them that clears only the author and isn't counted; it shows on Past too", async () => {
    const device = await openPlanner();
    await userEvent.click(getByCss(`[data-upcoming-item="${THERAPY.id}"] [data-author="${SAM.id}"]`));
    await expect.poll(() => device.location()).toBe(`${PLANNER_URL}?author=${SAM.id}`);
    await expect.poll(() => listed().map((r) => r.id)).toEqual([THERAPY.id, HOSPICE.id, RIDE.id]);
    const by = page.getByRole("link", { name: "By Sam Okafor: clear this filter" });
    await expect.element(by).toHaveAttribute("aria-current", "true");
    await expect.element(filterButton()).toHaveAccessibleName("Filter");

    await choose("Events");
    await expect.poll(() => device.location()).toBe(`${PLANNER_URL}?kind=event&author=${SAM.id}`);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    expect(filterChips()).toEqual(["Events", "By Sam Okafor"]);

    // Past keeps the author, drops the rest: no Filter button, only the author chip.
    await userEvent.click(view("Past"));
    await expect.poll(() => device.location()).toBe(`${PAST_URL}?author=${SAM.id}`);
    await expect.element(by).toBeVisible();
    expect(filterChips()).toEqual(["By Sam Okafor"]);
    expect(filterButton().query()).toBeNull();
    // Back to Upcoming: the author stays, the show choice is reset.
    await userEvent.click(view("Upcoming"));
    await expect.poll(() => device.location()).toBe(`${PLANNER_URL}?author=${SAM.id}`);

    await userEvent.click(page.getByRole("link", { name: "By Sam Okafor: clear this filter" }));
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.poll(() => listed().length).toBe(8);
  });
});

describe("the Past tab", () => {
  test("from the Planner tab: past events only, newest first, cancelled ones included, no notes; the Past tab current", async () => {
    const device = await openPlanner();
    await userEvent.click(view("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.element(page.getByText("Hearing test")).toBeInTheDocument();
    expect(view("Past").getAttribute("aria-current")).toBe("true");
    expect(view("Upcoming").getAttribute("aria-current")).toBeNull();
    expect(tab("Planner").getAttribute("aria-current")).toBe("page");
    expect(filterButton().query()).toBeNull();
    const rows = listed();
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual([BLOOD_DRAW.id, HEARING.id, PODIATRY.id]);
    expect(rowOf(HEARING.id)).toMatchObject({ cancelled: true, struck: true });
    expect(rowOf(PODIATRY.id)?.cancelled).toBe(true);
    expect(rows.find((r) => r.id === PAST_NOTE.id)).toBeUndefined();
    expect(new Set(rows.map((r) => r.kindLink))).toEqual(new Set(["Show only events"]));
    const days = [...new Set(rows.map((r) => r.day))];
    expect(days).toEqual([...days].sort().reverse());
  });

  test("one page first; scrolling to the end loads the older ones, then says so", async () => {
    await openPlanner({ url: PAST_URL });
    const first = listed().length;
    expect(first).toBeLessThan(33);
    // Scrolled to the end on each read until the last page is in.
    await expect
      .poll(() => {
        document.querySelector("[data-older-entries]")?.scrollIntoView({ block: "end" });
        return listed().length;
      })
      .toBe(33);
    expect(listed().at(-1)?.text).toContain("Older visit 29");
    await expect
      .poll(() => document.querySelector("[data-older-entries]")?.textContent)
      .toContain("That's the first event");
  });
});

describe("a non-member", () => {
  test("another group's Planner is Not found, with nothing of it", async () => {
    await openPlanner({ role: null });
    await expect.element(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
    expect(document.body.textContent).not.toContain("Cardiology");
  });
});

describe("no due doses or passes", () => {
  // At 10:00: a slot at 9:57 (due) and one at 10:20 (later), and a pass given today.
  const PASS = medicationPass({ name: "Rounds", time: "09:53", sortOrder: 0 });
  const DONEPEZIL = fx.medication({
    name: "Donepezil",
    strength: "5 mg",
    schedule: { type: "scheduled", slots: [{ time: "09:57" }, { time: "10:20" }] },
  });
  const XA = fx.medication({
    name: "Xa",
    strength: "5 mg",
    schedule: { type: "scheduled", slots: [{ passId: PASS.id }] },
  });
  const GIVEN = fx.dose({ medicationId: XA.id, scheduledFor: "09:53", occurredAt: laTime(0, 9, 55) });
  const BETWEEN = fx.event({ title: "Between doses", occurredAt: laTime(0, 10, 10) });

  test("the Planner lists the appointment and no dose or pass row", async () => {
    await openPlanner({ extra: [PASS, DONEPEZIL, XA, GIVEN, BETWEEN] });
    expect(listed().map((r) => r.id)).toContain(BETWEEN.id);
    expect(document.querySelector("main [data-upcoming-dose]")).toBeNull();
    expect(document.querySelector("main [data-upcoming-list]")?.textContent).not.toMatch(/Donepezil|Rounds/);
  });
});

describe("a stored future note", () => {
  test("shows in no Planner row, while the appointments do", async () => {
    const FUTURE_NOTE = fx.note({ title: "Call the pharmacy", occurredAt: laTime(1, 9), text: "Refill." });
    await openPlanner({ extra: [FUTURE_NOTE] });
    await expect.poll(() => listed().length).toBeGreaterThan(0);
    expect(listed().map((r) => r.id)).not.toContain(FUTURE_NOTE.id);
    expect(listed().map((r) => r.id)).toContain(NURSE.id);
    expect(document.body.textContent).not.toContain("Call the pharmacy");
  });
});

describe("the page title", () => {
  test("is one h1, Planner, on both tabs", async () => {
    await openPlanner();
    await expect.poll(() => document.querySelector("main h1")?.textContent).toBe("Planner");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
