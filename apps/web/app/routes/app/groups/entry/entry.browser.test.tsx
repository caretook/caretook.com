import type { RouteModule } from "../../../../../test/device";
import type { Route } from "./+types/route";

import { useNavigate } from "react-router";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as editSheet from "../timeline/edit/route";
import * as newSheet from "../timeline/new/route";
import * as timeline from "../timeline/route";
import * as entryRoute from "./route";

// The entry page on the test device (from live-notes.mjs): the draft that
// writes nothing until the first real change, one-tap Note and Event from
// the timeline, the URL replace, "Event" and the title chips, the header
// (time chip with its calendar, Delete, Share), who's writing (avatars, as
// another device's edits arrive by sync), the viewer, 404s, and the
// appointment details (pick a day first, end time, place, all day). What
// syncs between real devices stays in live-notes.mjs. Which titles the chips
// suggest is titleSuggestions.test.ts's.

const GROUP = TEST_GROUP.id;
const TIMELINE = `/app/groups/${GROUP}/timeline`;
const entryPath = (id: string) => `/app/groups/${GROUP}/entries/${id}`;
const ON_ENTRY = /\/entries\/[0-9a-f-]{36}$/;

/** The real entry page, with a Back button (history -1) below it. */
function EntryWithBack(props: Route.ComponentProps) {
  const navigate = useNavigate();
  const Page = entryRoute.default;
  return (
    <>
      <Page {...props} />
      <button type="button" onClick={() => void navigate(-1)}>
        Go back
      </button>
    </>
  );
}
const ENTRY = { ...entryRoute, default: EntryWithBack } as RouteModule;
const ROUTES = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [
      { path: "/app/groups/:groupId/timeline/new/:kind", module: newSheet },
      { path: "/app/groups/:groupId/timeline/:entryId/edit", module: editSheet },
    ],
  },
  { path: "/app/groups/:groupId/entries/:entryId", module: ENTRY },
];

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const RIA = fx.person({ name: "Ria Patel", role: "viewer" });
const PT = fx.event({ title: "Physical therapy", occurredAt: hoursAgo(48) });
const LAB = fx.event({ title: "Blood draw", occurredAt: hoursAgo(72) });
const base = () => [SAM, RIA, PT, LAB, fx.note({ text: "Ate breakfast", occurredAt: hoursAgo(3) })];

const open = (url: string, options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({ route: ROUTES, url, fixtures: base(), ...options });

// --- DOM helpers (live-notes.mjs's selectors) ---------------------------------
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const HEADER = () => $("main header");
const TITLE = () => $<HTMLInputElement>("main header input");
const EDITOR = () => $(".ProseMirror");
const editorFocused = () => !!document.activeElement?.classList.contains("ProseMirror");
const TOOLBAR = () => $('[role=toolbar][aria-label="Formatting"]');
const TIME_CHIP = () => $<HTMLButtonElement>('main header button[aria-label="Change when it happened"]');
const HEADER_TIME = () => $<HTMLTimeElement>("main header time");
const DAY = () => $('[role=dialog] [data-type="day"]');
const seg = (type: string, n = 0) =>
  document.querySelectorAll<HTMLElement>(`[role=dialog] [data-type="${type}"]`)[n];
const PICK_DATE = () => $('[role=dialog] [aria-label="Pick a date"]');
const GRID = () => $("[role=grid]");
const CHIP_DIALOG = () => $('[role=dialog][aria-label="When it happened"]');
const MENU = () =>
  $<HTMLButtonElement>('main header [data-region="actions"] button[aria-label^="Actions for"]');
const SHARE = () => $<HTMLButtonElement>('main header [data-region="actions"] button[aria-label="Share"]');
const CHIPS = () => [
  ...document.querySelectorAll<HTMLButtonElement>('main header ul[aria-label="Suggested titles"] button'),
];
const AVATARS = () => [
  ...document.querySelectorAll<HTMLElement>('main [data-region="editors"] [data-person]'),
];
const PLACE = () => $<HTMLInputElement>('main [data-region="place"] input');
const PLACE_REGION = () => $('main [data-region="place"]');
const MAP = () => $<HTMLAnchorElement>('main [data-region="place"] a[data-action="map"]');
const button = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const dialogButton = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")].find(
    (b) => b.textContent?.trim() === text,
  );
const addButton = () => document.querySelector<HTMLElement>('button[aria-label="Add to Today"]');
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitUntil = async (test: () => boolean, ms = 8000, what = "condition") => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return;
    await pause(25);
  }
  throw new Error(`timed out waiting for ${what}`);
};
/** Pick `text` from today's + menu. */
const addFrom = async (text: string) => {
  await userEvent.click(addButton()!);
  await waitUntil(() => !!menuItem(text), 4000, `${text} in the + menu`);
  await userEvent.click(menuItem(text)!);
};
const idOf = (path: string) => path.split("/").at(-1)!;
const DAY_MS = 86_400_000;

type EntryRow = {
  kind: string;
  title: string | null;
  body: string | null;
  created_by: string;
  occurred_at: string;
  deleted_at: string | null;
  ends_at: string | null;
  all_day: number;
  place: string | null;
};
const stored = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<EntryRow>("SELECT * FROM timeline_entry WHERE id = ?", [id]))[0];
const counts = async (device: Awaited<ReturnType<typeof open>>) =>
  JSON.stringify(
    await device.query(
      "SELECT (SELECT count(*) FROM timeline_entry) AS e, (SELECT count(*) FROM note_document) AS d, (SELECT count(*) FROM ps_crud) AS q",
    ),
  );

/** Open the time chip, move the day by `steps` (negative is earlier), then Done. */
const shiftDay = async (steps: number) => {
  await userEvent.click(await found(TIME_CHIP));
  await waitUntil(() => !!DAY(), 4000, "the day segment");
  (await found(DAY)).focus();
  for (let i = 0; i < Math.abs(steps); i++) await userEvent.keyboard(steps < 0 ? "{ArrowDown}" : "{ArrowUp}");
  await userEvent.click(button("Done")!);
  await waitUntil(() => !DAY());
};

describe("a draft", () => {
  test("has the time chip and no Share or ⋯ yet; leaving without typing writes nothing", async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    const before = await counts(device);
    await addFrom("Note");
    await waitUntil(
      () => device.location().endsWith("/entries/new?kind=note") && editorFocused(),
      4000,
      "the draft",
    );
    expect(!!TIME_CHIP() && !SHARE() && !MENU()).toBe(true);
    await pause(500);
    await userEvent.click(device.screen.getByRole("link", { name: "Timeline" }));
    await expect.poll(() => device.location()).toBe(TIMELINE);
    await pause(500);
    expect(await counts(device)).toBe(before);
  });
});

describe("a note in one tap", () => {
  test("Note opens the draft with the cursor in it, now as its time; the first keystroke saves it and replaces the URL; a title saves", async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    await addFrom("Note");
    await waitUntil(() => editorFocused(), 4000, "the editor's focus");
    expect(Math.abs(new Date(HEADER_TIME()!.dateTime).getTime() - Date.now())).toBeLessThan(60_000);

    await userEvent.keyboard("first words");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await expect.poll(() => EDITOR()?.textContent).toContain("first words");
    expect(editorFocused()).toBe(true);

    (await found(TITLE)).focus();
    await userEvent.keyboard("Morning");
    (await found(TITLE)).blur();
    await expect.poll(async () => (await stored(device, id))?.title).toBe("Morning");
    const row = (await stored(device, id))!;
    expect([row.kind, row.body, row.created_by]).toEqual(["note", null, TEST_USER.id]);
    expect((await device.query("SELECT id FROM note_document WHERE id = ?", [id])).length).toBe(1);

    // Replaced, not pushed: Back skips the draft's URL.
    await userEvent.click(button("Go back")!);
    await expect.poll(() => device.location()).toBe(TIMELINE);
    // Its row shows the document as its body, with no "live notes" block.
    await waitUntil(() => document.body.textContent.includes("first words"));
    expect(/live notes/i.test(document.body.innerText)).toBe(false);
  });
});

describe("a note from a past day's +", () => {
  test("starts at 12:00 that day, and saves with that time", async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    // Physical therapy's day (two days back): its heading has its own +.
    const key = new Date(Date.now() - 48 * 3_600_000).toLocaleDateString("en-CA");
    const header = document.getElementById(`day-${key}`)!.closest("[data-day-header]")!;
    const plus = header.querySelector<HTMLElement>('button[aria-label^="Add to "]')!;
    expect(plus.getAttribute("aria-label")).toBe(`Add to ${header.querySelector("h3")!.textContent}`);
    await userEvent.click(plus);
    await waitUntil(() => !!menuItem("Note"), 4000, "Note in the day's + menu");
    await userEvent.click(menuItem("Note")!);
    await waitUntil(() => editorFocused(), 4000, "the editor's focus");
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    const noon = new Date(y, m - 1, d, 12).getTime();
    expect(new Date(HEADER_TIME()!.dateTime).getTime()).toBe(noon);

    await userEvent.keyboard("from that day");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const row = (await stored(device, idOf(device.location())))!;
    expect(Date.parse(row.occurred_at)).toBe(noon);
  });
});

describe("an event in one tap, and title chips", () => {
  test('Event: the title field on top, chips that save nothing; typing saves it as "Event" with "Add a title"; chips stay, writers get the toolbar', async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    const before = await counts(device);
    await addFrom("Event");
    await waitUntil(() => device.location().endsWith("?kind=event") && editorFocused(), 4000, "the draft");
    expect(TITLE()!.placeholder).toBe("Title");
    await waitUntil(() => CHIPS().length > 0, 4000, "the chips");
    expect(CHIPS().map((b) => b.textContent?.trim())).toContain("Physical therapy");
    await pause(300);
    expect(await counts(device)).toBe(before);

    await userEvent.keyboard("event start");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await waitUntil(() => TITLE()?.placeholder === "Add a title" && TITLE()!.value === "");
    await expect
      .poll(async () => [(await stored(device, id))?.title, (await stored(device, id))?.body])
      .toEqual(["Event", null]);
    expect(CHIPS().length).toBeGreaterThan(0);
    expect(TOOLBAR()).toBeTruthy();

    // A chip renames the unnamed event; then a typed rename.
    const pick = CHIPS()[0]!.textContent.trim();
    await userEvent.click(await found(() => CHIPS()[0]));
    await waitUntil(() => TITLE()?.value === pick && CHIPS().length === 0, 4000, "the chip's title");
    await expect.poll(async () => (await stored(device, id))?.title).toBe(pick);
    (await found(TITLE)).focus();
    await userEvent.clear(await found(TITLE));
    await userEvent.keyboard("Dr. Lee visit");
    (await found(TITLE)).blur();
    await expect.poll(async () => (await stored(device, id))?.title).toBe("Dr. Lee visit");
    await waitUntil(() => TITLE()?.placeholder === "Title", 10_000, "the named event's placeholder");
  });

  test("a named event in 2 taps: Event, then a chip; saved with that title, the cursor in the document", async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    await addFrom("Event");
    await waitUntil(
      () => CHIPS().some((b) => b.textContent?.trim() === "Physical therapy"),
      4000,
      "the chips",
    );
    await userEvent.click(
      await found(() => CHIPS()?.find((b) => b.textContent?.trim() === "Physical therapy")),
    );
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await waitUntil(() => TITLE()?.value === "Physical therapy" && CHIPS().length === 0);
    await expect.poll(async () => (await stored(device, id))?.title).toBe("Physical therapy");
    expect(editorFocused()).toBe(true);
  });

  test("typing a title hides the chips, clearing it brings them back, and a typed title saves the event", async () => {
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=event`);
    await waitUntil(() => CHIPS().length > 0, 4000, "the chips");
    (await found(TITLE)).focus();
    await userEvent.keyboard("Podiatrist");
    await waitUntil(() => CHIPS().length === 0, 3000, "the chips to go");
    await userEvent.clear(await found(TITLE));
    await waitUntil(() => CHIPS().length > 0, 3000, "the chips to come back");
    await userEvent.keyboard("Podiatrist");
    (await found(TITLE)).blur();
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    await waitUntil(() => TITLE()?.value === "Podiatrist");
    expect(CHIPS().length).toBe(0);
  });
});

describe("who's writing", () => {
  test("idle: no avatars; others writing (synced from their devices): initials and a label, most recent first, never yourself", async () => {
    const event = fx.event({ title: "PT visit", occurredAt: hoursAgo(2), text: "Stretches" });
    const device = await open(entryPath(event.id), { fixtures: [base(), event] });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Stretches"));
    expect(AVATARS().length).toBe(0);

    const editors = (e: Record<string, string>) =>
      fx.document({ ownerId: event.id, text: "Stretches", editors: JSON.stringify(e) });
    await device.sync(editors({ [SAM.id]: at() }));
    await device.settle();
    expect(AVATARS().length).toBe(1);
    expect(AVATARS()[0]!.textContent).toBe("SO");
    expect($('main [data-region="editors"] [role="group"]')!.getAttribute("aria-label")).toMatch(
      /is editing$/,
    );

    // The signed-in user writing too: still only Sam.
    await device.sync(editors({ [SAM.id]: at(), [TEST_USER.id]: at() }));
    await device.settle();
    expect(AVATARS().map((el) => el.dataset.person)).toEqual([SAM.id]);
  });

  test("a viewer sees every writer, most recent first, and is read-only: plain time, no title field, chips, toolbar, time chip, or ⋯ but Print; Share", async () => {
    const event = fx.event({ title: "Event", occurredAt: hoursAgo(2), text: "Notes" });
    const editors = { [SAM.id]: at(), [TEST_USER.id]: at(new Date(Date.now() - 20_000)) };
    await open(entryPath(event.id), {
      role: "viewer",
      fixtures: [
        base(),
        event,
        fx.document({ ownerId: event.id, text: "Notes", editors: JSON.stringify(editors) }),
      ],
    });
    await waitUntil(() => AVATARS().length === 1, 4000, "avatars");
    // The viewer is the signed-in user here, so only Sam shows.
    expect(AVATARS().map((el) => el.dataset.person)).toEqual([SAM.id]);
    await expect.poll(() => HEADER()?.textContent).toContain("Event");
    expect(EDITOR()!.getAttribute("contenteditable")).toBe("false");
    expect([!!TITLE(), !!$('[aria-label="Suggested titles"]'), !!TOOLBAR(), !!TIME_CHIP()]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(!!HEADER_TIME() && !!SHARE()).toBe(true);
    // The viewer's ⋯ is Print alone.
    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Print"), 4000, "the menu");
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).toEqual([
      "Print",
    ]);
    await userEvent.keyboard("{Escape}");
  });

  test("two others: the most recent first", async () => {
    const event = fx.event({ title: "Visit", occurredAt: hoursAgo(2), text: "x" });
    const editors = { [RIA.id]: at(new Date(Date.now() - 30_000)), [SAM.id]: at() };
    await open(entryPath(event.id), {
      fixtures: [
        base(),
        event,
        fx.document({ ownerId: event.id, text: "x", editors: JSON.stringify(editors) }),
      ],
    });
    await waitUntil(() => AVATARS().length === 2, 4000, "avatars");
    expect(AVATARS().map((el) => el.dataset.person)).toEqual([SAM.id, RIA.id]);
  });
});

describe("the header: time and Delete", () => {
  test("a time picked on a draft shows and saves nothing alone; typing saves it as the entry's time", async () => {
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=note`);
    await waitUntil(() => !!TIME_CHIP());
    const start = new Date(HEADER_TIME()!.dateTime).getTime();
    await shiftDay(-2);
    const picked = new Date(HEADER_TIME()!.dateTime).getTime();
    expect(picked).toBe(start - 2 * DAY_MS);
    expect(device.location()).toMatch(/\/entries\/new/);
    expect((await device.queued()).length).toBe(0);

    (await found(EDITOR)).focus();
    await userEvent.keyboard("written later");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await expect.poll(async () => Date.parse((await stored(device, id))!.occurred_at)).toBe(picked);
  });

  test("the calendar: Escape closes it, not the chip; picking a day closes it and saves nothing until Done", async () => {
    const note = fx.note({ text: "Long day", occurredAt: hoursAgo(50) });
    const device = await open(entryPath(note.id), { fixtures: [base(), note] });
    await waitUntil(() => !!TIME_CHIP());
    const was = Date.parse(note.row.occurred_at as string);
    const moved = was + DAY_MS;
    const target = new Date(moved);
    const heading = target.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    await userEvent.click(await found(TIME_CHIP));
    await waitUntil(() => !!PICK_DATE());
    await userEvent.click(await found(PICK_DATE));
    await waitUntil(() => !!GRID(), 4000, "the calendar");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !GRID(), 3000, "the calendar to close");
    expect(DAY()).toBeTruthy();

    await userEvent.click(await found(PICK_DATE));
    await waitUntil(() => !!GRID());
    const calHeading = () => GRID()!.closest("[role=dialog]")!.querySelector("h2")!.textContent.trim();
    if (calHeading() !== heading)
      await userEvent.click(
        await found(() => GRID()?.closest("[role=dialog]")?.querySelector('[aria-label="Next month"]')),
      );
    await waitUntil(() => calHeading() === heading);
    const cell = [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
      (c) => c.textContent?.trim() === String(target.getDate()) && !c.hasAttribute("data-outside-month"),
    )!;
    await userEvent.click(cell);
    await waitUntil(() => !GRID(), 3000, "the calendar to close");
    await pause(300);
    expect(DAY()).toBeTruthy();
    expect(Date.parse((await stored(device, note.id))!.occurred_at)).toBe(was);
    await userEvent.click(button("Done")!);
    await waitUntil(() => !DAY());
    await expect.poll(async () => Date.parse((await stored(device, note.id))!.occurred_at)).toBe(moved);
  });

  test("a note's time can't go past now: the day can't be picked, a typed later day shows the message and Done stays open", async () => {
    const note = fx.note({ text: "An hour ago", occurredAt: hoursAgo(1) });
    const device = await open(entryPath(note.id), { fixtures: [base(), note] });
    await waitUntil(() => !!TIME_CHIP());
    const was = Date.parse(note.row.occurred_at as string);
    await userEvent.click(await found(TIME_CHIP));
    await waitUntil(() => !!PICK_DATE());

    // The calendar leaves every later day disabled.
    await userEvent.click(await found(PICK_DATE));
    await waitUntil(() => !!GRID(), 4000, "the calendar");
    const tomorrow = new Date(Date.now() + DAY_MS);
    const cell = [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
      (c) => c.textContent?.trim() === String(tomorrow.getDate()) && !c.hasAttribute("data-outside-month"),
    );
    if (cell)
      expect(cell.hasAttribute("data-disabled") || cell.getAttribute("aria-disabled") === "true").toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !GRID(), 3000, "the calendar to close");

    // Typing a later day marks it and keeps the chip open.
    seg("day")!.focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    await waitUntil(
      () => !!CHIP_DIALOG()?.textContent.includes("Can't be in the future"),
      4000,
      "the message",
    );
    await userEvent.click(button("Done")!);
    await pause(300);
    expect(CHIP_DIALOG()).toBeTruthy();
    expect(Date.parse((await stored(device, note.id))!.occurred_at)).toBe(was);
  });

  test("Delete asks first; Cancel keeps it; Delete goes back to the timeline, soft-deleted, without its row", async () => {
    const note = fx.note({ text: "To delete", occurredAt: hoursAgo(1) });
    const device = await open(entryPath(note.id), { fixtures: [base(), note] });
    await waitUntil(() => !!MENU());
    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Delete"));
    await userEvent.click(menuItem("Delete")!);
    await waitUntil(() => !!$("dialog[open]"));
    expect($("dialog[open]")!.textContent).toContain("Delete this note?");
    await userEvent.click(dialogButton("Cancel")!);
    await waitUntil(() => !$("dialog[open]"));
    expect(device.location()).toBe(entryPath(note.id));
    expect(MENU()).toBeTruthy();

    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Delete"));
    await userEvent.click(menuItem("Delete")!);
    await waitUntil(() => !!$("dialog[open]"));
    await userEvent.click(dialogButton("Delete")!);
    await expect.poll(() => device.location()).toBe(TIMELINE);
    expect((await stored(device, note.id))!.deleted_at).not.toBeNull();
    await waitUntil(() => !!document.querySelector("ol > li"));
    expect(document.body.textContent).not.toContain("To delete");
  });

  test("deleted on another device while open: the page says so", async () => {
    const note = fx.note({ text: "Gone soon", occurredAt: hoursAgo(1) });
    const device = await open(entryPath(note.id), { role: "viewer", fixtures: [base(), note] });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Gone soon"));
    await device.sync({ ...note, with: [], row: { ...note.row, deleted_at: at() } });
    await expect.element(device.screen.getByText("This entry was deleted.")).toBeVisible();
  });
});

describe("Share", () => {
  const own = ["share", "canShare", "clipboard"] as const;
  afterEach(() => {
    for (const key of own) delete (navigator as unknown as Record<string, unknown>)[key];
  });
  const stub = (key: (typeof own)[number], value: unknown) =>
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });

  test("without a share sheet, it copies the entry's web URL, says so, and the note goes away", async () => {
    const note = fx.note({ title: "Morning", text: "Shared words", occurredAt: hoursAgo(1) });
    const copied: string[] = [];
    stub("share", undefined);
    stub("canShare", undefined);
    stub("clipboard", { writeText: (t: string) => (copied.push(t), Promise.resolve()) });
    const device = await open(entryPath(note.id), { fixtures: [base(), note] });
    await waitUntil(() => !!SHARE());
    await userEvent.click(await found(SHARE));
    await expect.element(device.screen.getByText("Link copied")).toBeVisible();
    expect(copied).toEqual([location.origin + entryPath(note.id)]);
    await expect.element(device.screen.getByText("Link copied"), { timeout: 5000 }).not.toBeInTheDocument();
  });

  test("a viewer's share sheet gets the title and web URL, and no 'Link copied'", async () => {
    const note = fx.note({ title: "Morning", text: "Shared words", occurredAt: hoursAgo(1) });
    const shared: unknown[] = [];
    stub("share", (d: unknown) => (shared.push(d), Promise.resolve()));
    stub("canShare", () => true);
    await open(entryPath(note.id), { role: "viewer", fixtures: [base(), note] });
    await waitUntil(() => !!SHARE() && document.body.textContent.includes("You can view this"));
    await userEvent.click(await found(SHARE));
    await expect
      .poll(() => shared)
      .toEqual([{ title: "Morning", url: location.origin + entryPath(note.id) }]);
    expect(document.body.textContent).not.toContain("Link copied");
  });
});

describe("404s and the sheet", () => {
  test("a symptom's id isn't an entry page", async () => {
    const symptom = fx.symptom();
    const device = await open(entryPath(symptom.id), { fixtures: [base(), symptom] });
    await expect.element(device.screen.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("a non-member sees Not found, with no title, text or Share", async () => {
    const note = fx.note({ title: "Private title", text: "Private words" });
    const device = await open(entryPath(note.id), { role: null, fixtures: [base(), note] });
    await expect.element(device.screen.getByRole("heading", { name: "Not found" })).toBeVisible();
    expect(document.body.textContent).not.toContain("Private");
    expect(SHARE()).toBeNull();
  });

  test("someone outside the group (it was never on their device) sees Not found", async () => {
    const note = fx.note({ title: "Private title", text: "Private words" });
    const device = await open(entryPath(note.id), { bareDevice: true, fixtures: [] });
    await expect.element(device.screen.getByRole("heading", { name: "Not found" })).toBeVisible();
    expect(document.body.textContent).not.toContain("Private");
  });

  test("the add sheet offers only Symptom and Vitals (notes and events have their own page)", async () => {
    await open(TIMELINE);
    await waitUntil(() => !!addButton());
    await addFrom("Symptom");
    await waitUntil(() => !!$("[role=dialog] form"), 4000, "the sheet");
    const kinds = [...document.querySelectorAll("[role=dialog] fieldset .join > *")].map(
      (el) => el.getAttribute("aria-label") ?? el.textContent?.trim(),
    );
    expect(kinds).toEqual(["Symptom", "Vitals ▾"]);
  });
});

describe("appointments", () => {
  const ahead = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(9, 0, 0, 0);
    return d;
  };
  const pickAheadDay = async () => {
    const d = ahead();
    const heading = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await waitUntil(() => !!CHIP_DIALOG() && !!GRID(), 4000, "the calendar");
    const calHeading = () => GRID()!.closest("[role=dialog]")!.querySelector("h2")!.textContent.trim();
    if (calHeading() !== heading)
      await userEvent.click(
        await found(() => GRID()?.closest("[role=dialog]")?.querySelector('[aria-label="Next month"]')),
      );
    await waitUntil(() => calHeading() === heading);
    const cell = [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
      (c) => c.textContent?.trim() === String(d.getDate()) && !c.hasAttribute("data-outside-month"),
    )!;
    await userEvent.click(cell);
    await waitUntil(() => !GRID() && !!seg("hour"), 3000, "the time segments");
  };

  test("?when=pick opens the calendar on arrival; a picked day starts at 9:00; leaving saves nothing; a title saves it at 9:00", async () => {
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=event&when=pick`);
    await pickAheadDay();
    expect(`${seg("hour")!.textContent}:${seg("minute")!.textContent}`).toBe("9:00");
    await userEvent.click(button("Done")!);
    await waitUntil(() => !CHIP_DIALOG());
    expect(new Date(HEADER_TIME()!.dateTime).getTime()).toBe(ahead().getTime());
    expect(device.location()).toMatch(/\/entries\/new/);
    expect((await device.queued()).length).toBe(0);

    (await found(TITLE)).focus();
    await userEvent.keyboard("Eye appointment");
    (await found(TITLE)).blur();
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    await expect
      .poll(async () => Date.parse((await stored(device, idOf(device.location())))!.occurred_at))
      .toBe(ahead().getTime());
  });

  test("end time: an hour after the start by default; before the start is an error Done refuses; saved as a range", async () => {
    const appt = fx.event({ title: "Cardiology", occurredAt: at(ahead()), text: "" });
    const device = await open(entryPath(appt.id), { fixtures: [base(), appt] });
    await waitUntil(() => !!TIME_CHIP());
    await userEvent.click(await found(TIME_CHIP));
    await waitUntil(() => !!button("Add an end time"));
    await userEvent.click(button("Add an end time")!);
    await waitUntil(() => !!seg("hour", 1));
    expect(seg("hour", 1)!.textContent).toBe("10");
    seg("hour", 1)!.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await waitUntil(
      () => !!CHIP_DIALOG()?.textContent?.includes("Must be after the start"),
      3000,
      "the field error",
    );
    await userEvent.click(button("Done")!);
    await pause(200);
    expect(CHIP_DIALOG()).toBeTruthy();
    seg("hour", 1)!.focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    await waitUntil(() => !CHIP_DIALOG()!.textContent.includes("Must be after the start"));
    await userEvent.click(button("Done")!);
    await waitUntil(() => !CHIP_DIALOG());
    await expect
      .poll(async () => Date.parse((await stored(device, appt.id))!.ends_at ?? ""))
      .toBe(ahead().getTime() + 2 * 3_600_000);
    // The header re-renders from the live query after the write lands.
    await waitUntil(() => /–/.test(HEADER_TIME()?.textContent ?? ""), 10_000, "the range in the header");
  });

  test("place: empty with no provider; a linked provider's address greyed, 'from …', with a map; a viewer sees it with no field; a typed place replaces it", async () => {
    const appt = fx.event({ title: "Cardiology", occurredAt: at(ahead()), text: "" });
    const clinic = fx.provider({ name: "Harbor Heart Clinic", address: "12 Example Way, Springfield" });
    const device = await open(entryPath(appt.id), { fixtures: [base(), appt, clinic] });
    await waitUntil(() => !!PLACE());
    expect(PLACE()!.placeholder).toBe("Add a place");
    expect(MAP()).toBeNull();

    await device.sync(fx.link(appt.id, clinic.id));
    await device.settle();
    expect(PLACE()?.placeholder).toBe("12 Example Way, Springfield");
    expect(PLACE()!.value).toBe("");
    expect(PLACE_REGION()!.textContent).toContain("from Harbor Heart Clinic");
    expect(MAP()!.href).toContain(encodeURIComponent("12 Example Way, Springfield"));

    (await found(PLACE)).focus();
    await userEvent.keyboard("Lab, 2nd floor{Enter}");
    await expect.poll(async () => (await stored(device, appt.id))?.place).toBe("Lab, 2nd floor");
    await waitUntil(
      () => !!MAP()?.href.includes(encodeURIComponent("Lab, 2nd floor")),
      10_000,
      "the typed place on the map link",
    );
    expect(PLACE_REGION()!.textContent).not.toContain("from ");
    await device.screen.unmount();

    await open(entryPath(appt.id), {
      role: "viewer",
      fixtures: [base(), appt, clinic, fx.link(appt.id, clinic.id)],
    });
    await waitUntil(
      () => !!PLACE_REGION()?.textContent?.includes("12 Example Way"),
      4000,
      "the viewer's place",
    );
    expect(PLACE()).toBeNull();
    expect(MAP()).toBeTruthy();
  });

  test("a viewer sees no place row when there's none", async () => {
    const appt = fx.event({ title: "Cardiology", occurredAt: at(ahead()), text: "" });
    await open(entryPath(appt.id), { role: "viewer", fixtures: [base(), appt] });
    await waitUntil(() => !!HEADER_TIME());
    expect(PLACE_REGION()?.textContent ?? "").toBe("");
  });

  test("all day: the day alone with no end; saved, and the header says All day; a viewer gets no chip or field", async () => {
    const appt = fx.event({ title: "Move day", occurredAt: at(ahead()), text: "" });
    const device = await open(entryPath(appt.id), { fixtures: [base(), appt] });
    await waitUntil(() => !!TIME_CHIP());
    await userEvent.click(await found(TIME_CHIP));
    await waitUntil(() => !!CHIP_DIALOG()?.querySelector("input[type=checkbox]"));
    await userEvent.click(await found(() => CHIP_DIALOG()?.querySelector("input[type=checkbox]")));
    await waitUntil(() => !seg("hour") && !button("Add an end time"));
    await userEvent.click(button("Done")!);
    await waitUntil(() => !CHIP_DIALOG());
    await expect.poll(async () => (await stored(device, appt.id))?.all_day).toBe(1);
    expect((await stored(device, appt.id))!.ends_at).toBeNull();
    await waitUntil(() => /All day/.test(HEADER_TIME()?.textContent ?? ""), 10_000, "All day in the header");
    await device.screen.unmount();

    await open(entryPath(appt.id), {
      role: "viewer",
      fixtures: [base(), { ...appt, row: { ...appt.row, all_day: 1 } }],
    });
    await waitUntil(() => /All day/.test(HEADER_TIME()?.textContent ?? ""));
    expect([!!TIME_CHIP(), !!PLACE()]).toEqual([false, false]);
  });
});
