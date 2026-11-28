import { recordTagId } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { at, fx, recordTag, tag, TEST_GROUP } from "../../../test/fixtures";
import { found, waitUntil } from "../../../test/found";
import * as entryRoute from "../../routes/app/groups/entry/route";
import { openOf, openTimeline, rowWith } from "../../routes/app/groups/timeline/timelineWorld";

// A row's quick tags sit above its stretched open target (`QuickTags`,
// `relative z-10`) but only as wide as the chips and "Add tag": a tap on the
// rest of the tag line opens the entry, as anywhere else on the row (B-970:
// the full-width line swallowed the tap, and layout-offline's tap on the
// row's middle never opened its edit sheet).
// The one control everywhere (tags-3 slice 1): Add tag is an icon alone
// (lucide TagPlus) on rows, pages and sheets; a remove untags at once and
// says "Removed <name>" with Undo, which puts the same one link back; whoever
// can't tag sees the chips alone.

const NOTE = fx.note({ occurredAt: at(new Date(Date.now() - 5 * 60_000)), text: "Walked to the mailbox" });
const URGENT = tag("Urgent");
// Long enough that a 420px header wraps them onto a second line.
const MOVE = tag("Care home move planning");
const PAPERWORK = tag("Insurance paperwork");

const ENTRY_ROUTES = [{ path: "/app/groups/:groupId/entries/:entryId", module: entryRoute }];
const LINK = recordTag(URGENT.id, NOTE.id);
const world = () => [NOTE, URGENT, LINK];
const rowChips = () =>
  [...(rowWith("Walked to the mailbox")?.querySelectorAll("[data-tag-chip]") ?? [])]
    .map((c) => c.textContent?.trim())
    .join(",");
/** Add tag is the icon alone: no text, its name and tooltip "Add tag", the tag-with-a-plus icon. */
const expectIconOnlyAdd = (add: HTMLElement) => {
  expect(add.getAttribute("aria-label")).toBe("Add tag");
  expect(add.getAttribute("title")).toBe("Add tag");
  expect(add.textContent?.trim()).toBe("");
  expect(add.querySelector("svg.lucide-tag-plus")).not.toBeNull();
};

/** The add-tag button's vertical centre less each chip's, in px (B-1021: both on one centre line). */
const centreOffsets = (control: HTMLElement) => {
  const mid = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  const add = control.querySelector("[data-quick-tag-add]")!;
  const chips = [...control.querySelectorAll("[data-tag-chip], [data-tag-more]")];
  expect(chips.length).toBeGreaterThan(0);
  return chips.map((c) => Math.abs(mid(add) - mid(c)));
};

const quickTagsOf = (text: string) => rowWith(text)?.querySelector<HTMLElement>("[data-quick-tags]") ?? null;

describe("a row's quick tags", () => {
  test("a tap beside the chips on the tag line opens the entry; Add tag stays on top", async () => {
    await openTimeline({ role: "owner", fixtures: world() });
    const line = await found(() => quickTagsOf("Walked to the mailbox"));
    const li = rowWith("Walked to the mailbox")!;
    const box = line.getBoundingClientRect();
    const row = li.getBoundingClientRect();
    // The line ends with its controls, well short of the row's right column.
    const aside = li.querySelector("[data-entry-aside]")!.getBoundingClientRect();
    expect(aside.left - box.right).toBeGreaterThan(40);

    // What's on top between the two, at the tag line's height: the row's open target.
    const x = (box.right + aside.left) / 2;
    const y = box.top + box.height / 2;
    expect(document.elementFromPoint(x, y)).toBe(openOf(li));

    // Add tag is still its own control, above the target.
    const add = line.querySelector<HTMLElement>("[data-quick-tag-add]")!;
    const a = add.getBoundingClientRect();
    expect(add.contains(document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2))).toBe(true);

    // A real tap there (actionability-checked, not forced) opens the entry.
    await userEvent.click(li, { position: { x: x - row.left, y: y - row.top } });
    await waitUntil(
      () => document.querySelector("h1")?.textContent === `Entry page ${NOTE.id}`,
      "the entry page",
    );
  });
});

describe("Add tag lines up with the chips (B-1021)", () => {
  test("its centre is the chips' centre on a row and in a record's header", async () => {
    const device = await openTimeline({ role: "owner", fixtures: world() });
    const row = await found(() => quickTagsOf("Walked to the mailbox"));
    for (const off of centreOffsets(row)) expect(off).toBeLessThanOrEqual(1);
    await device.screen.unmount();

    await renderWithDevice({
      route: ENTRY_ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`,
      fixtures: world(),
      role: "owner",
    });
    const header = await found(() =>
      document.querySelector<HTMLElement>('[data-region="tags"] [data-quick-tags]:has([data-tag-chip])'),
    );
    for (const off of centreOffsets(header)) expect(off).toBeLessThanOrEqual(1);
  });

  test("when the chips wrap, it sits beside the last chip, not on a line of its own", async () => {
    await renderWithDevice({
      route: ENTRY_ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`,
      fixtures: [...world(), MOVE, PAPERWORK, recordTag(MOVE.id, NOTE.id), recordTag(PAPERWORK.id, NOTE.id)],
      role: "owner",
    });
    const header = await found(() => {
      const control = document.querySelector<HTMLElement>('[data-region="tags"] [data-quick-tags]');
      return control?.querySelectorAll("[data-tag-chip]").length === 3 ? control : null;
    });
    const tops = new Set(
      [...header.querySelectorAll("[data-tag-chip]")].map((c) => c.getBoundingClientRect().top),
    );
    expect(tops.size).toBeGreaterThan(1);
    expect(centreOffsets(header).at(-1)).toBeLessThanOrEqual(1);
  });
});

describe("the one tag control", () => {
  test("Add tag is an icon-only button on a row and on a record's page", async () => {
    const device = await openTimeline({ role: "owner", fixtures: world() });
    expectIconOnlyAdd(
      await found(() =>
        quickTagsOf("Walked to the mailbox")?.querySelector<HTMLElement>("[data-quick-tag-add]"),
      ),
    );
    await device.screen.unmount();

    await renderWithDevice({
      route: ENTRY_ROUTES,
      url: `/app/groups/${TEST_GROUP.id}/entries/${NOTE.id}`,
      fixtures: world(),
      role: "owner",
    });
    expectIconOnlyAdd(
      await found(() => document.querySelector<HTMLElement>('[data-region="tags"] [data-quick-tag-add]')),
    );
  });

  test("a remove untags at once, says so, and Undo puts back the same one link", async () => {
    const device = await openTimeline({ role: "owner", fixtures: world() });
    await expect.poll(rowChips).toBe("Urgent");
    await userEvent.click(page.getByRole("button", { name: "Remove tag Urgent" }));
    await device.settle();
    await expect.poll(rowChips).toBe("");
    expect(await device.query("SELECT id FROM record_tag WHERE entry_id = ?", [NOTE.id])).toEqual([]);

    const toast = page.getByRole("alertdialog", { name: "Removed Urgent" });
    await expect.element(toast).toBeVisible();
    await userEvent.click(toast.getByRole("button", { name: "Undo" }));
    await device.settle();
    await expect.poll(rowChips).toBe("Urgent");
    expect(await device.query("SELECT id FROM record_tag WHERE entry_id = ?", [NOTE.id])).toEqual([
      { id: recordTagId(URGENT.id, NOTE.id) },
    ]);
    // The row was never opened.
    expect(document.querySelector("h1")?.textContent).not.toBe(`Entry page ${NOTE.id}`);
  });

  test("a viewer sees the chips with no × and no Add tag", async () => {
    await openTimeline({ role: "viewer", fixtures: world() });
    await expect.poll(rowChips).toBe("Urgent");
    const li = rowWith("Walked to the mailbox")!;
    expect(li.querySelector("[data-tag-remove], [data-quick-tag-add], [data-tag-more-open]")).toBeNull();
  });
});
