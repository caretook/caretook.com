import type { DeviceRoute } from "../../../../../test/device";

import { userEvent } from "vitest/browser";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import * as period from "../period/route";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as periods from "./route";

// The care periods' component tests share one fictional track, like the
// seeds' (care-periods.mjs used them): Home → Emergency room → Hospital at
// Riverside General with a room → Rehab → Home, over eight weeks, in the
// recipient's zone (America/Los_Angeles, the test browser's too). Only
// `*.browser.test.tsx` files import it.

/** `hour`:`minute` local time, `d` days back (midnight with no hour). */
export const daysAgo = (d: number, hour = 0, minute = 0) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, minute, 0, 0);
  return t;
};

export const RIVERSIDE = fx.provider({
  name: "Riverside General Hospital",
  type: "practice",
  specialty: null,
  phones: [
    { label: "Main", number: "555-0140" },
    { label: "4 West nurses' station", number: "555-0141" },
  ],
  address: "1200 Riverside Drive\nSpringfield",
  website: "https://riverside.example.org",
});

export const HOME_FIRST = fx.period({ type: "home", startedAt: at(daysAgo(56)), dateOnly: 1 });
export const ER = fx.period({ type: "emergency", label: "Riverside ER", startedAt: at(daysAgo(20, 21, 40)) });
export const HOSPITAL = fx.period({
  type: "hospital",
  label: "Cardiac unit (4 West)",
  placeProviderId: RIVERSIDE.id,
  placeDetail: "Room 412, bed B",
  startedAt: at(daysAgo(19, 3, 15)),
});
export const REHAB = fx.period({ type: "rehab", label: "Oak Hills Rehab", startedAt: at(daysAgo(12, 11)) });
export const HOME_NOW = fx.period({ type: "home", startedAt: at(daysAgo(5, 15, 30)) });

/** The track, oldest first, and the hospital's place. */
export const track = () => [RIVERSIDE, HOME_FIRST, ER, HOSPITAL, REHAB, HOME_NOW];

export const GROUP = TEST_GROUP.id;
export const PERIODS_URL = `/app/groups/${GROUP}/periods`;
export const periodUrl = (id: string) => `${PERIODS_URL}/${id}`;

/** The periods page with its sheets, and a period's page (as routes.ts nests them). */
export const PERIOD_ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/periods",
    module: periods,
    children: [
      { path: "/app/groups/:groupId/periods/new", module: newSheet },
      { path: "/app/groups/:groupId/periods/:periodId/edit", module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/periods/:periodId", module: period },
];

// --- DOM helpers (care-periods.mjs's selectors) ------------------------------

export const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

/** The periods page's rows, newest first. */
export const listRows = () =>
  [...document.querySelectorAll<HTMLLIElement>("main [data-period-list] > li")].map((li) => ({
    id: li.dataset.period!,
    current: li.dataset.current === "true",
    title: li.querySelector("[data-period-title]")?.textContent?.trim() ?? null,
    place: li.querySelector("[data-period-place]")?.textContent?.trim() ?? null,
    dates: li.querySelector("[data-period-dates]")?.textContent?.trim() ?? "",
  }));

export const SHEET = () => $("[role=dialog]");
export const FORM = () => $<HTMLFormElement>("[role=dialog] [data-period-form]");
export const field = <T extends HTMLElement = HTMLInputElement>(name: string) =>
  FORM()?.querySelector<T>(`[name="${name}"]`) ?? null;
export const typeRadio = (label: string) =>
  FORM()?.querySelector<HTMLInputElement>(`input[name="type"][aria-label="${label}"]`) ?? null;
export const submit = () => FORM()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
export const formButton = (text: string) =>
  [...(FORM()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === text)!;
/** A field's message, through its `aria-describedby`. */
export const errorOf = (name: string) => {
  const id = field(name)
    ?.getAttribute("aria-describedby")
    ?.split(" ")
    .find((x) => x.endsWith("-error"));
  return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
};
export const PICKER = () =>
  FORM()?.querySelector<HTMLInputElement>('[data-place-picker] input[role="combobox"]') ?? null;
export const pickerChip = () =>
  FORM()?.querySelector("[data-place-picker] li[data-chip]")?.textContent?.trim() ?? null;
export const option = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.firstElementChild?.textContent === text,
  );

/** Poll a condition (a DOM read) until it holds, or fail with `what`. */
export const waitUntil = async (test: () => boolean, ms = 4000, what = "condition") => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** Type `text` in the place picker and take `optionText` from its list. */
export const pickPlace = async (text: string, optionText: string) => {
  await userEvent.click(PICKER()!);
  await userEvent.keyboard(text);
  await waitUntil(() => !!option(optionText), 4000, `the option ${optionText}`);
  await userEvent.click(option(optionText)!);
};

/** The device's live periods, in track order. */
export const TRACK_SQL =
  "SELECT id, type, label, place_provider_id, place_detail, started_at, date_only, deleted_at FROM care_period WHERE group_id = ? AND deleted_at IS NULL ORDER BY started_at, created_at, id";
