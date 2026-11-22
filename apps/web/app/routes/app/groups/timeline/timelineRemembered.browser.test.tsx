import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { Link } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, medicationPass, todo, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import { clockAt, fixClock } from "../medications/medicationWorld";
import * as timeline from "./route";
import { TIMELINE_URL, waitUntil } from "./timelineWorld";

// The tile cache (timeline-ux slice 2, B-166): the header tiles never pop
// in. Mounted again in the same session (Back from another page), a Today
// card row paints what it showed before at once, dimmed with `data-stale`,
// and the live answer replaces it, whatever it says. A first mount shows a
// skeleton of the row's own height, so what's below doesn't move; an empty
// answer collapses it. The same for simple mode's todos and tiles. The store's
// keys and clearing are remembered.test.ts's and index.test.ts's.

/** Stands in for any other page: a link back to the timeline. */
function Elsewhere() {
  return (
    <main>
      <h1>Elsewhere</h1>
      <Link to={TIMELINE_URL}>Back to the timeline</Link>
    </main>
  );
}

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/timeline", module: timeline },
  { path: "/app/groups/:groupId/todos", module: { default: Elsewhere } },
];

const LATE = medicationPass({ name: "Late", time: clockAt(-65), sortOrder: 0 });
const SA = fx.medication({
  name: "Sa",
  strength: "5 mg",
  schedule: { type: "scheduled", slots: [{ passId: LATE.id }] },
});

const day = (n: number) => addDays(localDate(new Date(), TEST_TIME_ZONE), n);

/** What a tile looked like at one moment: absent, a skeleton, or there (dimmed or not) with its text. */
type Seen = "none" | "skeleton" | { stale: boolean; text: string };

const seen = (selector: string, skeleton: string, words?: string): Seen => {
  if (
    document.querySelector(
      `main [data-today-skeleton="${skeleton}"], main [data-simple-skeleton="${skeleton}"]`,
    )
  )
    return "skeleton";
  const el = document.querySelector<HTMLElement>(`main ${selector}`);
  if (!el) return "none";
  const text = words ? el.querySelector(words)?.textContent : el.textContent;
  return { stale: !!el.closest("[data-stale]"), text: text ?? "" };
};

/** Every state the page passed through from now on (each DOM change, as committed), until `stop()`. */
const watchPage = <T,>(read: () => T) => {
  const states: T[] = [read()];
  const observer = new MutationObserver(() => states.push(read()));
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  return {
    states,
    stop: () => {
      observer.takeRecords();
      observer.disconnect();
      states.push(read());
    },
  };
};

const TODOS = '[data-today-row="todos"]';
const MEDS = '[data-today-row="medications"]';
const todoStrip = () => seen(TODOS, "todos", "[data-todo]");
// What sits right below the card (the quick-entry box, then the list): its
// top is where the card ends. The list itself moves later for quick entry's
// own reason (its "gave Late" chip under the box), which isn't a tile.
const listTop = () =>
  document.querySelector("main ol") &&
  (document.querySelector("main [data-quick-entry]")?.getBoundingClientRect().top ?? null);

describe("the header tiles remember", () => {
  // A pass overdue at 10:00 on the fixed clock.
  beforeEach(() => {
    fixClock();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("mounted again in the session, a row paints its last answer at once, dimmed, then the live one, even when it differs", async () => {
    const device = await renderWithDevice({
      route: ROUTES,
      url: TIMELINE_URL,
      fixtures: [fx.note({ text: "A day" }), todo({ title: "Call the pharmacy", dueOn: day(-2) })],
    });
    await waitUntil(() => typeof todoStrip() === "object", 4000, "the todo strip");
    expect(todoStrip()).toEqual({ stale: false, text: "Overdue: Call the pharmacy" });

    // Away to another page, where the answer changes (another device's todo arrives).
    // The card starts collapsed: open it to reach See all.
    await userEvent.click(await found(() => document.querySelector<HTMLElement>("main [data-today-toggle]")));
    await userEvent.click(
      await found(() => document.querySelector<HTMLElement>('[data-today-row="todos"] a[data-see-all]')),
    );
    await waitUntil(() => !!document.querySelector("h1")?.textContent?.includes("Elsewhere"));
    await device.sync([todo({ title: "Refill the pill box", dueOn: day(-3) })]);

    const page = watchPage(todoStrip);
    await userEvent.click(await found(() => document.querySelector<HTMLElement>("main a")));
    await waitUntil(
      () => {
        const s = todoStrip();
        return typeof s === "object" && !s.stale && s.text.includes("Refill");
      },
      4000,
      "the live answer",
    );
    page.stop();

    const shown = page.states.filter((s) => s !== "none");
    // Never a skeleton: the remembered answer, dimmed, came first.
    expect(shown).not.toContain("skeleton");
    expect(shown[0]).toEqual({ stale: true, text: "Overdue: Call the pharmacy" });
    expect(shown.at(-1)).toEqual({ stale: false, text: "Overdue: Refill the pill box · +1 more" });
  });

  test("a first mount holds each row's height with a skeleton, so what's below them doesn't move when they answer", async () => {
    const page = watchPage(() => ({ meds: seen(MEDS, "medications"), todos: todoStrip(), top: listTop() }));
    await renderWithDevice({
      route: ROUTES,
      url: TIMELINE_URL,
      role: "caretaker",
      fixtures: [fx.note({ text: "A day" }), LATE, SA, todo({ title: "Call the pharmacy", dueOn: day(-2) })],
    });
    await waitUntil(
      () => typeof seen(MEDS, "medications") === "object" && typeof todoStrip() === "object",
      4000,
      "both strips",
    );
    page.stop();

    const withList = page.states.filter((s) => s.top !== null);
    // The list's first paint had both skeletons above it.
    expect(withList[0]).toMatchObject({ meds: "skeleton", todos: "skeleton" });
    expect(withList.at(-1)).toMatchObject({ meds: { stale: false }, todos: { stale: false } });
    // And its top never moved.
    expect(new Set(withList.map((s) => s.top)).size).toBe(1);
  });

  test("an empty answer collapses the row's skeleton (and the card, with nothing else in it)", async () => {
    const page = watchPage(() => ({ meds: seen(MEDS, "medications"), todos: todoStrip(), top: listTop() }));
    await renderWithDevice({
      route: ROUTES,
      url: TIMELINE_URL,
      fixtures: [fx.note({ text: "A day" }), todo({ title: "Fax the form", dueOn: day(3) })],
    });
    await waitUntil(
      () => listTop() !== null && seen(MEDS, "medications") === "none" && todoStrip() === "none",
      4000,
      "the skeletons to go",
    );
    page.stop();
    const withList = page.states.filter((s) => s.top !== null);
    expect(withList[0]).toMatchObject({ meds: "skeleton", todos: "skeleton" });
    // Collapsed once, never a strip.
    expect(page.states.some((s) => typeof s.meds === "object" || typeof s.todos === "object")).toBe(false);
  });
});

describe("simple mode's tiles remember", () => {
  const SIMPLE: Fixture[] = [
    fx.member({ userId: TEST_USER.id, role: "owner", simpleMode: 1 }),
    fx.note({ occurredAt: at(new Date(Date.now() - 10 * 60_000)), text: "Slept well after lunch" }),
    todo({ title: "Water the plants", dueOn: day(-1), assigneeId: TEST_USER.id }),
  ];
  const todos = () => seen("[data-simple-todos]", "todos");
  const tiles = () => seen("[data-simple-tiles]", "tiles");

  test("skeletons on a first mount; mounted again, the todos card and tiles paint dimmed, then fresh", async () => {
    const first = watchPage(() => ({ todos: todos(), tiles: tiles() }));
    const device = await renderWithDevice({ route: ROUTES, url: TIMELINE_URL, role: null, fixtures: SIMPLE });
    await waitUntil(
      () => typeof todos() === "object" && typeof tiles() === "object",
      4000,
      "the todos card and tiles",
    );
    first.stop();
    expect(first.states.find((s) => s.todos !== "none")).toMatchObject({ todos: "skeleton" });
    expect(first.states.find((s) => s.tiles !== "none")).toMatchObject({ tiles: "skeleton" });
    expect(todos()).toMatchObject({ stale: false });
    expect(tiles()).toMatchObject({ stale: false });

    await userEvent.click(await found(() => document.querySelector<HTMLElement>("[data-simple-todos-all]")));
    await waitUntil(() => !!document.querySelector("h1")?.textContent?.includes("Elsewhere"));
    const again = watchPage(() => ({ todos: todos(), tiles: tiles() }));
    await userEvent.click(await found(() => document.querySelector<HTMLElement>("main a")));
    await waitUntil(
      () => {
        const [t, l] = [todos(), tiles()];
        return typeof t === "object" && !t.stale && typeof l === "object" && !l.stale;
      },
      4000,
      "the live answers",
    );
    await device.settle();
    again.stop();

    const shown = again.states.filter((s) => s.todos !== "none");
    expect(shown.some((s) => s.todos === "skeleton" || s.tiles === "skeleton")).toBe(false);
    expect(shown[0]).toMatchObject({ todos: { stale: true }, tiles: { stale: true } });
    expect(shown.at(-1)).toMatchObject({ todos: { stale: false }, tiles: { stale: false } });
  });
});
