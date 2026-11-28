import type { RouteModule } from "../../../../../test/device";
import type { Route } from "./+types/route";

import { useNavigate } from "react-router";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { TEST_NOW, found, waitUntil } from "../../../../../test/found";
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
const HEADER = () => document.querySelector<HTMLElement>("main header");
const TITLE = () => document.querySelector<HTMLInputElement>("main header input");
const EDITOR = () => document.querySelector<HTMLElement>(".ProseMirror");
const editorFocused = () => !!document.activeElement?.classList.contains("ProseMirror");
const TOOLBAR = () => document.querySelector<HTMLElement>('[role=toolbar][aria-label="Formatting"]');
const TIME_CHIP = () =>
  document.querySelector<HTMLButtonElement>('main header button[aria-label="Change when it happened"]');
const HEADER_TIME = () => document.querySelector<HTMLTimeElement>("main header time");
const DAY = () => document.querySelector<HTMLElement>('[role=dialog] [data-type="day"]');
const seg = (type: string, n = 0) =>
  document.querySelectorAll<HTMLElement>(`[role=dialog] [data-type="${type}"]`)[n];
const PICK_DATE = () => document.querySelector<HTMLElement>('[role=dialog] [aria-label="Pick a date"]');
const GRID = () => document.querySelector<HTMLElement>("[role=grid]");
const CHIP_DIALOG = () => document.querySelector<HTMLElement>('[role=dialog][aria-label="When it happened"]');
const MENU = () =>
  document.querySelector<HTMLButtonElement>(
    'main header [data-region="actions"] button[aria-label^="Actions for"]',
  );
const SHARE = () =>
  document.querySelector<HTMLButtonElement>('main header [data-region="actions"] button[aria-label="Share"]');
const CHIPS = () => [
  ...document.querySelectorAll<HTMLButtonElement>('main header ul[aria-label="Suggested titles"] button'),
];
const AVATARS = () => [
  ...document.querySelectorAll<HTMLElement>('main [data-region="editors"] [data-person]'),
];
const PLACE = () => document.querySelector<HTMLInputElement>('main [data-region="place"] input');
const PLACE_REGION = () => document.querySelector<HTMLElement>('main [data-region="place"]');
const MAP = () =>
  document.querySelector<HTMLAnchorElement>('main [data-region="place"] a[data-action="map"]');
const button = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const dialogButton = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")].find(
    (b) => b.textContent?.trim() === text,
  );
const addButton = () => document.querySelector<HTMLElement>('button[aria-label="Add to Today"]');
/** Pick `text` from today's + menu. */
const addFrom = async (text: string) => {
  await userEvent.click(await found(addButton));
  await waitUntil(() => !!menuItem(text), `${text} in the + menu`);
  await userEvent.click(await found(() => menuItem(text)));
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
  await waitUntil(() => !!DAY(), "the day segment");
  (await found(DAY)).focus();
  for (let i = 0; i < Math.abs(steps); i++) await userEvent.keyboard(steps < 0 ? "{ArrowDown}" : "{ArrowUp}");
  await userEvent.click(await found(() => button("Done")));
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
      "the draft",
    );
    expect(!!TIME_CHIP() && !SHARE() && !MENU()).toBe(true);
    await device.settle();
    await userEvent.click(device.screen.getByRole("link", { name: "Timeline" }));
    await expect.poll(() => device.location()).toBe(TIMELINE);
    await device.settle();
    expect(await counts(device)).toBe(before);
  });
});

describe("a note in one tap", () => {
  test("Note opens the draft with the cursor in it, now as its time; the first keystroke saves it and replaces the URL; a title saves", async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    await addFrom("Note");
    await waitUntil(() => editorFocused(), "the editor's focus");
    // Now on the test clock: no earlier than its start, no later than this line.
    const started = new Date(HEADER_TIME()?.dateTime ?? "").getTime();
    expect(started).toBeGreaterThanOrEqual(TEST_NOW);
    expect(started).toBeLessThanOrEqual(Date.now());

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
    await userEvent.click(await found(() => button("Go back")));
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
    // The heading's full label (its h3 also holds the phone form, B-999).
    expect(plus.getAttribute("aria-label")).toBe(
      `Add to ${header.querySelector("h3 [data-day-full]")!.textContent}`,
    );
    await userEvent.click(plus);
    await waitUntil(() => !!menuItem("Note"), "Note in the day's + menu");
    await userEvent.click(await found(() => menuItem("Note")));
    await waitUntil(() => editorFocused(), "the editor's focus");
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    const noon = new Date(y, m - 1, d, 12).getTime();
    expect(new Date(HEADER_TIME()?.dateTime ?? "").getTime()).toBe(noon);

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
    await waitUntil(() => device.location().endsWith("?kind=event") && editorFocused(), "the draft");
    await expect.poll(() => TITLE()?.placeholder).toBe("Enter a title to save");
    await waitUntil(() => CHIPS().length > 0, "the chips");
    expect(CHIPS().map((b) => b.textContent?.trim())).toContain("Physical therapy");
    await device.settle();
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
    await waitUntil(() => TITLE()?.value === pick && CHIPS().length === 0, "the chip's title");
    await expect.poll(async () => (await stored(device, id))?.title).toBe(pick);
    (await found(TITLE)).focus();
    await userEvent.clear(await found(TITLE));
    await userEvent.keyboard("Dr. Lee visit");
    (await found(TITLE)).blur();
    await expect.poll(async () => (await stored(device, id))?.title).toBe("Dr. Lee visit");
    await waitUntil(() => TITLE()?.placeholder === "Title", "the named event's placeholder");
  });

  test("a named event in 2 taps: Event, then a chip; saved with that title, the cursor in the document", async () => {
    const device = await open(TIMELINE);
    await waitUntil(() => !!addButton());
    await addFrom("Event");
    await waitUntil(() => CHIPS().some((b) => b.textContent?.trim() === "Physical therapy"), "the chips");
    await userEvent.click(
      await found(() => CHIPS()?.find((b) => b.textContent?.trim() === "Physical therapy")),
    );
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await waitUntil(() => TITLE()?.value === "Physical therapy" && CHIPS().length === 0);
    await expect.poll(async () => (await stored(device, id))?.title).toBe("Physical therapy");
    expect(editorFocused()).toBe(true);
  });

  test("a new event's title is required (aria-required: its label is hidden, so no *) until it's saved", async () => {
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=event`);
    await waitUntil(() => TITLE()?.getAttribute("aria-required") === "true", "the required title");
    expect(document.querySelector("main [data-required-mark]")).toBeNull();
    (await found(TITLE)).focus();
    await userEvent.keyboard("Podiatrist");
    (await found(TITLE)).blur();
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    await waitUntil(() => TITLE()?.value === "Podiatrist" && !TITLE()?.hasAttribute("aria-required"));
  });

  test("a new note marks nothing required: its title is optional", async () => {
    await open(`/app/groups/${GROUP}/entries/new?kind=note`);
    await waitUntil(() => TITLE()?.placeholder === "Title", "the note's title");
    expect(TITLE()?.hasAttribute("aria-required")).toBe(false);
    expect(document.querySelector("main [data-required-mark]")).toBeNull();
  });

  test("typing a title hides the chips, clearing it brings them back, and a typed title saves the event", async () => {
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=event`);
    await waitUntil(() => CHIPS().length > 0, "the chips");
    (await found(TITLE)).focus();
    await userEvent.keyboard("Podiatrist");
    await waitUntil(() => CHIPS().length === 0, "the chips to go");
    await userEvent.clear(await found(TITLE));
    await waitUntil(() => CHIPS().length > 0, "the chips to come back");
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
    expect(AVATARS()[0]?.textContent).toBe("SO");
    expect(
      document
        .querySelector<HTMLElement>('main [data-region="editors"] [role="group"]')
        ?.getAttribute("aria-label"),
    ).toMatch(/is editing$/);

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
    await waitUntil(() => AVATARS().length === 1, "avatars");
    // The viewer is the signed-in user here, so only Sam shows.
    expect(AVATARS().map((el) => el.dataset.person)).toEqual([SAM.id]);
    await expect.poll(() => HEADER()?.textContent).toContain("Past event");
    await expect.poll(() => EDITOR()?.getAttribute("contenteditable")).toBe("false");
    expect([
      !!TITLE(),
      !!document.querySelector<HTMLElement>('[aria-label="Suggested titles"]'),
      !!TOOLBAR(),
      !!TIME_CHIP(),
    ]).toEqual([false, false, false, false]);
    expect(!!HEADER_TIME() && !!SHARE()).toBe(true);
    // The viewer's ⋯ is Print alone.
    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Print"), "the menu");
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
    await waitUntil(() => AVATARS().length === 2, "avatars");
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
    await waitUntil(() => !!GRID(), "the calendar");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !GRID(), "the calendar to close");
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
    await waitUntil(() => !GRID(), "the calendar to close");
    await device.settle();
    expect(DAY()).toBeTruthy();
    expect(Date.parse((await stored(device, note.id))?.occurred_at ?? "")).toBe(was);
    await userEvent.click(await found(() => button("Done")));
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
    await waitUntil(() => !!GRID(), "the calendar");
    const tomorrow = new Date(Date.now() + DAY_MS);
    const cell = [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
      (c) => c.textContent?.trim() === String(tomorrow.getDate()) && !c.hasAttribute("data-outside-month"),
    );
    if (cell)
      expect(cell.hasAttribute("data-disabled") || cell.getAttribute("aria-disabled") === "true").toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !GRID(), "the calendar to close");

    // Typing a later day marks it and keeps the chip open.
    seg("day")!.focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    await waitUntil(() => !!CHIP_DIALOG()?.textContent.includes("Can't be in the future"), "the message");
    await userEvent.click(await found(() => button("Done")));
    await device.settle();
    expect(CHIP_DIALOG()).toBeTruthy();
    expect(Date.parse((await stored(device, note.id))?.occurred_at ?? "")).toBe(was);
  });

  test("Delete asks first; Cancel keeps it; Delete goes back to the timeline, soft-deleted, without its row", async () => {
    const note = fx.note({ text: "To delete", occurredAt: hoursAgo(1) });
    const device = await open(entryPath(note.id), { fixtures: [base(), note] });
    await waitUntil(() => !!MENU());
    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Delete"));
    await userEvent.click(await found(() => menuItem("Delete")));
    await waitUntil(() => !!document.querySelector<HTMLElement>("dialog[open]"));
    expect(document.querySelector<HTMLElement>("dialog[open]")?.textContent).toContain("Delete this note?");
    await userEvent.click(await found(() => dialogButton("Cancel")));
    await waitUntil(() => !document.querySelector<HTMLElement>("dialog[open]"));
    expect(device.location()).toBe(entryPath(note.id));
    expect(MENU()).toBeTruthy();

    await userEvent.click(await found(MENU));
    await waitUntil(() => !!menuItem("Delete"));
    await userEvent.click(await found(() => menuItem("Delete")));
    await waitUntil(() => !!document.querySelector<HTMLElement>("dialog[open]"));
    await userEvent.click(await found(() => dialogButton("Delete")));
    await expect.poll(() => device.location()).toBe(TIMELINE);
    expect((await stored(device, note.id))?.deleted_at).not.toBeNull();
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
    await expect.element(device.screen.getByText("Link copied")).not.toBeInTheDocument();
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
    await waitUntil(() => !!document.querySelector<HTMLElement>("[role=dialog] form"), "the sheet");
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
  /** In the open calendar, pick the day `days` from today (the calendar's own close is the caller's to wait on). */
  const pickAheadDay = async (days = 3) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const heading = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await waitUntil(() => !!CHIP_DIALOG() && !!GRID(), "the calendar");
    const calHeading = () => GRID()!.closest("[role=dialog]")!.querySelector("h2")!.textContent.trim();
    if (calHeading() !== heading)
      await userEvent.click(
        await found(() => GRID()?.closest("[role=dialog]")?.querySelector('[aria-label="Next month"]')),
      );
    await waitUntil(() => calHeading() === heading);
    const cell = await found(() =>
      [...document.querySelectorAll("[role=grid] [role=gridcell] > *")].find(
        (c) => c.textContent?.trim() === String(d.getDate()) && !c.hasAttribute("data-outside-month"),
      ),
    );
    await userEvent.click(cell);
  };

  // B-692: on Add event, the first day picked closes the picker and asks for the title.
  test('?when=pick opens the calendar on arrival; the first day picked starts at the current hour, closes the popover and focuses the title ("Enter a title to save"); leaving saves nothing; a title saves it then', async () => {
    const hour = new Date().getHours();
    const start = ahead();
    start.setHours(hour, 0, 0, 0);
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=event&when=pick`);
    await pickAheadDay();
    await waitUntil(() => !CHIP_DIALOG(), "the popover to close");
    await waitUntil(() => !!TITLE() && document.activeElement === TITLE(), "focus on the title");
    const title = TITLE()!;
    expect(title.placeholder).toBe("Enter a title to save");
    expect(title.labels?.[0]?.textContent).toBe("Title");
    expect(new Date(HEADER_TIME()?.dateTime ?? "").getTime()).toBe(start.getTime());
    // Focus stays on the title once the popover has gone.
    await device.settle();
    expect(document.activeElement).toBe(title);
    expect(device.location()).toMatch(/\/entries\/new/);
    expect((await device.queued()).length).toBe(0);

    await userEvent.keyboard("Eye appointment");
    (await found(TITLE)).blur();
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    await expect
      .poll(async () => Date.parse((await stored(device, idOf(device.location())))!.occurred_at))
      .toBe(start.getTime());
  });

  test("after the first pick, reopening the time chip and picking another day keeps the popover open, focus in it; a saved event's placeholder is unchanged", async () => {
    const hour = new Date().getHours();
    const later = ahead();
    later.setDate(later.getDate() + 2);
    later.setHours(hour, 0, 0, 0);
    const device = await open(`/app/groups/${GROUP}/entries/new?kind=event&when=pick`);
    await pickAheadDay();
    await waitUntil(() => !CHIP_DIALOG() && document.activeElement === TITLE(), "focus on the title");

    await userEvent.click(await found(TIME_CHIP));
    await userEvent.click(await found(PICK_DATE));
    await pickAheadDay(5);
    await waitUntil(() => !GRID() && !!seg("hour"), "the calendar to close");
    await device.settle();
    expect(CHIP_DIALOG()?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(PICK_DATE());
    // The time picked first stays (the current hour applies to the first pick only).
    expect(`${seg("hour")?.textContent}:${seg("minute")?.textContent}`).toBe(`${hour % 12 || 12}:00`);
    await userEvent.click(await found(() => button("Done")));
    await waitUntil(() => !CHIP_DIALOG());
    expect(new Date(HEADER_TIME()?.dateTime ?? "").getTime()).toBe(later.getTime());
    expect(TITLE()?.placeholder).toBe("Enter a title to save");
    await device.screen.unmount();

    // Saved events keep theirs: an unnamed one "Add a title", a named one "Title".
    const unnamed = fx.event({ title: "Event", occurredAt: at(ahead()), text: "" });
    const named = fx.event({ title: "Dentist", occurredAt: at(ahead()), text: "" });
    const saved = await open(entryPath(unnamed.id), { fixtures: [base(), unnamed, named] });
    await expect.poll(() => TITLE()?.placeholder).toBe("Add a title");
    await saved.screen.unmount();
    await open(entryPath(named.id), { fixtures: [base(), unnamed, named] });
    await expect.poll(() => TITLE()?.value).toBe("Dentist");
    expect(TITLE()?.placeholder).toBe("Title");
  });

  test("an event's minutes step by 15 from a saved 9:10, which stays until stepped", async () => {
    const start = ahead();
    start.setMinutes(10);
    const appt = fx.event({ title: "Podiatry", occurredAt: at(start), text: "" });
    const device = await open(entryPath(appt.id), { fixtures: [base(), appt] });
    await waitUntil(() => !!TIME_CHIP());
    await userEvent.click(await found(TIME_CHIP));
    await waitUntil(() => seg("minute")?.textContent === "10", "the saved minute");
    (await found(() => seg("minute"))).focus();
    await userEvent.keyboard("{ArrowUp}");
    await waitUntil(() => seg("minute")?.textContent === "15", "the next quarter");
    await userEvent.keyboard("{ArrowDown}");
    await waitUntil(() => seg("minute")?.textContent === "00", "the quarter before");
    expect(device.location()).toContain(appt.id);
  });

  test("end time: an hour after the start by default; before the start is an error Done refuses; saved as a range", async () => {
    const appt = fx.event({ title: "Cardiology", occurredAt: at(ahead()), text: "" });
    const device = await open(entryPath(appt.id), { fixtures: [base(), appt] });
    await waitUntil(() => !!TIME_CHIP());
    await userEvent.click(await found(TIME_CHIP));
    await waitUntil(() => !!button("Add an end time"));
    await userEvent.click(await found(() => button("Add an end time")));
    await waitUntil(() => !!seg("hour", 1));
    expect(seg("hour", 1)?.textContent).toBe("10");
    seg("hour", 1)!.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await waitUntil(
      () => !!CHIP_DIALOG()?.textContent?.includes("Must be after the start"),
      "the field error",
    );
    await userEvent.click(await found(() => button("Done")));
    await device.settle();
    expect(CHIP_DIALOG()).toBeTruthy();
    seg("hour", 1)!.focus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    await waitUntil(() => !CHIP_DIALOG()!.textContent.includes("Must be after the start"));
    await userEvent.click(await found(() => button("Done")));
    await waitUntil(() => !CHIP_DIALOG());
    await expect
      .poll(async () => Date.parse((await stored(device, appt.id))!.ends_at ?? ""))
      .toBe(ahead().getTime() + 2 * 3_600_000);
    // The header re-renders from the live query after the write lands.
    await waitUntil(() => /–/.test(HEADER_TIME()?.textContent ?? ""), "the range in the header");
  });

  // B-691: the chip's panel is already a popover, so its calendars open inline in it.
  const box = (el: Element) => el.getBoundingClientRect();
  const grids = () => [...document.querySelectorAll<HTMLElement>("[role=grid]")];
  const picks = () => [...document.querySelectorAll<HTMLElement>('[role=dialog] [aria-label="Pick a date"]')];
  const settled = () => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));

  test.each([360, 420])(
    "at %i the chip's calendar opens inline: inside the panel's bounds, no second popover; a second tap closes it",
    async (width) => {
      const appt = fx.event({ title: "Dentist", occurredAt: at(ahead()), text: "" });
      await open(entryPath(appt.id), { fixtures: [base(), appt], width });
      await userEvent.click(await found(TIME_CHIP));
      await userEvent.click(await found(PICK_DATE));
      await waitUntil(() => !!GRID(), "the calendar");
      await settled();
      expect(document.querySelectorAll("[role=dialog]")).toHaveLength(1);
      const panel = CHIP_DIALOG()!;
      expect(panel.contains(GRID())).toBe(true);
      const [p, g] = [box(panel), box(GRID()!)];
      expect(g.left).toBeGreaterThanOrEqual(p.left);
      expect(g.right).toBeLessThanOrEqual(p.right);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth);
      // Day cells as square as the panel allows, never past 44 px.
      const cell = box(GRID()!.querySelector("[role=gridcell] > *")!);
      expect(cell.width).toBeGreaterThan(30);
      expect(cell.width).toBeLessThanOrEqual(44.5);
      expect(Math.abs(cell.height - cell.width)).toBeLessThan(1);

      await userEvent.click(await found(PICK_DATE));
      await waitUntil(() => !GRID(), "the calendar to close");
      expect(CHIP_DIALOG()).toBeTruthy();
    },
  );

  test("Escape closes the calendar first, then the panel; opening Ends' calendar closes Starts'", async () => {
    const appt = fx.event({ title: "Cardiology", occurredAt: at(ahead()), text: "" });
    await open(entryPath(appt.id), { fixtures: [base(), appt] });
    await userEvent.click(await found(TIME_CHIP));
    await userEvent.click(await found(() => button("Add an end time")));
    await waitUntil(() => picks().length === 2, "Starts and Ends");

    const [startsPick, endsPick] = [await found(() => picks()[0]), await found(() => picks()[1])];
    await userEvent.click(startsPick);
    await waitUntil(() => grids().length === 1, "Starts' calendar");
    const starts = await found(GRID);
    expect(startsPick.closest(".fieldset")?.contains(starts)).toBe(true);
    await userEvent.click(endsPick);
    await waitUntil(() => grids().length === 1 && GRID() !== starts, "Ends' calendar alone");
    expect(endsPick.closest(".fieldset")?.contains(GRID())).toBe(true);

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => grids().length === 0, "the calendar to close");
    expect(CHIP_DIALOG()).toBeTruthy();
    // Focus is back on Ends' button, still in the panel.
    expect(document.activeElement).toBe(endsPick);
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !CHIP_DIALOG(), "the panel to close");
  });

  test("?when=pick: focus starts in the arrival calendar; Escape closes it, then the panel", async () => {
    await open(`/app/groups/${GROUP}/entries/new?kind=event&when=pick`);
    await waitUntil(() => !!CHIP_DIALOG() && !!GRID(), "the calendar");
    await waitUntil(() => !!GRID()?.contains(document.activeElement), "focus in the calendar");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !GRID(), "the calendar to close");
    expect(CHIP_DIALOG()).toBeTruthy();
    expect(document.activeElement).toBe(PICK_DATE());
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !CHIP_DIALOG(), "the panel to close");
  });

  test("at a short phone height the taller panel stays on screen, scrolling inside, with Done reachable", async () => {
    const appt = fx.event({ title: "Eye exam", occurredAt: at(ahead()), text: "" });
    await open(entryPath(appt.id), { fixtures: [base(), appt], width: 360, height: 560 });
    await userEvent.click(await found(TIME_CHIP));
    await userEvent.click(await found(() => button("Add an end time")));
    await userEvent.click(await found(() => picks()[1]));
    await waitUntil(() => !!GRID(), "the calendar");
    await settled();
    const popover = CHIP_DIALOG()!.parentElement!;
    await expect.poll(() => box(popover).top).toBeGreaterThanOrEqual(0);
    expect(box(popover).bottom).toBeLessThanOrEqual(window.innerHeight + 0.5);
    expect(popover.scrollHeight).toBeGreaterThan(popover.clientHeight);
    const done = button("Done")!;
    done.scrollIntoView({ block: "nearest" });
    await expect.poll(() => box(done).bottom).toBeLessThanOrEqual(box(popover).bottom + 0.5);
    await userEvent.click(done);
    await waitUntil(() => !CHIP_DIALOG(), "the panel to close");
  });

  test("place: empty with no provider; a linked provider's address greyed, 'from …', with a map; a viewer sees it with no field; a typed place replaces it", async () => {
    const appt = fx.event({ title: "Cardiology", occurredAt: at(ahead()), text: "" });
    const clinic = fx.provider({ name: "Harbor Heart Clinic", address: "12 Example Way, Springfield" });
    const device = await open(entryPath(appt.id), { fixtures: [base(), appt, clinic] });
    await waitUntil(() => !!PLACE());
    await expect.poll(() => PLACE()?.placeholder).toBe("Add a place");
    expect(MAP()).toBeNull();

    await device.sync(fx.link(appt.id, clinic.id));
    await device.settle();
    expect(PLACE()?.placeholder).toBe("12 Example Way, Springfield");
    await expect.poll(() => PLACE()?.value).toBe("");
    expect(PLACE_REGION()?.textContent).toContain("from Harbor Heart Clinic");
    expect(MAP()?.href).toContain(encodeURIComponent("12 Example Way, Springfield"));

    (await found(PLACE)).focus();
    await userEvent.keyboard("Lab, 2nd floor{Enter}");
    await expect.poll(async () => (await stored(device, appt.id))?.place).toBe("Lab, 2nd floor");
    await waitUntil(
      () => !!MAP()?.href.includes(encodeURIComponent("Lab, 2nd floor")),
      "the typed place on the map link",
    );
    expect(PLACE_REGION()?.textContent).not.toContain("from ");
    await device.screen.unmount();

    await open(entryPath(appt.id), {
      role: "viewer",
      fixtures: [base(), appt, clinic, fx.link(appt.id, clinic.id)],
    });
    await waitUntil(() => !!PLACE_REGION()?.textContent?.includes("12 Example Way"), "the viewer's place");
    expect(PLACE()).toBeNull();
    expect(MAP()).toBeTruthy();
  });

  for (const [name, when, heading] of [
    ["ahead", () => at(ahead()), "Upcoming event"],
    ["past", () => hoursAgo(3), "Past event"],
  ] as const)
    test(`an unnamed event ${name} is headed "${heading}"`, async () => {
      const unnamed = fx.event({ title: "Event", occurredAt: when(), text: "" });
      await open(entryPath(unnamed.id), { role: "viewer", fixtures: [base(), unnamed] });
      await waitUntil(() => document.querySelector("h1")?.textContent === heading, heading);
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
    await userEvent.click(await found(() => button("Done")));
    await waitUntil(() => !CHIP_DIALOG());
    await expect.poll(async () => (await stored(device, appt.id))?.all_day).toBe(1);
    expect((await stored(device, appt.id))?.ends_at).toBeNull();
    await waitUntil(() => /All day/.test(HEADER_TIME()?.textContent ?? ""), "All day in the header");
    await device.screen.unmount();

    await open(entryPath(appt.id), {
      role: "viewer",
      fixtures: [base(), { ...appt, row: { ...appt.row, all_day: 1 } }],
    });
    await waitUntil(() => /All day/.test(HEADER_TIME()?.textContent ?? ""));
    expect([!!TIME_CHIP(), !!PLACE()]).toEqual([false, false]);
  });
});
