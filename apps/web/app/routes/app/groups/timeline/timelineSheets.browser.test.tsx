import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { fixClock, found } from "../../../../../test/found";
import { fx, TEST_USER } from "../../../../../test/fixtures";
import { rows, rowWith, TIMELINE_URL as T, openTimeline } from "./timelineWorld";

// The add and edit sheets' own behaviour (roundtrip.mjs's validation,
// picker, edit and delete steps): a symptom needs a name and shows its error
// before anything is written; an add shows at once and is stored and queued
// as the signed-in user; an edit and a delete do the same; When's date
// picker works from the keyboard, typed segments and a tapped day, saves the
// day it shows and opens on the entry's own date when editing. The sheets'
// URLs are timelineSheetUrls.browser.test.tsx's, and an entry reaching the
// other device is roundtrip.mjs's.

const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
const NAME = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
const SUBMIT = () => SHEET()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const PICK = () => SHEET()?.querySelector<HTMLElement>('[aria-label="Pick a date"]') ?? null;
const GRID = () => document.querySelector("[role=grid]");
const SELECTED_DAY = () => document.querySelector("[role=grid] [data-selected]")?.textContent?.trim();
const FOCUSED_DAY = () =>
  document.activeElement?.closest("[role=grid]") ? document.activeElement.textContent?.trim() : null;
const CAL_HEADING = () => GRID()?.closest("[role=dialog]")?.querySelector("h2")?.textContent?.trim();
const segments = () => {
  const s: Record<string, string> = {};
  for (const el of document.querySelectorAll<HTMLElement>("[role=dialog] [data-type]"))
    s[el.dataset.type!] = el.textContent.trim();
  return s;
};
const heading = (s: Record<string, string>) =>
  new Date(Number(s.year), Number(s.month) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
const dayCell = (day: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=grid] [role=gridcell] > *")].find(
    (c) => c.textContent?.trim() === day && !c.hasAttribute("data-outside-month"),
  )!;
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const dayOf = (text: string) => rowWith(text)?.closest("section")?.querySelector("h3")?.textContent?.trim();
const entriesNamed = (device: Awaited<ReturnType<typeof openTimeline>>, name: string) =>
  device.query<{ id: string; created_by: string; updated_by: string; deleted_at: string | null }>(
    "SELECT id, created_by, updated_by, deleted_at FROM timeline_entry WHERE json_extract(details, '$.name') = ?",
    [name],
  );

/** The add sheet for a symptom, open over the timeline. */
const openAdd = async (fixtures: ReturnType<typeof fx.symptom>[] = []) => {
  const device = await openTimeline({
    url: `${T}/new/symptom?kind=symptom`,
    role: "caretaker",
    fixtures,
  });
  await expect.poll(NAME).not.toBeNull();
  return device;
};

describe("the add sheet", () => {
  test("a symptom with no name shows a field error and writes nothing; Cancel closes it", async () => {
    const device = await openAdd();
    await userEvent.click(await found(SUBMIT));
    await expect.poll(() => NAME()?.getAttribute("aria-invalid")).toBe("true");
    expect(SHEET()).not.toBeNull();
    expect(await entriesNamed(device, "")).toHaveLength(0);
    expect(await device.queued()).toHaveLength(0);
    await userEvent.click(
      await found(() =>
        [...(SHEET()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === "Cancel"),
      ),
    );
    await expect.poll(SHEET).toBeNull();
  });

  test("the footer is the kit's: Cancel, then the submit button, and Cancel doesn't submit", async () => {
    const device = await openAdd();
    await userEvent.fill(await found(NAME), "Unsaved knee");
    const cancel = await found(() => SHEET()?.querySelector<HTMLButtonElement>("[data-form-cancel]"));
    expect(cancel.type).toBe("button");
    expect(cancel.compareDocumentPosition(SUBMIT()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(SUBMIT().textContent?.trim()).toBe("Add to timeline");
    await userEvent.click(cancel);
    await expect
      .poll(() => document.querySelector("dialog[open]")?.textContent)
      .toContain("Discard changes?");
    expect(await entriesNamed(device, "Unsaved knee")).toHaveLength(0);
  });

  test("a log's time still defaults to the current minute", async () => {
    fixClock(new Date(2027, 5, 9, 12, 7));
    await openAdd();
    expect(segments().minute).toBe("07");
  });

  test("a save shows on the device at once, stored and queued as the signed-in user", async () => {
    const device = await openAdd();
    await userEvent.fill(await found(NAME), "Knee pain");
    await userEvent.click(await found(SUBMIT));
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith("Knee pain")).toBeTruthy();
    const [saved] = await entriesNamed(device, "Knee pain");
    expect(saved).toBeTruthy();
    expect(saved?.created_by).toBe(TEST_USER.id);
    expect((await device.queued()).some((w) => w.id === saved!.id)).toBe(true);
  });
});

describe("the edit sheet", () => {
  const KNEE = fx.symptom({ name: "Sore knee", severity: 2 });

  test("a change shows in the row, stored and queued as the signed-in user", async () => {
    const device = await openTimeline({ role: "caretaker", fixtures: [KNEE] });
    await expect.poll(() => rowWith("Sore knee")).toBeTruthy();
    await userEvent.click(await found(() => rowWith("Sore knee")?.querySelector('a[aria-label^="Edit "]')), {
      force: true,
    });
    await expect.poll(() => SHEET()?.textContent?.includes("Edit symptom")).toBe(true);
    await userEvent.fill(await found(NAME), "Sore knee, edited");
    await userEvent.click(await found(SUBMIT));
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith("Sore knee, edited")).toBeTruthy();
    const [saved] = await entriesNamed(device, "Sore knee, edited");
    expect(saved?.id).toBe(KNEE.id);
    expect(saved?.updated_by).toBe(TEST_USER.id);
    expect((await device.queued()).some((w) => w.id === KNEE.id)).toBe(true);
  });
});

describe("delete", () => {
  test("⋯ → Delete asks, then the row goes and the entry is soft-deleted and queued", async () => {
    const knee = fx.symptom({ name: "Delete me", severity: 2 });
    const device = await openTimeline({ role: "caretaker", fixtures: [knee] });
    await expect.poll(() => rowWith("Delete me")).toBeTruthy();
    await userEvent.click(
      await found(() => rowWith("Delete me")?.querySelector('button[aria-label^="Actions"]')),
    );
    await expect.poll(() => menuItem("Delete")).toBeTruthy();
    await userEvent.click(await found(() => menuItem("Delete")));
    await expect.poll(() => document.querySelector("dialog[open] .btn-error")).toBeTruthy();
    await userEvent.click(await found(() => document.querySelector("dialog[open] .btn-error")));
    await expect.poll(() => rowWith("Delete me")).toBeUndefined();
    const [gone] = await entriesNamed(device, "Delete me");
    expect(gone?.deleted_at).not.toBeNull();
    expect((await device.queued()).some((w) => w.id === knee.id)).toBe(true);
    expect(rows().some((li) => li.textContent?.includes("Delete me"))).toBe(false);
  });
});

describe("When's date picker", () => {
  const sameTime = (a: Record<string, string>, b: Record<string, string>) =>
    a.hour === b.hour && a.minute === b.minute && a.dayPeriod === b.dayPeriod;
  /** The day before the one the segments show, as the calendar numbers it. */
  const before = (s: Record<string, string>) => {
    const d = new Date(Number(s.year), Number(s.month) - 1, Number(s.day) - 1);
    return { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  };

  test("Tab reaches Pick a date; Enter opens the calendar on the shown day; arrows move; Escape closes it with focus back and the date unchanged; Enter on a day keeps the time", async () => {
    await openAdd();
    const s0 = segments();
    const yesterday = before(s0);
    [...document.querySelectorAll<HTMLElement>("[role=dialog] [data-type]")].at(-1)!.focus();
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => document.activeElement === PICK()).toBe(true);

    await userEvent.keyboard("{Enter}");
    await expect.poll(FOCUSED_DAY).toBe(s0.day);
    expect(SELECTED_DAY()).toBe(s0.day);
    expect(CAL_HEADING()).toBe(heading(s0));

    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(FOCUSED_DAY).toBe(yesterday.day);

    await userEvent.keyboard("{Escape}");
    await expect.poll(GRID).toBeNull();
    await expect.poll(() => document.activeElement === PICK()).toBe(true);
    expect(segments().day).toBe(s0.day);
    expect(SHEET()).not.toBeNull();

    await userEvent.keyboard("{Enter}");
    await expect.poll(FOCUSED_DAY).toBe(s0.day);
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(FOCUSED_DAY).toBe(yesterday.day);
    await userEvent.keyboard("{Enter}");
    await expect.poll(GRID).toBeNull();
    const s1 = segments();
    expect([s1.day, s1.month]).toEqual([yesterday.day, yesterday.month]);
    expect(sameTime(s1, s0)).toBe(true);
  });

  test("typing a segment still works and the calendar shows the typed date; tapping a day sets it; the save is under Yesterday, and editing opens the calendar on its date", async () => {
    await openAdd();
    await userEvent.fill(await found(NAME), "Picked date");
    const s0 = segments();
    const yesterday = before(s0);

    // A typed day (the segment steps with ArrowDown, twice: not past now), then the calendar shows it.
    SHEET()!.querySelector<HTMLElement>('[data-type="day"]')!.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const typed = segments();
    expect(typed.day).not.toBe(s0.day);
    await userEvent.click(await found(PICK), { force: true });
    await expect.poll(SELECTED_DAY).toBe(typed.day);
    expect(CAL_HEADING()).toBe(heading(typed));

    await userEvent.click(dayCell(yesterday.day));
    await expect.poll(GRID).toBeNull();
    const s2 = segments();
    expect([s2.day, s2.month]).toEqual([yesterday.day, yesterday.month]);
    expect(sameTime(s2, s0)).toBe(true);

    await userEvent.click(await found(SUBMIT));
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith("Picked date")).toBeTruthy();
    expect(dayOf("Picked date")).toBe("Yesterday");

    await userEvent.click(
      await found(() => rowWith("Picked date")?.querySelector('a[aria-label^="Edit "]')),
      { force: true },
    );
    await expect.poll(() => SHEET()?.textContent?.includes("Edit symptom") && PICK()).toBeTruthy();
    await userEvent.click(await found(PICK), { force: true });
    await expect.poll(SELECTED_DAY).toBe(yesterday.day);
    expect(CAL_HEADING()).toBe(heading({ year: yesterday.year, month: yesterday.month }));
    await userEvent.keyboard("{Escape}");
    await expect.poll(GRID).toBeNull();
  });
});
