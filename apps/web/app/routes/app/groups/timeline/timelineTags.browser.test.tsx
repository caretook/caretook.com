import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx, recordTag, tag, TEST_GROUP } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { rescheduleEvent } from "~/lib/appointments/appointments.sync";
import { historyWindow } from "~/lib/timeline/timeline.sync";
import { openTimeline, rows, rowWith, SAM, setView } from "./timelineWorld";

// Tags on timeline entries (tags slice 2): the ⋯ menu's Tags opens the
// picker sheet for whoever may tag the entry (writers any kind, an Easy
// helper their own); toggles and a typed new name are local writes, and the
// row's chips (two, then "+N") follow live, for every role and in the easy
// view. The pure matching is tagPicker.test.ts's; the rule tagRules.test.ts's.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const LISINOPRIL = fx.medication({ name: "Lisinopril", strength: "10 mg" });
const NOTE_AT = minutesAgo(5);
const NOTE = fx.note({ occurredAt: NOTE_AT, text: "Walked to the mailbox" });
const SYMPTOM = fx.symptom({ occurredAt: minutesAgo(10), name: "Sore knee", severity: 3 });
const DOSE = fx.dose({ medicationId: LISINOPRIL.id, occurredAt: minutesAgo(15) });
const SAMS_NOTE = fx.note({ occurredAt: minutesAgo(20), createdBy: SAM.id, text: "Sam's visit notes" });
const SAMS_SYMPTOM = fx.symptom({ occurredAt: minutesAgo(25), createdBy: SAM.id, name: "Tired" });
const URGENT = tag("Urgent");
const KNEE = tag("Knee");
const MOVE = tag("Care home move");
const base = [SAM, LISINOPRIL, NOTE, SYMPTOM, DOSE, SAMS_NOTE, SAMS_SYMPTOM, URGENT, KNEE, MOVE];

const actionsOf = (text: string) =>
  rowWith(text)?.querySelector<HTMLElement>('button[aria-label^="Actions for"]') ?? null;
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const chipsOf = (text: string) =>
  [...(rowWith(text)?.querySelectorAll("[data-tag-chip]") ?? [])].map((c) => c.textContent?.trim()).join(",");
const moreOf = (text: string) =>
  rowWith(text)?.querySelector("[data-tag-more] [aria-hidden]")?.textContent ?? null;
const PICKER = () => document.querySelector<HTMLFormElement>("[data-tag-picker]");
const FILTER = () => PICKER()?.querySelector<HTMLInputElement>("[data-tag-filter]") ?? null;
const ADD = () => PICKER()?.querySelector<HTMLButtonElement>("[data-tag-add]") ?? null;
const listed = () =>
  [...(PICKER()?.querySelectorAll("[data-tag-list] label") ?? [])]
    .map((l) => l.textContent?.trim())
    .join(",");

const openMenu = async (text: string) => {
  await userEvent.click(await found(() => actionsOf(text)));
  await waitUntil(() => menuItems().length > 0, "the menu");
};
const openPicker = async (text: string) => {
  await openMenu(text);
  await userEvent.click(page.getByRole("menuitem", { name: "Tags" }));
  await found(PICKER);
};
const toggle = (name: string) => userEvent.click(page.getByRole("checkbox", { name }));
const closePicker = async () => {
  await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));
  await expect.poll(PICKER).toBeNull();
};
const open = (role: GroupRole = "owner", extra: Parameters<typeof openTimeline>[0] = {}) =>
  openTimeline({ role, fixtures: [...base, recordTag(KNEE.id, SAMS_NOTE.id)], ...extra });
const ready = () => waitUntil(() => rows().length >= 5, "the rows");

describe("tagging an entry", () => {
  test("a writer applies, removes and adds a tag on a note, a symptom and a dose; the chips follow live", async () => {
    const device = await open();
    await ready();
    for (const [i, text] of ["Walked to the mailbox", "Sore knee", "Lisinopril"].entries()) {
      await openPicker(text);
      // The group's tags, A to Z (those added for earlier rows too), none on it yet.
      const earlier = Array.from({ length: i }, (_, n) => `Follow up ${n}`);
      await expect.poll(listed).toBe(["Care home move", ...earlier, "Knee", "Urgent"].join(","));
      await toggle("Urgent");
      await device.settle();
      await expect.poll(() => chipsOf(text)).toBe("Urgent");

      // A name the group has, in another case: no Add, and Enter puts that tag on.
      await userEvent.fill(await found(FILTER), "  KNEE ");
      await expect.poll(listed).toBe("Knee");
      expect(ADD()).toBeNull();
      await userEvent.keyboard("{Enter}");
      await device.settle();
      await expect.poll(() => chipsOf(text)).toBe("Knee,Urgent");

      // A new name: added to the group's list and put on in one step; the box clears.
      const name = `Follow up ${i}`;
      await userEvent.fill(await found(FILTER), name);
      await expect.poll(() => ADD()?.textContent).toBe(`Add “${name}”`);
      await userEvent.click(await found(ADD));
      await device.settle();
      await expect.poll(() => FILTER()?.value).toBe("");
      await expect.poll(() => chipsOf(text)).toBe(`${name},Knee`);
      expect(moreOf(text)).toBe("+1");

      // Off again.
      await toggle("Urgent");
      await device.settle();
      await expect.poll(() => chipsOf(text)).toBe(`${name},Knee`);
      expect(moreOf(text)).toBeNull();
      await closePicker();
    }
    // One tag per name, each new one once; the links queued for upload.
    const names = await device.query<{ name: string }>("SELECT name FROM tag ORDER BY name_key");
    expect(names.map((t) => t.name)).toEqual([
      "Care home move",
      "Follow up 0",
      "Follow up 1",
      "Follow up 2",
      "Knee",
      "Urgent",
    ]);
    const links = await device.query<{ n: number }>("SELECT count(*) AS n FROM record_tag");
    expect(links[0]?.n).toBe(7);
  });

  test("an Easy helper gets Tags on their own entries only; the chips show in the easy view", async () => {
    await open("easy_helper");
    await waitUntil(() => !!document.querySelector("[data-easy-list]"), "the easy view");
    await ready();
    await openMenu("Walked to the mailbox");
    expect(menuItems()).toContain("Tags");
    await userEvent.keyboard("{Escape}");
    await openMenu("Sore knee");
    expect(menuItems()).toContain("Tags");
    await userEvent.keyboard("{Escape}");
    // Sam's: a note keeps Print and no Tags; a symptom has Copy link alone.
    await openMenu("Sam's visit notes");
    expect(menuItems()).toEqual(["Print", "Copy link"]);
    await userEvent.keyboard("{Escape}");
    await openMenu("Tired");
    expect(menuItems()).toEqual(["Copy link"]);
    await userEvent.keyboard("{Escape}");
    expect(chipsOf("Sam's visit notes")).toBe("Knee");

    await openPicker("Sore knee");
    await toggle("Urgent");
    await expect.poll(() => chipsOf("Sore knee")).toBe("Urgent");
  });

  for (const role of ["viewer", "easy_viewer"] as const)
    test(`a${role === "viewer" ? " viewer" : "n Easy viewer"} sees the chips and no Tags`, async () => {
      await open(role);
      await ready();
      expect(chipsOf("Sam's visit notes")).toBe("Knee");
      await openMenu("Walked to the mailbox");
      expect(menuItems()).toEqual(["Print", "Copy link"]);
      await userEvent.keyboard("{Escape}");
      for (const text of ["Sore knee", "Lisinopril"]) {
        await openMenu(text);
        expect(menuItems()).toEqual(["Copy link"]);
        await userEvent.keyboard("{Escape}");
      }
    });
});

describe("the chips", () => {
  const GONE = fx.note({ occurredAt: minutesAgo(30), text: "Deleted note", deletedAt: minutesAgo(1) });
  const tagged = [
    recordTag(URGENT.id, NOTE.id),
    recordTag(KNEE.id, NOTE.id),
    recordTag(MOVE.id, NOTE.id),
    recordTag(MOVE.id, GONE.id),
  ];

  test("rows and cards show two, then +N; a soft-deleted tagged entry shows nowhere, at once or later", async () => {
    const device = await openTimeline({ fixtures: [...base, GONE, ...tagged] });
    await ready();
    await expect.poll(() => chipsOf("Walked to the mailbox")).toBe("Care home move,Knee");
    expect(moreOf("Walked to the mailbox")).toBe("+1");
    expect(rowWith("Deleted note")).toBeUndefined();
    // "Care home move" shows on the live note only.
    expect(document.querySelectorAll(`[data-tag-chip="${MOVE.id}"]`)).toHaveLength(1);

    await setView("Full");
    await expect.poll(() => chipsOf("Walked to the mailbox")).toBe("Care home move,Knee");
    expect(moreOf("Walked to the mailbox")).toBe("+1");

    // Deleted on another device: its row and chips go; its links stay in the table.
    await device.sync(fx.note({ id: NOTE.id, occurredAt: NOTE_AT, deletedAt: minutesAgo(0) }));
    await device.settle();
    await expect.poll(() => document.querySelectorAll("[data-tag-chip]").length).toBe(0);
    const links = await device.query<{ n: number }>(
      "SELECT count(*) AS n FROM record_tag WHERE entry_id = ?",
      [NOTE.id],
    );
    expect(links[0]?.n).toBe(3);
  });

  test("EntryFilters.tag narrows a window to the tagged entries; with a search, both apply", async () => {
    const device = await openTimeline({
      fixtures: [...base, GONE, ...tagged, recordTag(KNEE.id, SYMPTOM.id)],
    });
    await ready();
    const ids = async (filters: Parameters<typeof historyWindow>[1]) => {
      const w = historyWindow(TEST_GROUP.id, filters, 30, new Date().toISOString());
      return (await device.query<{ id: string }>(`SELECT id ${w.sql}`, w.params)).map((r) => r.id).sort();
    };
    const none = { kind: null, author: null };
    expect(await ids({ ...none, tag: KNEE.id })).toEqual([NOTE.id, SYMPTOM.id].sort());
    expect(await ids({ ...none, tag: MOVE.id })).toEqual([NOTE.id]);
    const symptomOnly = { sql: "timeline_entry.id IN (?, ?)", params: [SYMPTOM.id, DOSE.id] };
    expect(await ids({ ...none, tag: KNEE.id, match: symptomOnly })).toEqual([SYMPTOM.id]);
    expect(await ids({ ...none, tag: URGENT.id, match: symptomOnly })).toEqual([]);
  });
});

describe("rescheduling", () => {
  const VISIT = fx.event({ title: "Eye exam", occurredAt: minutesAgo(40), text: "Drops in both eyes." });

  test("keeps the tags on the new event (and the old one's); both rows show them", async () => {
    const device = await openTimeline({
      fixtures: [...base, VISIT, recordTag(URGENT.id, VISIT.id), recordTag(MOVE.id, VISIT.id)],
    });
    await ready();
    const res = await rescheduleEvent(device.db, VISIT.id, {
      occurredAt: new Date(Date.now() - 35 * 60_000).toISOString(),
      endsAt: null,
      allDay: false,
      keepOldAsCancelled: true,
    });
    expect(res.ok).toBe(true);
    const newId = res.ok ? res.id : "";
    await device.settle();
    const tagsOf = async (id: string) =>
      (
        await device.query<{ tag_id: string }>(
          "SELECT tag_id FROM record_tag WHERE entry_id = ? ORDER BY tag_id",
          [id],
        )
      ).map((r) => r.tag_id);
    expect(await tagsOf(newId)).toEqual([URGENT.id, MOVE.id].sort());
    expect(await tagsOf(VISIT.id)).toEqual([URGENT.id, MOVE.id].sort());
    const eyeRows = () => rows().filter((li) => li.textContent?.includes("Eye exam"));
    await expect.poll(() => eyeRows().length).toBe(2);
    for (const li of eyeRows())
      expect([...li.querySelectorAll("[data-tag-chip]")].map((c) => c.textContent?.trim())).toEqual([
        "Care home move",
        "Urgent",
      ]);
  });
});
