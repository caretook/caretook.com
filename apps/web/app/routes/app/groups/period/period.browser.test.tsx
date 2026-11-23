import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_TIME_ZONE, TEST_USER } from "../../../../../test/fixtures";
import {
  daysAgo,
  field,
  FORM,
  GROUP,
  HOSPITAL,
  listRows,
  PERIOD_ROUTES,
  PERIODS_URL,
  periodUrl,
  REHAB,
  RIVERSIDE,
  SHEET,
  submit,
  track,
  typeRadio,
} from "../periods/periodWorld";

// A care period's page (care-periods.mjs's page, notes, edit, delete and
// removed-place steps): its details, the place with every contact action,
// the periods before and after, the notes document made on the first change
// (read-only for a viewer, who gets no Edit or Delete), the edit sheet from
// the page and back, Delete behind its confirm, a period deleted elsewhere,
// a place deleted from the directory, and the 404s. Two browsers writing
// one document together, and an offline edit reaching another, are
// live-notes.mjs's; a period's row reaching another device is roundtrip.mjs's
// sync matrix (6b).

/** An Other period inside the rehab stay (10 days back, 14:00), then a hospital one at 18:00. */
const NOTES_START = daysAgo(10, 14);
const NOTES_STAY = fx.period({ type: "other", label: "Notes stay", startedAt: at(NOTES_START) });
const GONE_STAY = fx.period({ type: "hospital", label: "Gone stay", startedAt: at(daysAgo(10, 18)) });
const fixtures = () => [...track(), NOTES_STAY, GONE_STAY];

/**
 * "Jun 4, 15:30" for this instant on the recipient's clock. The fixtures are
 * built on the browser's clock and the page shows the recipient's, so a viewer
 * in another zone sees the same instant at a different hour.
 */
const shownAt = (when: Date) => {
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: TEST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(when);
  return new RegExp(`^\\w{3} \\d+, ${clock}$`);
};
const TWO_HOURS = 2 * 3_600_000;

const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: PERIOD_ROUTES, url, fixtures: fixtures(), ...options });

const pageState = () => ({
  h1: document.querySelector<HTMLElement>("main h1")?.textContent?.trim(),
  type: document.querySelector<HTMLElement>("main [data-period-type]")?.textContent?.trim(),
  now: !!document.querySelector<HTMLElement>('main header [data-region="title"] .badge'),
  place: document.querySelector<HTMLElement>("main [data-period-place]")?.textContent?.trim() ?? null,
  placeLink: document.querySelector<HTMLElement>("main [data-period-place] a")?.getAttribute("href") ?? null,
  removed: !!document.querySelector<HTMLElement>("main [data-place-removed]"),
  actions: [...document.querySelectorAll<HTMLElement>("main [data-contact-actions] a[data-action]")].map(
    (a) => a.dataset.action,
  ),
  start: document.querySelector<HTMLElement>("main [data-period-start]")?.textContent?.trim(),
  end: document.querySelector<HTMLElement>("main [data-period-end]")?.textContent?.trim(),
  length: document.querySelector<HTMLElement>("main [data-period-length]")?.textContent?.trim() ?? null,
  previous:
    document
      .querySelector<HTMLElement>('main [data-period-neighbour="previous"]')
      ?.getAttribute("aria-label") ?? null,
  next:
    document.querySelector<HTMLElement>('main [data-period-neighbour="next"]')?.getAttribute("aria-label") ??
    null,
  edit: !!document.querySelector<HTMLElement>("main a[data-edit-period]"),
  menu: !!document.querySelector<HTMLElement>('main header button[aria-label^="Actions for"]'),
  editable: document.querySelector<HTMLElement>("main .ProseMirror")?.getAttribute("contenteditable") ?? null,
});
const onPage = (id: string) => () =>
  !!document.querySelector<HTMLElement>(`main[data-period-page="${id}"]`) &&
  !!document.querySelector<HTMLElement>("main .ProseMirror");
const NOT_FOUND = () => page.getByRole("heading", { name: "Not found" });

describe("the period page", () => {
  test("shows the type, label, place with its room and every contact action, start, end and length, and the periods before and after", async () => {
    await open(periodUrl(HOSPITAL.id));
    await waitUntil(onPage(HOSPITAL.id), "the page");
    const state = pageState();
    expect(state).toMatchObject({
      h1: "Hospital · Cardiac unit (4 West)",
      type: "Hospital",
      now: false,
      place: "Riverside General Hospital, Room 412, bed B",
      placeLink: `/app/groups/${GROUP}/providers/${RIVERSIDE.id}`,
      length: "7 days",
    });
    expect(state.actions.filter((a) => a === "call")).toHaveLength(2);
    expect(state.actions).toEqual(expect.arrayContaining(["map", "website"]));
    expect(state.start).toMatch(shownAt(daysAgo(19, 3, 15)));
    expect(state.end).toMatch(shownAt(daysAgo(12, 11)));
    expect(state.previous).toMatch(/^Previous period: Emergency room, /);
    expect(state.next).toMatch(/^Next period: Rehab, /);
  });

  test("the current period has the Now badge and 'Now · day N'", async () => {
    const [current] = track().slice(-1);
    await open(periodUrl(current!.id));
    await waitUntil(onPage(current!.id), "the page");
    const state = pageState();
    expect(state.now).toBe(true);
    expect(state.end).toMatch(/^Now · day \d+$/);
    expect(state.length).toBeNull();
    expect(state.next).toBeNull();
  });

  test("Next opens the next period, whose Previous links back", async () => {
    const device = await open(periodUrl(HOSPITAL.id));
    await waitUntil(onPage(HOSPITAL.id), "the page");
    await userEvent.click(getByCss('main [data-period-neighbour="next"]'));
    await waitUntil(
      () => document.querySelector<HTMLElement>("main h1")?.textContent === "Rehab · Oak Hills Rehab",
      "the next page",
    );
    expect(device.location()).toBe(periodUrl(REHAB.id));
    expect(
      document.querySelector<HTMLElement>('main [data-period-neighbour="previous"]')?.getAttribute("href"),
    ).toBe(periodUrl(HOSPITAL.id));
  });

  test("a place deleted from the directory shows greyed '(removed)', with no link or contact actions", async () => {
    const place = fx.provider({ name: "Hillcrest Clinic", type: "practice", deletedAt: at(daysAgo(1)) });
    const stay = fx.period({
      type: "rehab",
      label: "Removed place",
      placeProviderId: place.id,
      startedAt: at(daysAgo(9, 12)),
    });
    await open(periodUrl(stay.id), { fixtures: [...fixtures(), place, stay] });
    await waitUntil(onPage(stay.id), "the page");
    expect(pageState()).toMatchObject({
      removed: true,
      place: "Hillcrest Clinic (removed)",
      placeLink: null,
      actions: [],
    });
  });
});

describe("the 404s", () => {
  const OTHER = {
    group: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b02",
    recipient: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c02",
  };
  const otherGroup = [
    fx.group({ id: OTHER.group, name: "Moreno Family 2" }),
    fx.recipient({
      id: OTHER.recipient,
      groupId: OTHER.group,
      name: "Lou Moreno",
      preferredName: "Grandpa Lou",
    }),
    fx.member({ userId: TEST_USER.id, groupId: OTHER.group, role: "owner" }),
  ];
  const deleted = fx.period({
    type: "rehab",
    label: "Deleted stay",
    startedAt: at(daysAgo(2)),
    deletedAt: at(daysAgo(1)),
  });

  test.each([
    ["another group's period (the user is in both)", `/app/groups/${OTHER.group}/periods/${HOSPITAL.id}`],
    ["a missing period", periodUrl("7e1c9a40-2b6d-4f3e-8a15-000000000000")],
    ["a deleted period", periodUrl(deleted.id)],
  ])("%s is Not found, with no names", async (_, url) => {
    await open(url, { fixtures: [...fixtures(), otherGroup, deleted] });
    await expect.element(NOT_FOUND()).toBeVisible();
    expect(document.querySelector<HTMLElement>("main")?.textContent).not.toMatch(/Cardiac|Deleted stay/);
  });
});

describe("the notes", () => {
  test("a writer's first change makes the period's document (subject carePeriod)", async () => {
    const device = await open(periodUrl(NOTES_STAY.id));
    await waitUntil(onPage(NOTES_STAY.id), "the page");
    await waitUntil(() => pageState().editable === "true", "an editable editor");
    expect(await device.query("SELECT id FROM note_document WHERE id = ?", [NOTES_STAY.id])).toEqual([]);
    await userEvent.click(getByCss("main .ProseMirror"));
    await userEvent.keyboard("Bring the discharge papers");
    await expect
      .poll(() =>
        device.query("SELECT subject, care_period_id FROM note_document WHERE id = ?", [NOTES_STAY.id]),
      )
      .toEqual([{ subject: "carePeriod", care_period_id: NOTES_STAY.id }]);
  });

  test("a viewer reads the notes read-only, with no Edit or Delete", async () => {
    const doc = fx.document({ ownerId: NOTES_STAY.id, subject: "carePeriod", text: "Visiting 2-8pm" });
    await open(periodUrl(NOTES_STAY.id), { role: "viewer", fixtures: [...fixtures(), doc] });
    await waitUntil(onPage(NOTES_STAY.id), "the page");
    await waitUntil(
      () =>
        !!document.querySelector<HTMLElement>("main .ProseMirror")?.textContent?.includes("Visiting 2-8pm"),
      "the notes",
    );
    expect(pageState()).toMatchObject({ editable: "false", edit: false, menu: false });
    await expect
      .element(page.getByText("Shared with the care group. You can view these notes."))
      .toBeVisible();
  });
});

describe("editing from the page", () => {
  test("Edit opens the sheet filled from the period; a new label and an earlier start save back to the page, and the period before now ends at it", async () => {
    const device = await open(periodUrl(NOTES_STAY.id));
    await waitUntil(onPage(NOTES_STAY.id), "the page");
    await userEvent.click(getByCss("main a[data-edit-period]"));
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(device.location()).toBe(`${periodUrl(NOTES_STAY.id)}/edit`);
    expect(field("label")?.value).toBe("Notes stay");
    expect(typeRadio("Other")?.checked).toBe(true);

    await userEvent.fill(await found(() => field("label")), "Notes stay edited");
    // Two hours earlier on the recipient's clock (14:00 → 12:00 in Los Angeles, 11:00 → 09:00 for a
    // New York browser): the hour segment counts within AM or PM, so it mustn't cross noon.
    await userEvent.click(await found(() => FORM()?.querySelector('[data-period-start] [data-type="hour"]')));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await userEvent.click(submit());
    await waitUntil(
      () => !SHEET() && document.querySelector<HTMLElement>("main h1")?.textContent === "Notes stay edited",
      "the page with the new label",
    );
    expect(device.location()).toBe(periodUrl(NOTES_STAY.id));
    await device.settle();
    const earlier = shownAt(new Date(NOTES_START.getTime() - TWO_HOURS));
    expect(pageState().start).toMatch(earlier);

    await userEvent.click(getByCss('main [data-period-neighbour="previous"]'));
    await waitUntil(
      () => document.querySelector<HTMLElement>("main h1")?.textContent === "Rehab · Oak Hills Rehab",
      "the period before",
    );
    expect(pageState().end).toMatch(earlier);
  });
});

describe("deleting", () => {
  test("Delete asks first, saying the period before runs on; then the list, without it, and the delete is queued", async () => {
    const device = await open(periodUrl(GONE_STAY.id));
    await waitUntil(onPage(GONE_STAY.id), "the page");
    const end = pageState().end;
    await userEvent.click(getByCss('main header button[aria-label^="Actions for"]'));
    await userEvent.click(page.getByRole("menuitem", { name: "Delete" }));
    const dialog = () => document.querySelector<HTMLDialogElement>("dialog[open]");
    await waitUntil(() => !!dialog(), "the confirm");
    await expect
      .poll(() => dialog()?.querySelector("p")?.textContent?.trim())
      .toBe(`Notes stay will continue until ${end}.`);
    await userEvent.click(await found(() => dialog()?.querySelector(".btn-error")));
    await expect.poll(device.location).toBe(PERIODS_URL);
    await device.settle();
    expect(listRows().map((r) => r.id)).not.toContain(GONE_STAY.id);
    const [op] = await device.queued();
    expect(op).toMatchObject({ op: "PATCH", type: "care_period", id: GONE_STAY.id });
    expect(op?.data?.deleted_at).toBeTruthy();
  });

  /** GONE_STAY as another device's delete brings it. */
  const gone = () => ({ ...GONE_STAY, row: { ...GONE_STAY.row, deleted_at: at() } });

  test("a period deleted on another device: the page before it shows its end extended to the next one's start", async () => {
    const device = await open(periodUrl(NOTES_STAY.id));
    await waitUntil(onPage(NOTES_STAY.id), "the page");
    expect(pageState().next).toMatch(/^Next period: Hospital, /);
    await device.sync(gone());
    await device.settle();
    // The period after GONE_STAY is the current Home, from 15:30 five days back.
    expect(pageState().end).toMatch(shownAt(daysAgo(5, 15, 30)));
    expect(pageState().next).toMatch(/^Next period: Home, /);
  });

  test("a period deleted on another device while its page is open says so, with no Edit", async () => {
    const device = await open(periodUrl(GONE_STAY.id));
    await waitUntil(onPage(GONE_STAY.id), "the page");
    await device.sync(gone());
    await expect.element(page.getByText("This care period was deleted.")).toBeVisible();
    expect(pageState().edit).toBe(false);
  });
});
