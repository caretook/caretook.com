import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { dayKeyIn } from "~/lib/timeline/timelineDays";
import { chooseEasyMode, openTimeline, rows, rowWith, setView, TIMELINE_URL } from "./timelineWorld";

// Copy link (B-737, B-899): each day header's button copies its `?day=` link;
// each entry's ⋯ menu has Copy link (every role, the full and easy views; no
// button on the row), copying its page (a symptom, with no page, its day), as
// absolute URLs; "Link copied" is a polite status, and where the clipboard
// fails a dialog shows the link to copy by hand.

const hoursAgo = (h: number) => at(new Date(Date.now() - h * 3_600_000));
const daysAgo = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(10, 0, 0, 0);
  return t;
};
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const NOTE = fx.note({ occurredAt: hoursAgo(1), text: "Walked to the mailbox" });
const SYMPTOM = fx.symptom({ occurredAt: at(daysAgo(3)), name: "Sore knee" });
const fixtures = [NOTE, SYMPTOM];

const headerOf = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-day-header]")].find(
    (h) => h.querySelector("h3")?.textContent === label,
  );
const copyButton = (within: Element | null | undefined) =>
  within?.querySelector<HTMLButtonElement>("[data-copy-link] button") ?? null;
const statusOf = (within: Element | null | undefined) =>
  within?.querySelector("[data-copy-link] [role=status]")?.textContent ?? null;
const actionsOf = (row: Element | null | undefined) =>
  row?.querySelector<HTMLButtonElement>('button[aria-label^="Actions for"]') ?? null;
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const noCopyButton = (row: Element | null | undefined) =>
  !row?.querySelector('button[aria-label^="Copy link"]') && !row?.querySelector('a[aria-label^="Copy link"]');
/** The last ⋯ menu has finished closing, so the next one's items are its own. */
const menuClosed = () => waitUntil(() => !document.querySelector("[role=menu]"), "the menu closed");
/** Opens `row`'s ⋯ and taps Copy link. */
const copyFromMenu = async (row: () => Element | null | undefined) => {
  await userEvent.click(await found(() => actionsOf(row())));
  await userEvent.click(page.getByRole("menuitem", { name: "Copy link" }));
};

const own = ["clipboard"] as const;
const stubClipboard = (value: unknown) =>
  Object.defineProperty(navigator, "clipboard", { value, configurable: true, writable: true });
const copying = () => {
  const copied: string[] = [];
  stubClipboard({ writeText: (t: string) => (copied.push(t), Promise.resolve()) });
  return copied;
};
afterEach(() => {
  for (const key of own) delete (navigator as unknown as Record<string, unknown>)[key];
});

describe("copy link", () => {
  test("a day header's button copies that day's absolute link and says so", async () => {
    const copied = copying();
    const device = await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 2, "two rows");
    const today = headerOf("Today");
    expect(copyButton(today)?.getAttribute("aria-label")).toBe("Copy link to Today");
    await userEvent.click(await found(() => copyButton(headerOf("Today"))));
    await expect.poll(() => statusOf(headerOf("Today"))).toBe("Link copied");
    const day = dayKeyIn(new Date().toISOString(), zone());
    expect(copied).toEqual([`${location.origin}${TIMELINE_URL}?day=${day}`]);
    // A day further down copies its own day.
    const older = rowWith("Sore knee")?.closest("section")?.querySelector<HTMLElement>("[data-day-header]");
    await userEvent.click(await found(() => copyButton(older)));
    await expect.poll(() => copied.length).toBe(2);
    expect(copied[1]).toBe(
      `${location.origin}${TIMELINE_URL}?day=${dayKeyIn(daysAgo(3).toISOString(), zone())}`,
    );
    // It fades, and nothing navigated.
    await waitUntil(() => statusOf(headerOf("Today")) === "", "the status cleared");
    expect(device.location()).toBe(TIMELINE_URL);
  });

  test("an entry has no copy-link button; a reader's ⋯ Copy link copies its page, a symptom's its day, on rows and cards", async () => {
    const copied = copying();
    await openTimeline({ fixtures, role: "viewer" });
    await waitUntil(() => rows().length === 2, "two rows");
    const note = () => rowWith("Walked to the mailbox");
    expect(noCopyButton(note())).toBe(true);
    expect(noCopyButton(rowWith("Sore knee"))).toBe(true);
    await userEvent.click(await found(() => actionsOf(note())));
    await waitUntil(() => menuItems().length > 0, "the menu");
    expect(menuItems()).toEqual(["Print", "Copy link"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Copy link" }));
    await expect.poll(() => statusOf(note())).toBe("Link copied");
    expect(copied).toEqual([`${location.origin}/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`]);
    // The tap didn't open the entry under the row's stretched link.
    expect(document.querySelector("h1")?.textContent ?? "").not.toContain("Entry page");
    await menuClosed();

    // A symptom gives a reader a ⋯ with Copy link alone.
    await userEvent.click(await found(() => actionsOf(rowWith("Sore knee"))));
    await waitUntil(() => menuItems().length > 0, "the menu");
    expect(menuItems()).toEqual(["Copy link"]);
    await userEvent.click(page.getByRole("menuitem", { name: "Copy link" }));
    await expect.poll(() => copied.length).toBe(2);
    expect(copied[1]).toBe(
      `${location.origin}${TIMELINE_URL}?day=${dayKeyIn(daysAgo(3).toISOString(), zone())}`,
    );
    await menuClosed();

    await setView("Full");
    await waitUntil(() => !!actionsOf(note()), "the card's menu");
    expect(noCopyButton(note())).toBe(true);
    await copyFromMenu(note);
    await expect.poll(() => copied.length).toBe(3);
    expect(copied[2]).toBe(copied[0]);
  });

  test("in the easy view, a writer's ⋯ has Copy link and no row button", async () => {
    const copied = copying();
    chooseEasyMode();
    await openTimeline({ fixtures });
    const note = () =>
      [...document.querySelectorAll("[data-easy-list] li")].find((li) =>
        li.textContent?.includes("Walked to the mailbox"),
      );
    await waitUntil(() => !!note(), "the easy view's row");
    expect(noCopyButton(note())).toBe(true);
    await userEvent.click(await found(() => actionsOf(note())));
    await waitUntil(() => menuItems().length > 0, "the menu");
    expect(menuItems()).toContain("Copy link");
    expect(menuItems().at(-1)).toBe("Delete");
    await userEvent.click(page.getByRole("menuitem", { name: "Copy link" }));
    await expect.poll(() => statusOf(note())).toBe("Link copied");
    expect(copied).toEqual([`${location.origin}/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`]);
  });

  test("a clipboard failure shows the link to copy instead", async () => {
    stubClipboard({ writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) });
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 2, "two rows");
    await copyFromMenu(() => rowWith("Walked to the mailbox"));
    const dialog = await found(() => document.querySelector<HTMLDialogElement>("dialog[open]"));
    expect(dialog.textContent).toContain("Couldn't copy the link");
    const field = dialog.querySelector<HTMLInputElement>("[data-copy-link-url]");
    expect(field?.value).toBe(`${location.origin}/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`);
    expect(statusOf(rowWith("Walked to the mailbox"))).toBe("");
    await userEvent.click(
      await found(() => [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Done")),
    );
    await waitUntil(() => !document.querySelector("dialog[open]"), "the dialog closed");
  });

  test("without a clipboard at all, the day header shows its link", async () => {
    stubClipboard(undefined);
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 2, "two rows");
    await userEvent.click(await found(() => copyButton(headerOf("Today"))));
    const dialog = await found(() => document.querySelector<HTMLDialogElement>("dialog[open]"));
    expect(dialog.querySelector<HTMLInputElement>("[data-copy-link-url]")?.value).toBe(
      `${location.origin}${TIMELINE_URL}?day=${dayKeyIn(new Date().toISOString(), zone())}`,
    );
  });
});
