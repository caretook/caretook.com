import { describe, expect, test } from "vitest";
import { waitUntil } from "../../../../../test/found";
import { openTimeline, rowOf, rows, setView, view } from "./timelineWorld";

// One entry display, two looks (B-1015): the timeline's Full and Condensed
// views both draw `TimelineEntryRow`, with the time beside the entry's first
// line (the text gets the width) and the author as their avatar under the ⋯
// menu. Full spaces the entries apart, Condensed sits them close: told by
// `data-look` and the list's classes, never pixels.

const ready = () => waitUntil(() => rows().length > 0, "rows");
const looks = () => new Set(rows().map((li) => li.dataset.look));

/** The time sits in the body, on its first line, not in a column of its own or the right column. */
const expectTimeBesideText = (li: HTMLElement) => {
  const time = li.querySelector("time")!;
  expect(time.parentElement).not.toBe(li);
  expect(time.closest("[data-entry-aside]")).toBeNull();
  const firstLine = time.closest("div.flex")!;
  expect(firstLine.firstElementChild?.textContent?.trim()).not.toBe("");
  expect(firstLine.contains(time)).toBe(true);
};

/** The author is their avatar in the right column, a filter link with no name written out. */
const expectAuthorAvatar = (li: HTMLElement) => {
  const author = li.querySelector<HTMLAnchorElement>("a[data-author]")!;
  expect(author.closest("[data-entry-aside]")).not.toBeNull();
  expect(author.getAttribute("aria-label")).toMatch(/^Show only .+'s entries$/);
  expect(author.querySelector('[aria-hidden="true"]')).not.toBeNull();
  expect(li.querySelectorAll("a[data-author]").length).toBe(1);
};

describe("the two looks", () => {
  test("both put the time beside the first line and the author as the avatar", async () => {
    await openTimeline();
    await ready();
    for (const look of ["condensed", "full"] as const) {
      if (look === "full") await setView("Full");
      await waitUntil(() => looks().has(look) && looks().size === 1, `the ${look} look`);
      for (const kind of ["Note", "Event", "Symptom"]) {
        const li = rowOf(kind)!;
        expectTimeBesideText(li);
        expectAuthorAvatar(li);
      }
    }
  });

  test("Full spaces its entries further apart than Condensed", async () => {
    await openTimeline();
    await ready();
    const list = () => document.querySelector<HTMLElement>("ol[data-view]")!;
    const note = () => rowOf("Note")!;
    expect(note().dataset.look).toBe("condensed");
    expect(note().className).toMatch(/\bpy-2\b/);
    expect(list().className).toMatch(/\bdivide-y\b/);

    await setView("Full");
    await waitUntil(() => note().dataset.look === "full", "the full look");
    expect(note().className).toMatch(/\bp-3\b/);
    expect(list().className).toMatch(/\bspace-y-2\b/);
    expect(list().className).not.toMatch(/\bdivide-y\b/);
  });

  test("switching the view switches the look on the same display; the old card is gone", async () => {
    await openTimeline();
    await ready();
    const count = rows().length;
    const shape = (li: HTMLElement) => ({
      aside: !!li.querySelector("[data-entry-aside] a[data-author]"),
      menu: !!li.querySelector('[data-entry-aside] button[aria-label^="Actions"]'),
    });
    const before = shape(rowOf("Note")!);
    await setView("Full");
    await waitUntil(() => view() === "cards" && looks().has("full"), "cards");
    expect(rows().length).toBe(count);
    expect(looks()).toEqual(new Set(["full"]));
    expect(shape(rowOf("Note")!)).toEqual(before);

    await setView("Condensed");
    await waitUntil(() => view() === "rows" && looks().has("condensed"), "rows");
    expect(looks()).toEqual(new Set(["condensed"]));

    expect(Object.keys(import.meta.glob("./TimelineEntryCard.tsx"))).toEqual([]);
  });
});
