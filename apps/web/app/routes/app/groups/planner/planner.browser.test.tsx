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
  itemEl,
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
import { UPCOMING_TICK_MS } from "./useUpcomingData";
import { localDate } from "@caretook/data/domain";

// The Planner on the test device (from upcoming.mjs; the section current in
// the tab bar and the header is frame.browser.test.tsx's): the shared header on its three tabs (the heading,
// Upcoming, Past and Todos, the Add menu), the Filter menu, the Upcoming tab's list (order, days, Now, all
// day, ranges, cancelled and rescheduled, call and map),
// the kind and author filters in the URL, the Past tab (newest first,
// cancelled ones, paging), items leaving as their time passes, no due doses
// or passes, the viewer and a non-member. The device never connects, so every
// test here is also "offline, from the device's copy". The rules themselves
// (timing, order, labels, filters, actions) are the pure modules' unit
// tests; this is what's on the screen.

const MINUTE = 60_000;
/**
 * "10:45 AM" for `laTime(days, hour, minute)` on the device's clock. The world is set in
 * Los Angeles wall-clock time and the Planner shows each time in the viewer's zone, so a
 * New York device sees the 10:45 AM visit end at 1:45 PM.
 */
const shownAt = (days: number, hour: number, minute = 0) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(Date.UTC(2026, 10, 18 + days, hour + 8, minute)),
  );
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
const TABS = 'main nav[aria-label="Upcoming, past or todos"]';
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
  test("three tabs, Upcoming, Past and Todos: each current on its own page, and the old chips are gone", async () => {
    const device = await openPlanner();
    const expected = (current: string) =>
      [
        ["Upcoming", `${G}/planner`],
        ["Past", `${G}/planner/past`],
        ["Todos", `${G}/todos`],
      ].map(([name, href]) => [name, href, name === current ? "page" : null]);
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });
    expect(tabs()).toEqual(expected("Upcoming"));
    expect(page.getByRole("navigation", { name: "Upcoming or past" }).query()).toBeNull();

    await userEvent.click(tab("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.poll(() => tabs()).toEqual(expected("Past"));
    expect(page.getByRole("navigation", { name: "Upcoming or past" }).query()).toBeNull();
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });

    await userEvent.click(tab("Todos"));
    await expect.poll(() => device.location()).toBe(TODOS_URL);
    await expect.poll(() => tabs()).toEqual(expected("Todos"));
    expect(pageHeader()).toEqual({ h1: "Planner", namesRecipient: false, viewerNote: false });

    await userEvent.click(tab("Upcoming"));
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.poll(() => tabs()).toEqual(expected("Upcoming"));
  });

  test("Past, then Todos, then back lands on Past", async () => {
    const device = await openPlanner({ url: PAST_URL });
    await userEvent.click(tab("Todos"));
    await expect.poll(() => device.location()).toBe(TODOS_URL);
    await userEvent.click(tab("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.poll(() => tab("Past").getAttribute("aria-current")).toBe("page");
    await expect.element(page.getByText("Hearing test")).toBeInTheDocument();
  });

  test("the page titles: Planner, Todos and Past", () => {
    const title = (meta: () => { title: string }[]) => meta()[0]?.title;
    expect([title(plannerRoute.meta), title(todosRoute.meta), title(pastRoute.meta)]).toEqual([
      "Planner · Caretook",
      "Todos · Caretook",
      "Past · Caretook",
    ]);
  });

  test("the tabs carry what each reads: Upcoming what it shows and the author, Past the author, Todos its chip", async () => {
    await openPlanner({ url: `${PLANNER_URL}?kind=event&author=${SAM.id}` });
    expect(tab("Upcoming").getAttribute("href")).toBe(`${PLANNER_URL}?kind=event&author=${SAM.id}`);
    expect(tab("Past").getAttribute("href")).toBe(`${PAST_URL}?author=${SAM.id}`);
    expect(tab("Todos").getAttribute("href")).toBe(TODOS_URL);
    await userEvent.click(tab("Todos"));
    await userEvent.click(page.getByRole("button", { name: /^Filter(, \d+ on)?$/ }));
    await userEvent.click(page.getByRole("menuitemradio", { name: "Mine", exact: true }));
    await expect.poll(() => tab("Todos").getAttribute("href")).toBe(`${TODOS_URL}?who=mine`);
    expect(tab("Upcoming").getAttribute("href")).toBe(PLANNER_URL);
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
    expect(rowOf(NURSE.id)?.when).toBe(`Now · until ${shownAt(0, 10, 45)}`);
    expect(rowOf(THERAPY.id)?.when).toBe(shownAt(0, 14));
    expect(rowOf(CARDIOLOGY.id)?.when).toBe(`${shownAt(1, 10, 30)}–${shownAt(1, 11, 15)}`);
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

  test("at phone width the time runs on one line above the title, with no time column", async () => {
    await openPlanner();
    const row = itemEl(CARDIOLOGY.id);
    const time = row?.querySelector("[data-when]");
    expect(time?.getClientRects()).toHaveLength(1);
    expect(time?.getBoundingClientRect().height).toBeLessThan(24);
    const title = [...(row?.querySelectorAll("p") ?? [])].find(
      (p) => p.textContent === "Cardiology follow-up",
    );
    expect(title?.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      time?.getBoundingClientRect().bottom ?? 0,
    );
    expect(row?.querySelector("[data-when-column]")).toBeNull();
  });

  test("a card with a contact has labelled Call and Directions in a footer, the initials on its right", async () => {
    await openPlanner();
    const footer = itemEl(CARDIOLOGY.id)?.querySelector<HTMLElement>("[data-row-footer]");
    const call = footer?.querySelector<HTMLElement>('[data-action="call"]');
    const map = footer?.querySelector<HTMLElement>('[data-action="map"]');
    expect(call?.textContent).toBe("Call");
    expect(map?.textContent).toBe("Directions");
    expect(map?.getAttribute("aria-label")).toMatch(/^Directions to 48 Harbor/);
    const pill = footer?.querySelector<HTMLElement>("[data-author]");
    const box = pill?.getBoundingClientRect();
    expect(box?.left).toBeGreaterThan(map?.getBoundingClientRect().right ?? Infinity);
    expect(box?.right).toBeCloseTo(footer?.getBoundingClientRect().right ?? 0, 0);
    // On top at their centres: a tap reaches the action or the filter, not the row's link.
    const callBox = call?.getBoundingClientRect();
    expect(call?.contains(document.elementFromPoint((callBox?.x ?? 0) + 8, (callBox?.y ?? 0) + 8))).toBe(
      true,
    );
    const hit = document.elementFromPoint((box?.left ?? 0) + 12, (box?.top ?? 0) + 12);
    expect(hit?.closest("[data-author]")).toBe(pill);
  });

  test("a card with no actions has no footer, and its initials end the last line", async () => {
    await openPlanner();
    const row = itemEl(RIDE.id);
    expect(row?.querySelector("[data-row-footer]")).toBeNull();
    expect(row?.querySelector("[data-contact-actions]")).toBeNull();
    const pill = row?.querySelector("[data-author]")?.getBoundingClientRect();
    const title = [...(row?.querySelectorAll("p") ?? [])]
      .find((p) => p.textContent === "Ride to the senior center")
      ?.getBoundingClientRect();
    expect(pill?.left).toBeGreaterThanOrEqual(title?.right ?? Infinity);
    expect(pill?.bottom).toBeGreaterThanOrEqual((title?.bottom ?? Infinity) - 1);
  });

  test("the address line has no map pin of its own", async () => {
    await openPlanner();
    const place = itemEl(CARDIOLOGY.id)?.querySelector("[data-place]");
    expect(place?.textContent).toContain("48 Harbor Way, Suite 2, Port Alder");
    expect(place?.querySelector("svg")).toBeNull();
  });

  test("an easy role's card keeps its footer, with plain initials: a tap there opens the row", async () => {
    await openPlanner({ role: "easy_viewer" });
    const row = itemEl(CARDIOLOGY.id);
    const pill = row?.querySelector<HTMLElement>("[data-row-footer] [data-author]");
    expect(pill?.tagName).toBe("SPAN");
    expect(row?.querySelector('a[aria-label^="Show only"]')).toBeNull();
    const box = pill?.getBoundingClientRect();
    const hit = document.elementFromPoint((box?.left ?? 0) + 12, (box?.top ?? 0) + 12);
    expect(hit?.getAttribute("href")).toBe(`/app/groups/${TEST_GROUP.id}/entries/${CARDIOLOGY.id}`);
    expect(itemEl(RIDE.id)?.querySelector("[data-author]")?.tagName).toBe("SPAN");
  });

  test("the whole card still opens the entry, and its kind icon still filters", async () => {
    const device = await openPlanner();
    expect(rowOf(CARDIOLOGY.id)?.open).toBe(`/app/groups/${TEST_GROUP.id}/entries/${CARDIOLOGY.id}`);
    expect(rowOf(CARDIOLOGY.id)?.kindLink).toBe("Show only events");
    await userEvent.click(
      getByCss(`[data-upcoming-item="${CARDIOLOGY.id}"] a[aria-label="Show only events"]`),
    );
    await expect.poll(device.location).toContain("kind=event");
  });

  test("an item leaves the Planner tab once its end (in progress) or its start passes, without a reload", async () => {
    const device = await openPlanner();
    const mounted = document.querySelector("main[data-planner]");
    expect(rowOf(NURSE.id)?.heading).toBe("Now");
    // The list rereads the clock on its tick (`UPCOMING_TICK_MS`) and splits the rows it has (its query
    // changes only once a day). Jump the clock (pending timers move with it), then one tick.
    const jumpTo = async (at: number) => {
      vi.setSystemTime(at);
      await vi.advanceTimersByTimeAsync(UPCOMING_TICK_MS);
      await device.settle();
    };
    // 10:46: the visit has ended.
    await jumpTo(NOW.getTime() + 46 * MINUTE);
    await expect.poll(() => rowOf(NURSE.id)).toBeUndefined();
    expect(rowOf(THERAPY.id)?.heading).toBe("Today");
    // 2:01 PM: therapy has started (no end: it's past).
    await jumpTo(NOW.getTime() + (4 * 60 + 1) * MINUTE);
    await expect.poll(() => rowOf(THERAPY.id)).toBeUndefined();
    expect(listed()[0]?.id).toBe(CARDIOLOGY.id);
    expect(document.querySelector("main[data-planner]")).toBe(mounted);
  });
});

describe("adding", () => {
  const items = () =>
    [...document.querySelectorAll("[role=menu] [role=menuitem]")].map((m) => m.textContent?.trim());

  test("a writer's + is the header's Add menu, with Event and Todo, and no Appointment; Event is a draft that picks the time first", async () => {
    const device = await openPlanner({ role: "caretaker" });
    // The header's +: its last control, icon only, "Add" its name and tooltip.
    await expect.element(addButton()).toHaveAttribute("title", "Add");
    expect(addButton().element().textContent.trim()).toBe("");
    expect([...document.querySelectorAll("main header a, main header button")].at(-1)).toBe(
      addButton().element(),
    );
    await userEvent.click(addButton());
    await expect.poll(items).toEqual(["Event", "Todo"]);
    const base = `/app/groups/${TEST_GROUP.id}/entries/new`;
    await userEvent.click(page.getByRole("menuitem", { name: "Event" }));
    await expect.poll(() => device.location()).toBe(`${base}?kind=event&when=pick`);
  });

  for (const [name, tabName, url] of [
    ["Upcoming", "Upcoming", () => PLANNER_URL],
    ["Past", "Past", () => PAST_URL],
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
    await userEvent.click(tab("Past"));
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

  test("on Upcoming the search and Filter bar sits below the tabs, with no chip row while All", async () => {
    await openPlanner();
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
    const bar = document.querySelector<HTMLElement>(TABS)!.getBoundingClientRect();
    const button = filterButton().element().getBoundingClientRect();
    expect(button.top).toBeGreaterThanOrEqual(bar.bottom);
    expect(page.getByRole("searchbox", { name: "Search the Planner" }).query()).not.toBeNull();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
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

    // Past keeps the author, drops the rest: its own Filter menu, By, with the author on.
    await userEvent.click(tab("Past"));
    await expect.poll(() => device.location()).toBe(`${PAST_URL}?author=${SAM.id}`);
    await expect.element(by).toBeVisible();
    expect(filterChips()).toEqual(["By Sam Okafor"]);
    await expect.element(filterButton()).toHaveAccessibleName("Filter, 1 on");
    // Back to Upcoming: the author stays, the show choice is reset.
    await userEvent.click(tab("Upcoming"));
    await expect.poll(() => device.location()).toBe(`${PLANNER_URL}?author=${SAM.id}`);

    await userEvent.click(page.getByRole("link", { name: "By Sam Okafor: clear this filter" }));
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.poll(() => listed().length).toBe(8);
  });
});

describe("the Past tab", () => {
  test("from the Upcoming tab: past events only, newest first, cancelled ones included, no notes; the Past tab current", async () => {
    const device = await openPlanner();
    await userEvent.click(tab("Past"));
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.element(page.getByText("Hearing test")).toBeInTheDocument();
    expect(tab("Past").getAttribute("aria-current")).toBe("page");
    expect(tab("Upcoming").getAttribute("aria-current")).toBeNull();
    await expect.element(filterButton()).toHaveAccessibleName("Filter");
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
  test("is one h1, Planner, on its tabs", async () => {
    await openPlanner();
    await expect.poll(() => document.querySelector("main h1")?.textContent).toBe("Planner");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });
});
