import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { dayKeyIn } from "./timelineDays";
import { openTimeline, rows, rowWith, setView, TIMELINE_URL } from "./timelineWorld";

// The copy-link buttons (B-737): each day header copies its `?day=` link, each
// entry its page (a symptom, with no page, its day), as absolute URLs; "Link
// copied" is a polite status, and where the clipboard fails a dialog shows the
// link to copy by hand.

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

  test("an entry's button copies the entry's page, a symptom's its day, on rows and cards", async () => {
    const copied = copying();
    await openTimeline({ fixtures, role: "viewer" });
    await waitUntil(() => rows().length === 2, "two rows");
    const note = () => rowWith("Walked to the mailbox");
    expect(copyButton(note())?.getAttribute("aria-label")).toMatch(/^Copy link to note at /);
    await userEvent.click(await found(() => copyButton(note())));
    await expect.poll(() => statusOf(note())).toBe("Link copied");
    expect(copied).toEqual([`${location.origin}/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`]);
    // The tap didn't open the entry under the row's stretched link.
    expect(document.querySelector("h1")?.textContent ?? "").not.toContain("Entry page");

    await userEvent.click(await found(() => copyButton(rowWith("Sore knee"))));
    await expect.poll(() => copied.length).toBe(2);
    expect(copied[1]).toBe(
      `${location.origin}${TIMELINE_URL}?day=${dayKeyIn(daysAgo(3).toISOString(), zone())}`,
    );

    await setView("Full");
    await waitUntil(() => !!copyButton(rowWith("Walked to the mailbox")), "the card's button");
    await userEvent.click(await found(() => copyButton(rowWith("Walked to the mailbox"))));
    await expect.poll(() => copied.length).toBe(3);
    expect(copied[2]).toBe(copied[0]);
  });

  test("a clipboard failure shows the link to copy instead", async () => {
    stubClipboard({ writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) });
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 2, "two rows");
    await userEvent.click(await found(() => copyButton(rowWith("Walked to the mailbox"))));
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
