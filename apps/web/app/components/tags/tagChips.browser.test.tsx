import { TagPlus } from "lucide-react";
import { describe, expect, test } from "vitest";
import { renderInRouter } from "../../../test/device";
import { found, waitUntil } from "../../../test/found";
import { Button } from "../ui";
import { TagChips } from "./TagChips";

// Add tag is the chips' list's last item. On the chips' line it keeps a wider
// gap from the last one (10px: the chips' 4px gap and that item's 6px right
// padding) and their centre line (B-1021); wrapped to a line of its own, it
// starts flush with the chips' left edge (B-1023: its 6px left margin went
// with it, as in a ~238px medication row or a ~246px provider header).

const TAGS = [
  { id: "t1", name: "Pharmacy", color: "teal" },
  { id: "t2", name: "Refill", color: null },
  { id: "t3", name: "Morning", color: "amber" },
];

const box = (el: Element) => el.getBoundingClientRect();
const mid = (el: Element) => box(el).top + box(el).height / 2;

const renderChips = async () => {
  await renderInRouter(
    <div data-testid="column" style={{ width: 400 }}>
      <TagChips
        tags={TAGS}
        max={2}
        onRemove={() => undefined}
        onMore={() => undefined}
        add={
          <Button
            variant="ghost"
            size="xs"
            icon={TagPlus}
            label="Add tag"
            onClick={() => undefined}
            data-quick-tag-add=""
          />
        }
      />
    </div>,
  );
  const list = await found(() => document.querySelector<HTMLElement>("[data-tag-chips]"));
  return {
    column: document.querySelector<HTMLElement>('[data-testid="column"]'),
    list,
    add: list.querySelector<HTMLElement>("[data-quick-tag-add]"),
    chips: [...list.querySelectorAll("[data-tag-chip], [data-tag-more]")],
  };
};

describe("Add tag in the chips' wrap (B-1021, B-1023)", () => {
  test("on the chips' line it keeps its gap from the last chip and their centre line", async () => {
    const { add, chips } = await renderChips();
    expect(add).not.toBeNull();
    expect(chips).toHaveLength(3);
    const more = chips.at(-1);
    expect(more?.hasAttribute("data-tag-more")).toBe(true);
    if (!add || !more) return;

    expect(box(add).top).toBeLessThan(box(more).bottom);
    expect(Math.abs(box(add).left - box(more).right - 10)).toBeLessThanOrEqual(1);
    for (const chip of chips) expect(Math.abs(mid(add) - mid(chip))).toBeLessThanOrEqual(1);
  });

  test("wrapped to a line of its own, it starts flush with the first chip", async () => {
    const { column, list, add, chips } = await renderChips();
    const more = list.querySelector("[data-tag-more]")?.closest("li");
    const first = chips[0];
    expect(column && add && more && first).toBeTruthy();
    if (!column || !add || !more || !first) return;

    // Just room for the two chips and "+1" (with its padding), not Add tag.
    const width = Math.ceil(box(more).right - box(list).left) + 2;
    column.style.width = `${width}px`;
    await waitUntil(() => box(add).top >= box(more).bottom, "Add tag on a line of its own");

    // The chips stay on the first line together.
    expect(new Set(chips.map((c) => Math.round(box(c).top))).size).toBe(1);
    expect(Math.abs(box(add).left - box(first).left)).toBeLessThanOrEqual(1);
  });
});
