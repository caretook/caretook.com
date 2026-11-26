import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, recordTag, tag } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { tagRecord, untagRecord } from "~/lib/tags/tags.sync";
import {
  activeChips,
  closeFilters,
  currentChips,
  filterButton,
  openFilters,
  openTimeline,
  rows,
  SAM,
  TIMELINE_URL,
} from "./timelineWorld";

// The timeline's tag filter (tags slice 6): `?tag=` narrows the history to
// the entries carrying one of the group's tags, alone or with a kind, an
// author and a search; the Filter sheet's Tag section sets it and its chip
// clears it. Latest vitals and the Next strip ignore it. The device is
// offline throughout, so every test here is the offline filter; local tag
// writes and synced ones change the list live. The URLs are
// timelineFilters.test.ts's.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const URGENT = tag("Urgent");
const KNEE = tag("Knee");
const WALK = fx.note({ occurredAt: minutesAgo(5), text: "Walked to the mailbox" });
const VISIT = fx.note({ occurredAt: minutesAgo(10), createdBy: SAM.id, text: "Sam's visit notes" });
const SORE = fx.symptom({ occurredAt: minutesAgo(15), name: "Sore knee", severity: 3 });
const TIRED = fx.symptom({ occurredAt: minutesAgo(20), createdBy: SAM.id, name: "Tired", severity: 2 });
const PHARMACY = fx.note({ occurredAt: minutesAgo(25), text: "Called the pharmacy" });
const GONE = fx.note({ occurredAt: minutesAgo(30), text: "Removed note", deletedAt: minutesAgo(1) });
const BP = fx.vital({
  occurredAt: minutesAgo(35),
  readings: [{ type: "heartRate", value: 72 }],
} as never);
const NEXT = fx.event({ occurredAt: at(new Date(Date.now() + 3 * 3_600_000)), title: "Physio visit" });

const FIXTURES = [
  SAM,
  URGENT,
  KNEE,
  WALK,
  VISIT,
  SORE,
  TIRED,
  PHARMACY,
  GONE,
  BP,
  NEXT,
  recordTag(URGENT.id, WALK.id),
  recordTag(URGENT.id, VISIT.id),
  recordTag(KNEE.id, VISIT.id),
  recordTag(KNEE.id, SORE.id),
  recordTag(URGENT.id, TIRED.id),
  recordTag(URGENT.id, GONE.id),
];

const ALL = ["Walked to the mailbox", "Sam's visit notes", "Sore knee", "Tired", "Called the pharmacy"];
/** The history's rows, by which of the known texts each shows (the vital's row isn't one). */
const shown = () =>
  rows()
    .flatMap((li) => ALL.filter((text) => li.textContent?.includes(text)).slice(0, 1))
    .join(",");
const tagChips = () => [
  ...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Show entries tagged"] a'),
];
const tagChip = (label: string) => tagChips().find((a) => a.textContent?.trim() === label);
const emptyLine = () => document.querySelector("[data-empty]")?.textContent ?? "";
const clearButton = () => document.querySelector<HTMLElement>("[data-filter-clear]");
const open = (query = "", options: Parameters<typeof openTimeline>[0] = {}) =>
  openTimeline({ query, fixtures: FIXTURES, ...options });
const URGENT_CHIP = "Tagged Urgent: clear this filter";

describe("the tag filter", () => {
  test("?tag= shows only the live entries carrying it, with its chip; the chip clears it", async () => {
    const device = await open(`?tag=${URGENT.id}`);
    await expect.poll(shown).toBe("Walked to the mailbox,Sam's visit notes,Tired");
    expect(currentChips()).toBe(URGENT_CHIP);
    expect(filterButton().getAttribute("aria-label")).toBe("Filter, 1 on");
    // The Today card ignores it: the heart rate and the next event are still there.
    expect(document.querySelector('[data-today-row="vitals"]')?.textContent).toContain("72");
    expect(document.body.textContent).toContain("Physio visit");

    const chip = activeChips().find((a) => a.getAttribute("aria-label") === URGENT_CHIP);
    await userEvent.click(await found(() => chip));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.poll(shown).toBe(ALL.join(","));
    expect(currentChips()).toBe("");
  });

  test("an id that isn't one of the group's tags is no filter", async () => {
    await open("?tag=6d1f0b2a-3c4e-4f5a-8b9c-0d1e2f3a4b5c");
    await expect.poll(shown).toBe(ALL.join(","));
    expect(currentChips()).toBe("");
    expect(filterButton().getAttribute("aria-label")).toBe("Filter");
  });

  test("the sheet's Tag section: Any, then the group's tags A to Z; a choice applies at once, Clear takes it off", async () => {
    const device = await open();
    await expect.poll(shown).toBe(ALL.join(","));
    await openFilters();
    expect(tagChips().map((a) => a.textContent?.trim())).toEqual(["Any", "Knee", "Urgent"]);
    expect(tagChip("Any")?.getAttribute("aria-current")).toBe("true");

    await userEvent.click(await found(() => tagChip("Knee")));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?tag=${KNEE.id}`);
    await expect.poll(shown).toBe("Sam's visit notes,Sore knee");
    await expect.poll(() => tagChip("Knee")?.getAttribute("aria-current")).toBe("true");

    await userEvent.click(await found(() => tagChip("Any")));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await userEvent.click(await found(() => tagChip("Urgent")));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?tag=${URGENT.id}`);
    await userEvent.click(await found(clearButton));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await closeFilters();
    await expect.poll(shown).toBe(ALL.join(","));
  });

  test("a group with no tags has no Tag section", async () => {
    await openTimeline({ fixtures: [WALK, PHARMACY] });
    await openFilters();
    expect(tagChips()).toEqual([]);
  });

  test("with a kind and with an author: both apply", async () => {
    const device = await open(`?kind=note&tag=${URGENT.id}`);
    await expect.poll(shown).toBe("Walked to the mailbox,Sam's visit notes");
    expect(currentChips()).toBe(`Notes: clear this filter,${URGENT_CHIP}`);
    await device.screen.unmount();

    await open(`?author=${SAM.id}&tag=${URGENT.id}`);
    await expect.poll(shown).toBe("Sam's visit notes,Tired");
    expect(currentChips()).toBe(`${URGENT_CHIP},By Sam Okafor: clear this filter`);
  });

  test("with a search: only the tagged matches; none says so, naming the tag", async () => {
    const device = await open(`?q=visit&tag=${URGENT.id}`, { search: true });
    await expect.poll(shown).toBe("Sam's visit notes");
    await device.screen.unmount();

    await open(`?q=walked&tag=${KNEE.id}`, { search: true });
    await expect.poll(shown).toBe("");
    await expect.poll(emptyLine).toBe("No entries tagged “Knee” match “walked”.");
  });

  test("live: an entry tagged here or on another device comes in, untagged goes out", async () => {
    const device = await open(`?tag=${KNEE.id}`);
    await expect.poll(shown).toBe("Sam's visit notes,Sore knee");

    expect(await tagRecord(device.db, KNEE.id, "entry", PHARMACY.id)).toEqual({ ok: true });
    await device.settle();
    await expect.poll(shown).toBe("Sam's visit notes,Sore knee,Called the pharmacy");

    expect(await untagRecord(device.db, KNEE.id, "entry", SORE.id)).toEqual({ ok: true });
    await device.settle();
    await expect.poll(shown).toBe("Sam's visit notes,Called the pharmacy");

    await device.sync([recordTag(KNEE.id, WALK.id)]);
    await device.settle();
    await expect.poll(shown).toBe("Walked to the mailbox,Sam's visit notes,Called the pharmacy");
  });

  test("with every filter at once; nothing tagged says so, naming the tag", async () => {
    const device = await open(`?kind=symptom&tag=${URGENT.id}&author=${SAM.id}`);
    await expect.poll(shown).toBe("Tired");
    await device.screen.unmount();

    await open(`?kind=vital&tag=${KNEE.id}`);
    await expect.poll(emptyLine).toBe("No vitals tagged “Knee” on the timeline yet.");
  });
});
