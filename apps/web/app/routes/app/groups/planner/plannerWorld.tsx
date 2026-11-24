import type { DeviceOptions, DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { getByCss } from "../../../../../test/locators";
import * as entryRoute from "../entry/route";
import * as editSheet from "../timeline/edit/route";
import * as newDose from "../timeline/new-dose/route";
import * as newSheet from "../timeline/new/route";
import * as timeline from "../timeline/route";
import * as todoPage from "../todo/route";
import * as editTodo from "../todos/edit/route";
import * as newTodo from "../todos/new/route";
import * as todos from "../todos/route";
import * as past from "./past/route";
import * as planner from "./route";

// The Planner's component tests share one fictional world, on a fixed clock
// (`fixClock(NOW)` from test/found.ts, before building it):
// Wednesday, November 18, 2026, 10:00 AM in Los Angeles (where the test
// device runs). Something in progress, items later today, tomorrow and
// Friday (one all day), cancelled and rescheduled ones,
// providers to call and map, two authors, and past events for the Past tab.
// What upcoming.mjs used to check against the seeds, against rows this file
// controls. Only `*.browser.test.tsx` files import it.

/** The fixed "now": 10:00 AM in Los Angeles (PST, UTC−8). */
export const NOW = new Date("2026-11-18T18:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** `ms` from the fixed now, as the device stores it. */
export const fromNow = (ms: number) => at(new Date(NOW.getTime() + ms));
/** A wall-clock time in Los Angeles `days` from today (Nov 18): `laTime(1, 10, 30)` is tomorrow 10:30 AM. */
export const laTime = (days: number, hour: number, minute = 0) =>
  at(new Date(Date.UTC(2026, 10, 18 + days, hour + 8, minute)));

export const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
/** The aide: a phone, no address (a row with only her calls her). */
export const AIDE = fx.provider({
  name: "Rosa Diaz",
  type: "other",
  specialty: null,
  phones: [{ label: "Cell", number: "+15550105500" }],
});
/** The cardiologist: a phone and an address (call and map). */
export const TRAN = fx.provider({
  name: "Dr. Ana Tran",
  specialty: "Cardiology",
  phones: [{ label: "Office", number: "555-010-3300" }],
  address: "48 Harbor Way\nSuite 2\nPort Alder",
});

export const NURSE = fx.event({
  title: "Home nurse visit",
  occurredAt: laTime(0, 9, 30),
  endsAt: laTime(0, 10, 45),
});
export const THERAPY = fx.event({ title: "Physical therapy", occurredAt: laTime(0, 14), createdBy: SAM.id });
export const CARDIOLOGY = fx.event({
  title: "Cardiology follow-up",
  occurredAt: laTime(1, 10, 30),
  endsAt: laTime(1, 11, 15),
});
export const RIDE = fx.event({
  title: "Ride to the senior center",
  occurredAt: laTime(2, 9),
  createdBy: SAM.id,
});
export const HOSPICE = fx.event({
  title: "Hospice intake visit",
  occurredAt: laTime(2, 0),
  allDay: 1,
  createdBy: SAM.id,
});
export const DENTIST = fx.event({
  title: "Dental cleaning",
  occurredAt: laTime(3, 11),
  cancelledAt: fromNow(-DAY),
  cancelReason: "Office closed",
});
export const EYES_NEW = fx.event({ title: "Eye doctor", occurredAt: laTime(6, 13) });
export const EYES_OLD = fx.event({
  title: "Eye doctor",
  occurredAt: laTime(5, 13),
  cancelledAt: fromNow(-2 * DAY),
  rescheduledTo: EYES_NEW.id,
});
/** Live (not cancelled) upcoming items, soonest first, as the Planner tab lists them. */
export const UPCOMING_LIVE = [NURSE, THERAPY, CARDIOLOGY, HOSPICE, RIDE, EYES_NEW];

// The past: events (two cancelled), and a note the Past tab leaves out.
export const BLOOD_DRAW = fx.event({ title: "Blood draw", occurredAt: laTime(-1, 8) });
export const HEARING = fx.event({
  title: "Hearing test",
  occurredAt: laTime(-3, 10),
  cancelledAt: fromNow(-4 * DAY),
});
export const PODIATRY = fx.event({
  title: "Podiatry visit",
  occurredAt: laTime(-12, 15),
  cancelledAt: fromNow(-13 * DAY),
  createdBy: SAM.id,
});
export const PAST_NOTE = fx.note({ title: "Slept badly", occurredAt: laTime(-1, 7), text: "Up twice." });
/** Older past events, one a day before Podiatry: enough that the Past tab pages. */
const olderVisits = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    fx.event({ title: `Older visit ${i}`, occurredAt: laTime(-13 - i, 9) }),
  );

export const world = (): Fixture[] => [
  SAM,
  AIDE,
  TRAN,
  NURSE,
  THERAPY,
  fx.link(THERAPY.id, AIDE.id),
  CARDIOLOGY,
  fx.link(CARDIOLOGY.id, TRAN.id),
  RIDE,
  HOSPICE,
  DENTIST,
  EYES_OLD,
  EYES_NEW,
  BLOOD_DRAW,
  HEARING,
  PODIATRY,
  PAST_NOTE,
  ...olderVisits(30),
];

export const GROUP = TEST_GROUP.id;
export const PLANNER_URL = `/app/groups/${GROUP}/planner`;
export const PAST_URL = `${PLANNER_URL}/past`;
export const TODOS_URL = `/app/groups/${GROUP}/todos`;
export const TIMELINE_URL = `/app/groups/${GROUP}/timeline`;
export const entryUrl = (id: string) => `/app/groups/${GROUP}/entries/${id}`;

/**
 * The Planner's three tabs (Planner, Past, and Todos with its sheets), a
 * todo's page, the timeline with its sheets (the Dose sheet too), and the
 * entry page.
 */
export const PLANNER_ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/planner", module: planner },
  { path: "/app/groups/:groupId/planner/past", module: past },
  {
    path: "/app/groups/:groupId/todos",
    module: todos,
    children: [
      { path: "/app/groups/:groupId/todos/new", module: newTodo },
      { path: "/app/groups/:groupId/todos/:todoId/edit", module: editTodo },
    ],
  },
  { path: "/app/groups/:groupId/todos/:todoId", module: todoPage },
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [
      { path: "/app/groups/:groupId/timeline/new/dose", module: newDose },
      { path: "/app/groups/:groupId/timeline/new/:kind", module: newSheet },
      { path: "/app/groups/:groupId/timeline/:entryId/edit", module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
];

/** Open the test device at `url` (the Planner tab by default) on the world plus `extra` rows. Fix the clock first (`fixClock(NOW)`). */
export const openPlanner = async ({
  url = PLANNER_URL,
  extra = [],
  ...options
}: Partial<DeviceOptions> & { extra?: Fixture[] } = {}) => {
  return renderWithDevice({
    route: PLANNER_ROUTES,
    url,
    fixtures: [world(), extra],
    ...options,
  });
};

// --- DOM helpers (the old upcoming.mjs's selectors) ----------------------------------

export type ListedRow = {
  day: string;
  heading: string;
  id: string;
  text: string;
  when: string;
  cancelled: boolean;
  struck: boolean;
  actions: { kind: string; href: string | null; label: string | null }[];
  kindLink: string | null;
  author: string | null;
  open: string | null;
};

/** Every listed row, in order: its section, title text, and what it carries. */
export const listed = (): ListedRow[] =>
  [...document.querySelectorAll<HTMLElement>("main [data-upcoming-list] [data-day]")].flatMap((day) =>
    [...day.querySelectorAll<HTMLElement>("[data-upcoming-item]")].map((li) => ({
      day: day.dataset.day!,
      heading: day.querySelector("h3")!.textContent.trim(),
      id: li.dataset.upcomingItem!,
      text: li.textContent ?? "",
      when: li.querySelector("[data-when]")?.textContent ?? "",
      cancelled: li.hasAttribute("data-cancelled"),
      struck: [...li.querySelectorAll("div")].some((d) =>
        getComputedStyle(d).textDecorationLine.includes("line-through"),
      ),
      actions: [...li.querySelectorAll<HTMLElement>("[data-action]")].map((a) => ({
        kind: a.dataset.action!,
        href: a.getAttribute("href"),
        label: a.getAttribute("aria-label"),
      })),
      kindLink:
        li.querySelector('a[aria-label^="Show only"]:not([data-author])')?.getAttribute("aria-label") ?? null,
      author: li.querySelector<HTMLElement>("[data-author]")?.dataset.author ?? null,
      open: li.querySelector("a.absolute")?.getAttribute("href") ?? null,
    })),
  );
export const rowOf = (id: string) => listed().find((r) => r.id === id);
export const titlesListed = () => listed().map((r) => r.id);
/** A listed row (its `data-upcoming-item`), as an element to read, or null. */
export const itemEl = (id: string) =>
  document.querySelector<HTMLElement>(`main [data-upcoming-item="${id}"]`);
/** A listed row, as a locator. */
export const item = (id: string) => getByCss(`main [data-upcoming-item="${id}"]`);
/** A row's ⋯ button. */
export const rowActions = (id: string) => item(id).getByCss('button[aria-label^="Actions for"]');

/** The open menu's item named `text`. */
export const menuItem = (text: string) => page.getByRole("menuitem", { name: text, exact: true });
export const menuItems = () =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].map((m) => m.textContent?.trim());
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The first button in an open dialog whose text is `text`. */
export const dialogButton = (text: string) =>
  getByCss("dialog[open] button")
    .filter({ hasText: new RegExp(`^${escape(text)}$`) })
    .first();

/** The signed-in user's id, for `createdBy` checks. */
export const ME = TEST_USER.id;
