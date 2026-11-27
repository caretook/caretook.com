import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, recordTag, tag } from "../../../test/fixtures";
import { found, waitUntil } from "../../../test/found";
import { openOf, openTimeline, rowWith } from "../../routes/app/groups/timeline/timelineWorld";

// A row's quick tags sit above its stretched open target (`QuickTags`,
// `relative z-10`) but only as wide as the chips and "Add tag": a tap on the
// rest of the tag line opens the entry, as anywhere else on the row (B-970:
// the full-width line swallowed the tap, and layout-offline's tap on the
// row's middle never opened its edit sheet).

const NOTE = fx.note({ occurredAt: at(new Date(Date.now() - 5 * 60_000)), text: "Walked to the mailbox" });
const URGENT = tag("Urgent");

const quickTagsOf = (text: string) => rowWith(text)?.querySelector<HTMLElement>("[data-quick-tags]") ?? null;

describe("a row's quick tags", () => {
  test("a tap beside the chips on the tag line opens the entry; Add tag stays on top", async () => {
    await openTimeline({ role: "owner", fixtures: [NOTE, URGENT, recordTag(URGENT.id, NOTE.id)] });
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
