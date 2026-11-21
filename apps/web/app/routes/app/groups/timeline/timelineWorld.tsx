import type { Fixture } from "../../../../../test/fixtures";
import type { DeviceOptions, DeviceRoute } from "../../../../../test/device";

import { useNavigate, useParams } from "react-router";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";

// The timeline's component tests share one fictional world: a few days of
// every kind of entry by two people, providers linked to events, and older
// filler for paging. What phase2.mjs used to check against the seeds, against
// rows this file controls. Only `*.browser.test.tsx` files import it.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const daysAgo = (d: number, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return at(t);
};

export const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
export const LONG_TEXT =
  "Slept from ten until six with one waking at three. Asked about the garden twice and wanted to see the tomatoes. " +
  "Ate most of breakfast, half a banana and some toast with jam, and drank a full glass of water before the walk.";

/** The providers on the two events (two names, then two and "+1"). */
const lark = fx.provider({ name: "Dr. Mira Lark" });
const pharmacy = fx.provider({ name: "Corner Pharmacy", type: "pharmacy", specialty: null });
const tran = fx.provider({ name: "Dr. Ana Tran", specialty: "Cardiology" });

export const PHARMACY_PICKUP = fx.event({
  title: "Pharmacy pickup",
  occurredAt: minutesAgo(20),
  text: "Picked up the refill.",
});
export const PRIMARY_VISIT = fx.event({
  title: "Primary care visit",
  occurredAt: minutesAgo(25),
  createdBy: SAM.id,
  text: "Blood pressure looks better.",
});
export const LONG_NOTE = fx.note({ occurredAt: minutesAgo(10), text: LONG_TEXT });
export const SAM_SYMPTOM = fx.symptom({
  name: "Dizzy when standing",
  severity: 4,
  occurredAt: minutesAgo(15),
  createdBy: SAM.id,
});
export const BP = fx.vital({
  occurredAt: minutesAgo(30),
  readings: [
    { type: "bloodPressure", systolic: 128, diastolic: 82 },
    { type: "heartRate", value: 66 },
  ],
} as never);

/** Older filler, alternating kinds and authors, one a few hours apart: `count` entries before today. */
const filler = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const occurredAt = daysAgo(1 + Math.floor(i / 6), 8 + (i % 6) * 2);
    const createdBy = i % 2 ? SAM.id : TEST_USER.id;
    if (i % 3 === 0) return fx.note({ occurredAt, createdBy, text: `Older note ${i}` });
    if (i % 3 === 1) return fx.symptom({ occurredAt, createdBy: SAM.id, name: `Older symptom ${i}` });
    return fx.vital({ occurredAt, createdBy, readings: [{ type: "heartRate", value: 60 + (i % 20) }] });
  });

/** The today entries (5) and their providers, then `older` filler entries. */
export const world = (older = 40): Fixture[] => [
  SAM,
  lark,
  pharmacy,
  tran,
  LONG_NOTE,
  SAM_SYMPTOM,
  PHARMACY_PICKUP,
  PRIMARY_VISIT,
  BP,
  fx.link(PHARMACY_PICKUP.id, lark.id),
  fx.link(PHARMACY_PICKUP.id, pharmacy.id),
  fx.link(PRIMARY_VISIT.id, lark.id),
  fx.link(PRIMARY_VISIT.id, pharmacy.id),
  fx.link(PRIMARY_VISIT.id, tran.id),
  ...filler(older),
];
export const TODAY_COUNT = 5;

export const TIMELINE_URL = `/app/groups/${TEST_GROUP.id}/timeline`;

/** Stands in for the entry page: says which entry, and has a Back button (history -1). */
function EntryProbe() {
  const { entryId } = useParams();
  const navigate = useNavigate();
  return (
    <main>
      <h1>Entry page {entryId}</h1>
      <button type="button" onClick={() => void navigate(-1)}>
        Go back
      </button>
    </main>
  );
}

/** The timeline with its sheets, and a stand-in entry page. */
export const TIMELINE_ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [
      { path: "/app/groups/:groupId/timeline/new/:kind", module: newSheet },
      { path: "/app/groups/:groupId/timeline/:entryId/edit", module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: { default: EntryProbe } },
];

/** Open the timeline on the test device, with `query` (`?kind=…`) after its URL. */
export const openTimeline = ({ query = "", ...options }: Partial<DeviceOptions> & { query?: string } = {}) =>
  renderWithDevice({ route: TIMELINE_ROUTES, url: `${TIMELINE_URL}${query}`, fixtures: world(), ...options });

// --- DOM helpers (the same selectors phase2.mjs used) ------------------------

export const rows = () => [...document.querySelectorAll<HTMLLIElement>("ol > li:not([data-marker])")];
/** The first row of a kind, by its sr-only "Note: " prefix. */
export const rowOf = (label: string) =>
  rows().find((li) => li.querySelector(".sr-only")?.textContent === `${label}: `);
export const rowWith = (text: string) => rows().find((li) => li.textContent?.includes(text));
export const rowKinds = () =>
  [...new Set(rows().map((li) => li.querySelector(".sr-only")?.textContent))].join(",");
/** The kind chips: in the Filter sheet (`openFilters()` first). */
export const chips = () => [
  ...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Show entries"] a'),
];
export const chip = (label: string) => chips().find((a) => a.textContent?.trim() === label)!;
/** The removable chips under the Filter button, one per filter on. */
export const activeChips = () => [
  ...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Filters on"] a'),
];
/** The filters on, by their chips' names ("Symptoms: clear this filter,By …"); "" with none. */
export const currentChips = () =>
  activeChips()
    .map((a) => a.getAttribute("aria-label") ?? a.textContent?.trim())
    .join(",");
export const filterButton = () => document.querySelector<HTMLButtonElement>("button[data-filter-button]")!;
const filterSheet = () => document.querySelector('[role="dialog"]');
/** Open the Filter sheet with its button, once the screen is up. */
export const openFilters = async () => {
  await waitUntil(() => !!filterButton(), 4000, "the Filter button");
  await userEvent.click(filterButton());
  await waitUntil(() => chips().length > 0, 4000, "the Filter sheet");
};
/** Done: close the Filter sheet. */
export const closeFilters = async () => {
  await userEvent.click(button("Done")!);
  await waitUntil(() => !filterSheet(), 4000, "the Filter sheet to close");
};
export const iconOf = (li: Element) =>
  li.querySelector<HTMLAnchorElement>('a[aria-label^="Show only"]:not([data-author])')!;
export const authorOf = (li: Element) => li.querySelector<HTMLAnchorElement>("a[data-author]")!;
export const openOf = (li: Element) =>
  li.querySelector<HTMLAnchorElement>('a[aria-label^="Open "], a[aria-label^="Edit "]');
export const button = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
export const view = () => document.querySelector("ol")?.dataset.view;

/** Open the header's View options menu (layout, day summaries, simple view). */
export const openViewOptions = async () => {
  await userEvent.click(document.querySelector<HTMLElement>('button[aria-label="View options"]')!);
  await waitUntil(() => !!document.querySelector('[role="menu"]'), 4000, "the View options menu");
};

/** Choose an item of the View options menu by its name ("Cards", "Simple view"). */
export const chooseViewOption = async (name: string) => {
  await openViewOptions();
  const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) =>
    el.textContent?.trim().startsWith(name),
  );
  if (!item) throw new Error(`no "${name}" in View options`);
  await userEvent.click(item);
};

/** Switch rows/cards in the header's View options menu, and wait for the list. */
export const setView = async (to: "Rows" | "Cards") => {
  if (view() === to.toLowerCase()) return;
  await chooseViewOption(to);
  await waitUntil(() => view() === to.toLowerCase());
};

/** Poll a condition (a DOM read) until it holds, or fail with `what`. */
export const waitUntil = async (test: () => boolean, ms = 4000, what = "condition") => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for ${what}`);
};

export const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });

/** A real tap at the centre of an element, landing on whatever is on top there (the row's open target over its text). */
export const tapAt = (el: Element) => userEvent.click(el, { force: true });
