import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture, GroupRole } from "../../../../../test/fixtures";

import { useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fixClock, found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, medicationPass, todo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { materializeLiveEntry } from "~/lib/live-notes/liveEntry.sync";
import { clearUndo } from "~/lib/medications/passUndo";
import { clockAt, clockMoment, CLOCK, DOSES_SQL } from "../medications/medicationWorld";
import * as newDose from "./new-dose/route";
import * as timeline from "./route";
import { TIMELINE_URL } from "./timelineWorld";

// The Today card (timeline-ux slice 5, B-169) on a fixed clock: 10:00 on
// Wed Jun 9 2027 in Los Angeles. Its rows (vitals, the next appointment,
// the medications due and the todos) each show only with something to say,
// tinted and iconned by `todayStatus` (whose edges are todayStatus.test.ts's),
// each ending in "See all ›" to its full view (vitals: Show all in place,
// B-186). Given all stays on the medications row for writers (its Undo is
// medications/today.browser.test.tsx's and passUndo.test.ts's). The card starts
// collapsed to one line on every load (overdue and due-soon counts first,
// whose sums are todayStatus.test.ts's); a tap opens it for the page view. What the strips' old tests checked moved here;
// remembering across a remount (dimmed, then fresh) is
// timelineRemembered.browser.test.tsx's.

const G = TEST_GROUP.id;

/** Stands in for every other page: says where it is. */
function Probe() {
  const { pathname, search } = useLocation();
  return (
    <main>
      <h1>
        Probe {pathname}
        {search}
      </h1>
    </main>
  );
}

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [{ path: "/app/groups/:groupId/timeline/new/dose", module: newDose }],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: { default: Probe } },
  { path: "/app/groups/:groupId/planner", module: { default: Probe } },
  { path: "/app/groups/:groupId/medications/schedule", module: { default: Probe } },
  { path: "/app/groups/:groupId/todos", module: { default: Probe } },
];

const TODAY = "2027-06-09";
const LATE = medicationPass({ name: "Late", time: clockAt(-65), sortOrder: 0 });
const NOW = medicationPass({ name: "Now", time: clockAt(-3), sortOrder: 1 });
const LATER = medicationPass({ name: "Later", time: clockAt(30), sortOrder: 2 });
const med = (name: string, passId: string) =>
  fx.medication({ name, strength: "5 mg", schedule: { type: "scheduled", slots: [{ passId }] } });
const SA = med("Sa", LATE.id);
const SB = med("Sb", NOW.id);
const SC = med("Sc", NOW.id);
const SD = med("Sd", LATER.id);
const PASSES: Fixture[] = [LATE, NOW, LATER, SA, SB, SC, SD];

/** Two days old: amber. */
const OLD_BP = fx.vital({
  occurredAt: clockMoment(-49 * 60),
  readings: [{ type: "bloodPressure", systolic: 130, diastolic: 85 }],
} as never);
/** In an hour: blue. */
const CARDIOLOGY = fx.event({ title: "Cardiology", occurredAt: clockMoment(60) });
const WALKER = todo({ title: "Pick up the walker", dueOn: TODAY });
const DAY_NOTE = fx.note({ text: "A day", occurredAt: clockMoment(-30) });
const EVERYTHING: Fixture[] = [DAY_NOTE, OLD_BP, CARDIOLOGY, WALKER, ...PASSES];

const open = (fixtures: Fixture[], role: GroupRole = "caretaker") =>
  renderWithDevice({ route: ROUTES, url: TIMELINE_URL, role, fixtures });

const CARD = () => document.querySelector<HTMLElement>("main [data-today-card]");
const row = (name: string) => CARD()?.querySelector<HTMLElement>(`[data-today-row="${name}"]`) ?? null;
const shownRows = () =>
  [...(CARD()?.querySelectorAll<HTMLElement>("[data-today-row]") ?? [])].map((r) => r.dataset.todayRow);
const toggle = () => CARD()!.querySelector<HTMLButtonElement>("[data-today-toggle]")!;
/** Opens the card, which every load starts collapsed. */
const openCard = async () => {
  await userEvent.click(
    await found(
      () => CARD()?.querySelector<HTMLElement>('[data-today-toggle][aria-expanded="false"]') ?? null,
    ),
  );
  await expect.poll(() => toggle().getAttribute("aria-expanded")).toBe("true");
};
const seeAll = (name: string) => row(name)!.querySelector<HTMLAnchorElement>("a[data-see-all]")!;
const givenAll = () => row("medications")?.querySelector<HTMLButtonElement>("[data-given-all]") ?? null;
const medState = () => {
  const el = row("medications")?.querySelector<HTMLElement>("[data-med-state]");
  return [el?.dataset.medState ?? null, el?.dataset.medPass ?? null];
};

beforeEach(() => {
  fixClock(CLOCK);
});
afterEach(() => {
  clearUndo();
  vi.useRealTimers();
});

describe("the Today card's rows", () => {
  test("only rows with something to say; none at all hides the card; a row arrives with its data", async () => {
    const device = await open([DAY_NOTE, todo({ title: "Fax the form", dueOn: "2027-06-12" })]);
    await expect.element(page.getByText("A day")).toBeInTheDocument();
    // Once the medications and todos have answered (skeletons until then), nothing is left.
    await expect.poll(CARD).toBeNull();

    await device.sync([OLD_BP]);
    await device.settle();
    await expect.poll(shownRows).toEqual(["vitals"]);

    await device.sync([WALKER, ...PASSES]);
    await device.settle();
    await expect.poll(shownRows).toEqual(["vitals", "medications", "todos"]);
    // It sits above the list, at every width (the old vitals strip hid below `sm`).
    const list = await found(() => document.querySelector("main ol"));
    expect((CARD()?.compareDocumentPosition(list) ?? 0) & 4).toBeTruthy();
    await openCard();
    expect(row("vitals")?.checkVisibility()).toBe(true);
  });

  test("each status: its own icon and its words for screen readers; a calm row has neither", async () => {
    await open(EVERYTHING);
    await expect.poll(shownRows).toEqual(["vitals", "appointment", "medications", "todos"]);
    const look = (name: string) => {
      const r = row(name)!;
      return {
        status: r.dataset.status,
        icon: r.querySelector("svg[data-status-icon]")?.getAttribute("data-status-icon") ?? null,
        said: r.querySelector("[data-status-text]")?.textContent ?? null,
      };
    };
    expect(look("medications")).toEqual({ status: "error", icon: "error", said: "Urgent: " });
    expect(look("vitals")).toEqual({
      status: "warning",
      icon: "warning",
      said: "Needs attention: ",
    });
    expect(look("appointment")).toEqual({
      status: "info",
      icon: "info",
      said: "Coming up soon: ",
    });
    expect(look("todos")).toEqual({ status: "neutral", icon: null, said: null });
    // Every row's icon is hidden from screen readers: the words carry it.
    await expect.poll(() => CARD()?.querySelectorAll("li svg:not([aria-hidden])")).toHaveLength(0);
  });

  test("the rows' words: the latest readings with their time, the next appointment (+N more), the pass, the todo", async () => {
    await open([...EVERYTHING, fx.event({ title: "Dentist", occurredAt: clockMoment(26 * 60) })]);
    await expect.poll(shownRows).toHaveLength(4);
    expect(row("vitals")?.textContent).toMatch(/^Needs attention: Latest vitals: BP 130\/85 mmHg 2d ago/);
    const next = row("appointment")!.querySelector<HTMLAnchorElement>("a[data-next]")!;
    expect(next.textContent).toBe("Next: Cardiology · Today 11:00 AM · +1 more");
    expect(next.getAttribute("href")).toBe(`/app/groups/${G}/entries/${CARDIOLOGY.id}`);
    expect(row("medications")?.textContent).toContain("Overdue: Late · 8:55 · 1 med · +1 more");
    expect(row("todos")?.textContent).toMatch(/^Today: Pick up the walker/);
  });

  test("every row but vitals ends in See all, alike, to its full view", async () => {
    await open(EVERYTHING);
    await expect.poll(shownRows).toHaveLength(4);
    const links = ["appointment", "medications", "todos"].map((name) => ({
      name: seeAll(name).getAttribute("aria-label"),
      text: seeAll(name).textContent,
      href: seeAll(name).getAttribute("href"),
      look: seeAll(name).className,
    }));
    expect(links.map(({ name, text, href }) => ({ name, text, href }))).toEqual([
      { name: "See all in Planner", text: "See all", href: `/app/groups/${G}/planner` },
      { name: "See all medications", text: "See all", href: `/app/groups/${G}/medications/schedule` },
      { name: "See all todos", text: "See all", href: `/app/groups/${G}/todos?who=everyone` },
    ]);
    expect(new Set(links.map((l) => l.look)).size).toBe(1);
    // Vitals shows its readings in place instead (below).
    expect(row("vitals")?.querySelector("a[data-see-all]")).toBeNull();

    await openCard();
    await userEvent.click(seeAll("todos"));
    await expect
      .element(page.getByRole("heading", { name: `Probe /app/groups/${G}/todos?who=everyone` }))
      .toBeVisible();
  });
});

describe("the vitals row", () => {
  /** Four types' readings: more than a phone's line holds. */
  const MANY = fx.vital({
    occurredAt: clockMoment(-30),
    readings: [
      { type: "bloodPressure", systolic: 130, diastolic: 85 },
      { type: "heartRate", value: 70 },
      { type: "bloodGlucose", value: 120 },
      { type: "spo2", value: 97 },
    ],
  } as never);
  const showAll = () => row("vitals")?.querySelector<HTMLButtonElement>("button[data-show-all]") ?? null;
  const line = () => row("vitals")!.querySelector<HTMLElement>("[data-today-line]")!;
  /** Every reading lies inside the line's box (none cut off at its end). */
  const allInside = () => {
    const box = line().getBoundingClientRect();
    return [...line().querySelectorAll<HTMLElement>("[data-vital]")].every((v) => {
      const r = v.getBoundingClientRect();
      return r.right <= box.right + 1 && r.bottom <= box.bottom + 1;
    });
  };

  test("too many for the line: Show all wraps them in place (no navigation), Show less folds them back", async () => {
    const device = await open([DAY_NOTE, MANY, ...PASSES]);
    await openCard();
    await expect.poll(showAll).not.toBeNull();
    const button = showAll()!;
    expect(button.textContent).toBe("Show all");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe(line().id);
    expect(allInside()).toBe(false);
    const before = row("vitals")!.getBoundingClientRect().height;

    await userEvent.click(button);
    await expect.poll(() => showAll()?.getAttribute("aria-expanded")).toBe("true");
    await expect.poll(() => showAll()?.textContent).toBe("Show less");
    expect(device.location()).toBe(TIMELINE_URL);
    expect(line().querySelectorAll("[data-vital]")).toHaveLength(4);
    expect(allInside()).toBe(true);
    expect(row("vitals")?.getBoundingClientRect().height).toBeGreaterThan(before);

    await userEvent.click(await found(showAll));
    await expect.poll(() => showAll()?.getAttribute("aria-expanded")).toBe("false");
    expect(allInside()).toBe(false);
  });

  test("vitals that fit: no button", async () => {
    await renderWithDevice({
      route: ROUTES,
      url: TIMELINE_URL,
      fixtures: [DAY_NOTE, OLD_BP, ...PASSES],
      width: 1280,
    });
    await expect.poll(shownRows).toContain("medications");
    await openCard();
    await expect.poll(() => row("vitals")?.checkVisibility()).toBe(true);
    expect(allInside()).toBe(true);
    expect(showAll()).toBeNull();
  });
});

describe("the medications row", () => {
  test("Given all for a writer logs the overdue pass; the due pass follows", async () => {
    const device = await open([DAY_NOTE, ...PASSES]);
    await expect.poll(medState).toEqual(["overdue", `pass:${LATE.id}`]);
    await openCard();
    expect(givenAll()?.disabled).toBe(false);

    await userEvent.click(await found(givenAll));
    await expect.poll(medState).toEqual(["due", `pass:${NOW.id}`]);
    expect(row("medications")?.dataset.status).toBe("warning");
    expect(await device.query(DOSES_SQL)).toMatchObject([
      { medicationId: SA.id, scheduledFor: clockAt(-65) },
    ]);
  });

  test("the due pass's name opens the Dose sheet on it; once logged, the next pass shows, calm, with no Given all", async () => {
    const given = fx.dose({ medicationId: SA.id, scheduledFor: clockAt(-65), occurredAt: clockMoment(-60) });
    const device = await open([DAY_NOTE, ...PASSES, given]);
    await expect.poll(medState).toEqual(["due", `pass:${NOW.id}`]);
    expect(row("medications")?.textContent).toContain("Due: Now · 9:57 · 2 meds");

    await openCard();
    await userEvent.click(
      await found(() => row("medications")?.querySelector<HTMLElement>("[data-med-open]")),
    );
    await expect.poll(() => device.location()).toContain(`/timeline/new/dose?`);
    expect(new URLSearchParams(device.location().split("?")[1]).get("pass")).toBe(NOW.id);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[role=dialog]")).toBeNull();

    await userEvent.click(await found(givenAll));
    await expect.poll(medState).toEqual(["next", `pass:${LATER.id}`]);
    expect(row("medications")?.textContent).toContain("Next: Later · 10:30 · 1 med");
    expect(row("medications")?.dataset.status).toBe("neutral");
    expect(givenAll()).toBeNull();
  });

  test("a viewer sees the row as text with See all: no Dose sheet link, no Given all", async () => {
    await open([DAY_NOTE, ...PASSES], "viewer");
    await expect.poll(medState).toEqual(["overdue", `pass:${LATE.id}`]);
    expect(
      [...(row("medications")?.querySelectorAll("a, button") ?? [])].map((el) => el.textContent),
    ).toEqual(["See all"]);
  });
});

describe("the todos row", () => {
  test("overdue: red, my late todo first, +N more counting today's; done on another device, it goes", async () => {
    const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
    type TodoValues = Parameters<typeof todo>[0] & { id: string };
    const id = () => crypto.randomUUID();
    const walker: TodoValues = { id: id(), title: "Pick up the walker", dueOn: TODAY };
    const mine: TodoValues = {
      id: id(),
      title: "Refill the pill box",
      dueOn: "2027-06-08",
      assigneeId: TEST_USER.id,
    };
    const sams: TodoValues = {
      id: id(),
      title: "Call the pharmacy",
      dueOn: "2027-06-07",
      assigneeId: SAM.id,
    };
    const device = await open([SAM, DAY_NOTE, todo(walker), todo(sams), todo(mine)]);
    const words = () => row("todos")?.querySelector("[data-todo]")?.textContent ?? null;
    await expect.poll(() => row("todos")?.dataset.status).toBe("error");
    expect(words()).toBe("Overdue: Refill the pill box · +2 more");
    expect(seeAll("todos").getAttribute("href")).toBe(`/app/groups/${G}/todos?who=mine`);

    const done = (t: TodoValues) => todo({ ...t, doneAt: at(), doneBy: SAM.id });
    await device.sync([done(mine), done(walker)]);
    await device.settle();
    await expect.poll(words).toBe("Overdue: Call the pharmacy");
    expect(seeAll("todos").getAttribute("href")).toBe(`/app/groups/${G}/todos?who=everyone`);

    await device.sync(done(sams));
    await device.settle();
    await expect.poll(() => row("todos")).toBeNull();
  });
});

describe("the appointment row", () => {
  test("an event saved for later today is next at once; when its time passes it moves into the history", async () => {
    const device = await open([DAY_NOTE, CARDIOLOGY]);
    await expect
      .poll(() => row("appointment")?.querySelector<HTMLElement>("[data-next]")?.dataset.next)
      .toBe(CARDIOLOGY.id);
    const id = crypto.randomUUID();
    const saved = await materializeLiveEntry(device.db, {
      id,
      groupId: G,
      kind: "event",
      title: "Ride to the lab",
      // 10:01:20: after the history's end (the end of this minute), so still to come.
      occurredAt: new Date(CLOCK.getTime() + 80_000).toISOString(),
      timeZone: "America/Los_Angeles",
    });
    expect(saved.ok).toBe(true);
    await device.settle();
    await expect
      .poll(() => row("appointment")?.querySelector<HTMLElement>("[data-next]")?.dataset.next)
      .toBe(id);
    const history = () => document.querySelector('main section[aria-labelledby="timeline-heading"]')!;
    expect(history().querySelector(`a[href$="/entries/${id}"]`)).toBeNull();

    await vi.advanceTimersByTimeAsync(2 * 60_000);
    await device.settle();
    await expect.poll(() => !!history().querySelector(`a[href$="/entries/${id}"]`)).toBe(true);
    expect(row("appointment")?.querySelector<HTMLElement>("[data-next]")?.dataset.next).toBe(CARDIOLOGY.id);
  });
});

describe("collapsing the card", () => {
  const expanded = () => toggle().getAttribute("aria-expanded");
  const summary = () => CARD()?.querySelector<HTMLElement>("[data-today-summary]") ?? null;
  const part = (name: string) =>
    summary()?.querySelector<HTMLElement>(`[data-summary-part="${name}"]`) ?? null;

  test("collapsed on load, an overdue dose too; red overdue and orange due-soon counts lead the line", async () => {
    // 1 dose overdue; due soon: 2 doses due now, 1 in 30 min, Cardiology in an hour. The walker (no time) is due at 19:00.
    await open(EVERYTHING);
    await expect.poll(shownRows).toHaveLength(4);
    await expect
      .poll(() => summary()?.textContent)
      .toBe("1 overdue · 4 due soon · BP 130/85 mmHg · 1 todo today");
    expect(expanded()).toBe("false");
    expect(document.getElementById(toggle().getAttribute("aria-controls") ?? "")?.hidden).toBe(true);
    expect(row("vitals")?.checkVisibility()).toBe(false);

    await userEvent.click(toggle());
    await expect.poll(() => row("vitals")?.checkVisibility()).toBe(true);
    expect(summary()).toBeNull();
    await userEvent.click(toggle());
    await expect.poll(expanded).toBe("false");
  });

  test("on a narrow phone the counts stay whole; the rest is cut off", async () => {
    await renderWithDevice({ route: ROUTES, url: TIMELINE_URL, fixtures: EVERYTHING, width: 320 });
    await expect.poll(() => part("soon")?.textContent).toBe(" · 4 due soon");
    const box = toggle().getBoundingClientRect();
    for (const name of ["overdue", "soon"]) {
      const el = part(name)!;
      expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth);
      expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 1);
    }
    const rest = part("rest")!;
    expect(rest.scrollWidth).toBeGreaterThan(rest.clientWidth);
  });

  test("opened, it's collapsed again on the next load", async () => {
    const device = await open([DAY_NOTE, OLD_BP, WALKER]);
    await openCard();
    await device.screen.unmount();
    await open([DAY_NOTE, OLD_BP, WALKER]);
    await expect.poll(shownRows).toEqual(["vitals", "todos"]);
    expect(expanded()).toBe("false");
  });
});
