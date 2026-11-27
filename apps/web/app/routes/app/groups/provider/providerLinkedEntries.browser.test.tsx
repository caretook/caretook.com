import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { formatTime } from "~/lib/core/format";
import { removeEntry } from "~/lib/timeline/timeline.sync";
import { renderWithDevice } from "../../../../../test/device";
import { found, waitUntil } from "../../../../../test/found";
import { at, entryTodo, fx, todo } from "../../../../../test/fixtures";
import { entryUrl, GROUP, PROVIDER_ROUTES, providerUrl } from "../providers/providerWorld";

// A provider's linked entries are the timeline's rows (B-937): the same
// markup (`TimelineEntryRow`: its open link, cancelled badge, live dot and
// open-todo mark), with the day over the time since they aren't grouped by
// day, no filter links (they'd point at the timeline's), and a ⋯ menu with
// Print and Copy link only.

const LARK = fx.provider({ name: "Dr. Mira Lark" });
const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));

// The test clock's day is Wednesday 2027-06-09 (Los Angeles).
const NOTE_AT = "2027-06-08T17:30:00.000Z";
const EVENT_AT = "2027-05-20T16:00:00.000Z";
const CANCELLED_AT = "2027-04-02T18:15:00.000Z";
const NOTE = fx.note({ occurredAt: at(new Date(NOTE_AT)), createdBy: SAM.id });
// Sam is writing in the note's document now: the live dot.
const NOTE_DOC = fx.document({
  ownerId: NOTE.id,
  text: "Asked about the new inhaler",
  editedBy: SAM.id,
  editedAt: minutesAgo(1),
});
const EVENT = fx.event({ occurredAt: at(new Date(EVENT_AT)), title: "Follow-up visit" });
const CANCELLED = fx.event({
  occurredAt: at(new Date(CANCELLED_AT)),
  title: "Allergy test",
  cancelledAt: minutesAgo(60 * 24 * 80),
});
const REFERRAL = todo({ title: "Send the referral" });
const fixtures = [
  LARK,
  SAM,
  NOTE,
  NOTE_DOC,
  EVENT,
  CANCELLED,
  REFERRAL,
  entryTodo(EVENT.id, REFERRAL.id),
  fx.link(NOTE.id, LARK.id),
  fx.link(EVENT.id, LARK.id),
  fx.link(CANCELLED.id, LARK.id),
];

const open = (role: "caretaker" | "viewer" = "caretaker") =>
  renderWithDevice({ route: PROVIDER_ROUTES, url: providerUrl(LARK.id), role, fixtures });

const rows = () => [...document.querySelectorAll<HTMLLIElement>("main [data-linked-entries] li")];
const rowWith = (text: string) => rows().find((li) => li.textContent?.includes(text));
const openOf = (li: Element | undefined) => li?.querySelector<HTMLAnchorElement>('a[aria-label^="Open "]');
const timeOf = (li: Element | undefined) => li?.querySelector<HTMLTimeElement>("time");

describe("linked entries as timeline rows", () => {
  test("a note and an event: the row's open link, day and time, text; no filter links; each opens its entry", async () => {
    const device = await open();
    await waitUntil(() => rows().length === 3, "the linked entries");
    const note = rowWith("Asked about the new inhaler");
    const event = rowWith("Follow-up visit");
    // Newest first.
    expect(rows()[0]).toBe(note);
    expect(rows()[1]).toBe(event);

    // The day over the time: rows here aren't grouped by day.
    expect(note?.querySelector("[data-row-day]")?.textContent).toBe("Yesterday");
    expect(timeOf(note)?.textContent).toBe(`Yesterday${formatTime(NOTE_AT)}`);
    expect(timeOf(note)?.dateTime).toBe(NOTE_AT);
    expect(event?.querySelector("[data-row-day]")?.textContent).toBe("May 20");
    expect(timeOf(event)?.textContent).toBe(`May 20${formatTime(EVENT_AT)}`);

    // The timeline row's parts: the open-todo mark, the author (not a filter), no kind filter.
    expect(event?.querySelector("[data-open-todos]")?.textContent).toBe("1 todo");
    expect(note?.querySelector("[data-open-todos]")).toBeNull();
    for (const li of rows()) {
      expect(li.querySelector('a[aria-label^="Show only"]')).toBeNull();
      expect(li.querySelector("a[data-author]")).toBeNull();
      expect(li.querySelector("[data-entry-aside]")).not.toBeNull();
    }
    expect(note?.querySelector("[data-entry-aside]")?.textContent).not.toContain("Former member");

    await userEvent.click(await found(() => openOf(rowWith("Follow-up visit"))));
    await expect.poll(() => device.location()).toBe(entryUrl(EVENT.id));
    await device.screen.unmount();

    const again = await open();
    await userEvent.click(await found(() => openOf(rowWith("Asked about the new inhaler"))));
    await expect.poll(() => again.location()).toBe(entryUrl(NOTE.id));
  });

  test("someone writing in a linked note now: the live dot, named", async () => {
    await open();
    await waitUntil(() => rows().length === 3, "the linked entries");
    const dot = rowWith("Asked about the new inhaler")?.querySelector<HTMLElement>("[data-live-dot]");
    expect(dot?.textContent).toBe("Being written now by Sam Okafor");
    expect(rowWith("Follow-up visit")?.querySelector("[data-live-dot]")).toBeNull();
  });

  test("a cancelled linked event: struck through, with the cancelled badge", async () => {
    await open();
    await waitUntil(() => rows().length === 3, "the linked entries");
    const cancelled = rowWith("Allergy test");
    expect(cancelled?.hasAttribute("data-cancelled")).toBe(true);
    expect(cancelled?.querySelector("[data-cancelled-label]")?.textContent).toBe("Cancelled");
    expect(rowWith("Follow-up visit")?.querySelector("[data-cancelled-label]")).toBeNull();
  });

  test("a viewer's ⋯: Print and Copy link, no Delete", async () => {
    await open("viewer");
    await waitUntil(() => rows().length === 3, "the linked entries");
    const actions = rowWith("Follow-up visit")?.querySelector<HTMLButtonElement>(
      'button[aria-label^="Actions for"]',
    );
    await userEvent.click(await found(() => actions));
    await expect.element(page.getByRole("menuitem", { name: "Copy link" })).toBeVisible();
    const items = [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
    expect(items).toContain("Print");
    expect(items).not.toContain("Delete");
  });
});

// Back from an entry opened here returns to the provider (B-936): the
// opener rides in history state, as the Planner's does (B-690).
describe("back from a linked entry", () => {
  const backLink = () =>
    [...document.querySelectorAll<HTMLAnchorElement>("main a")].find(
      (a) => a.textContent?.trim() === "Provider",
    ) ?? null;

  test("opened from the linked entries, Back reads Provider and lands on the provider", async () => {
    const device = await open();
    await waitUntil(() => rows().length === 3, "the linked entries");
    await userEvent.click(await found(() => openOf(rowWith("Follow-up visit"))));
    await expect.poll(() => device.location()).toBe(entryUrl(EVENT.id));
    expect((await found(backLink)).getAttribute("href")).toBe(providerUrl(LARK.id));
    await userEvent.click(await found(backLink));
    await expect.poll(() => device.location()).toBe(providerUrl(LARK.id));
  });

  test("deleted on another device while open, its notice goes back to the provider", async () => {
    const device = await open();
    await waitUntil(() => rows().length === 3, "the linked entries");
    await userEvent.click(await found(() => openOf(rowWith("Follow-up visit"))));
    await expect.poll(() => device.location()).toBe(entryUrl(EVENT.id));
    await found(backLink);
    expect((await removeEntry(device.db, EVENT.id)).ok).toBe(true);
    const notice = await found(() =>
      [...document.querySelectorAll<HTMLAnchorElement>("main a")].find(
        (a) => a.textContent?.trim() === "Back to the provider",
      ),
    );
    expect(notice.getAttribute("href")).toBe(providerUrl(LARK.id));
  });

  test("a direct link to the entry keeps the Timeline", async () => {
    await renderWithDevice({ route: PROVIDER_ROUTES, url: entryUrl(EVENT.id), role: "caretaker", fixtures });
    const timeline = await found(() =>
      [...document.querySelectorAll<HTMLAnchorElement>("main a")].find(
        (a) => a.textContent?.trim() === "Timeline",
      ),
    );
    expect(timeline.getAttribute("href")).toBe(`/app/groups/${GROUP}/timeline`);
    expect(backLink()).toBeNull();
  });
});
