import type { DeviceRoute } from "../../../../../test/device";

import { TAG_COLORS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import * as searchRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { condition, fx, hoursAgo, recordTag, tag, TEST_GROUP, todo } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { tagRecord } from "~/lib/tags/tags.sync";

// The search page's tag filter (tags slice 6): `?tag=` narrows every
// section to the items carrying the tag; with no text it lists each type's
// tagged live items (entries newest first, the rest A to Z), conditions
// left out (they can't carry one). Soft-deleted items never show. The
// device is offline throughout. The URLs are urls.test.ts's. Tags-3: the
// tags are colored filter chips, one on at a time; text naming a tag finds
// what carries it (as a title match, with the tag's chip on the result),
// exclusions still applied.

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/search", module: searchRoute }];
const BASE = `/app/groups/${TEST_GROUP.id}/search`;

const URGENT = tag("Urgent");
const KNEE = tag("Knee");
const LARK = fx.provider({ name: "Dr. Mira Lark", specialty: "Knee surgeon" });
const BRANDT = fx.provider({ name: "Dr. Ivo Brandt", specialty: "Knee clinic" });
const GONE_PROVIDER = fx.provider({ name: "Dr. Gone Knee", deletedAt: hoursAgo(1) });
const IBUPROFEN = fx.medication({ name: "Ibuprofen", reason: "Knee pain" });
const METFORMIN = fx.medication({ name: "Metformin" });
const FORM = todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e01", title: "Book the knee scan" });
const GONE_TODO = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e02",
  title: "Old knee form",
  deletedAt: hoursAgo(1),
});
const OLD_NOTE = fx.note({ occurredAt: hoursAgo(5), text: "Knee felt stiff this morning" });
const NEW_NOTE = fx.note({ occurredAt: hoursAgo(2), text: "Knee better after the walk" });
const UNTAGGED_NOTE = fx.note({ occurredAt: hoursAgo(3), text: "Knee was fine at lunch" });
const GONE_NOTE = fx.note({ occurredAt: hoursAgo(4), text: "Knee note removed", deletedAt: hoursAgo(1) });
const KNEE_CONDITION = condition({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e09", name: "Knee arthritis" });
const BP = tag("Blood pressure", { color: TAG_COLORS[2] });
const LUNCH_NOTE = fx.note({ occurredAt: hoursAgo(6), text: "Felt fine after lunch" });
const GARDEN_NOTE = fx.note({ occurredAt: hoursAgo(7), text: "Sat in the garden for an hour" });
const BP_TODO = todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e03", title: "Order a new cuff" });

const world = () => [
  URGENT,
  KNEE,
  LARK,
  BRANDT,
  GONE_PROVIDER,
  IBUPROFEN,
  METFORMIN,
  FORM,
  GONE_TODO,
  OLD_NOTE,
  NEW_NOTE,
  UNTAGGED_NOTE,
  GONE_NOTE,
  KNEE_CONDITION,
  BP,
  LUNCH_NOTE,
  GARDEN_NOTE,
  BP_TODO,
  recordTag(BP.id, LUNCH_NOTE.id),
  recordTag(BP.id, GARDEN_NOTE.id),
  recordTag(BP.id, BP_TODO.id, "todoId"),
  recordTag(URGENT.id, LARK.id, "providerId"),
  recordTag(URGENT.id, BRANDT.id, "providerId"),
  recordTag(URGENT.id, GONE_PROVIDER.id, "providerId"),
  recordTag(URGENT.id, IBUPROFEN.id, "medicationId"),
  recordTag(URGENT.id, FORM.id, "todoId"),
  recordTag(URGENT.id, GONE_TODO.id, "todoId"),
  recordTag(URGENT.id, OLD_NOTE.id),
  recordTag(URGENT.id, NEW_NOTE.id),
  recordTag(URGENT.id, GONE_NOTE.id),
  recordTag(KNEE.id, METFORMIN.id, "medicationId"),
];

const open = (query: string) =>
  renderWithDevice({ route: ROUTES, url: `${BASE}${query}`, fixtures: world(), search: true });

const results = () =>
  [...document.querySelectorAll<HTMLElement>("[data-result]")].map(
    (r) => `${r.dataset.result}:${r.dataset.resultId}`,
  );
const statusLine = () => document.querySelector("[data-search-status]")?.textContent ?? "";
const tagChips = () =>
  [...document.querySelectorAll<HTMLAnchorElement>("[data-search-tags] nav a")].map((a) => a.textContent);
const tagChip = (name: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>("[data-search-tags] nav a")].find(
    (a) => a.textContent === name,
  );
const currentTag = () =>
  document.querySelector("[data-search-tags] nav a[aria-current='true']")?.textContent ?? null;
const resultChips = (id: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-result-id="${id}"] [data-tag-chip]`)].map(
    (c) => c.dataset.tagChip,
  );
const timelineLink = () => document.querySelector<HTMLAnchorElement>("[data-see-timeline]");

describe("search: the tag filter", () => {
  test("a tag with no text lists each type's tagged live items, entries newest first, no conditions", async () => {
    await open(`?tag=${URGENT.id}`);
    await expect
      .poll(results)
      .toEqual([
        `provider:${BRANDT.id}`,
        `provider:${LARK.id}`,
        `medication:${IBUPROFEN.id}`,
        `todo:${FORM.id}`,
        `entry:${NEW_NOTE.id}`,
        `entry:${OLD_NOTE.id}`,
      ]);
    expect(statusLine()).toBe("2 providers, 1 medication, 1 todo and 2 entries");
    expect(currentTag()).toBe("Urgent");
    // No recent searches while a tag lists; the timeline link carries the tag.
    expect(document.body.textContent).not.toContain("Recent searches");
    expect(timelineLink()?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/timeline?tag=${URGENT.id}`,
    );
  });

  test("a tag with text narrows every section to its matches; the conditions section goes", async () => {
    const device = await open("?q=knee");
    await expect.poll(results).toContain(`condition:${KNEE_CONDITION.id}`);
    expect(results()).toContain(`entry:${UNTAGGED_NOTE.id}`);
    await device.screen.unmount();

    await open(`?q=knee&tag=${URGENT.id}`);
    // Within a section, the index's order (rank) holds: compare as sets.
    await expect
      .poll(() => results().sort())
      .toEqual(
        [
          `provider:${BRANDT.id}`,
          `provider:${LARK.id}`,
          `medication:${IBUPROFEN.id}`,
          `todo:${FORM.id}`,
          `entry:${NEW_NOTE.id}`,
          `entry:${OLD_NOTE.id}`,
        ].sort(),
      );
    expect(timelineLink()?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/timeline?q=knee&tag=${URGENT.id}`,
    );
  });

  test("a tag nothing matching carries says so, naming it", async () => {
    await open(`?q=walk&tag=${KNEE.id}`);
    await expect.poll(statusLine).toBe("No matches for “walk” tagged “Knee”");
    expect(results()).toEqual([]);
  });

  test("the tags are colored chips: a tap filters, a second tap clears, keeping the text; an unknown tag is no filter", async () => {
    const device = await open("?q=metformin");
    await expect.poll(results).toEqual([`medication:${METFORMIN.id}`]);
    await found(() => tagChip("Urgent"));
    expect(tagChips()).toEqual(["Blood pressure", "Knee", "Urgent"]);
    expect(currentTag()).toBeNull();
    // Each chip shows its tag's color (none: an empty ring).
    expect(
      tagChip("Blood pressure")?.querySelector("[data-tag-swatch]")?.getAttribute("data-tag-swatch"),
    ).toBe(TAG_COLORS[2]);
    // A dozen tags or fewer: no filter box.
    expect(document.querySelector("[data-search-tag-filter]")).toBeNull();

    await userEvent.click(await found(() => tagChip("Urgent")));
    await expect.poll(() => device.location()).toBe(`${BASE}?q=metformin&tag=${URGENT.id}`);
    await expect.poll(statusLine).toBe("No matches for “metformin” tagged “Urgent”");
    expect(currentTag()).toBe("Urgent");

    // One on at a time: another tap moves it.
    await userEvent.click(await found(() => tagChip("Knee")));
    await expect.poll(() => device.location()).toBe(`${BASE}?q=metformin&tag=${KNEE.id}`);
    await expect.poll(results).toEqual([`medication:${METFORMIN.id}`]);
    expect(currentTag()).toBe("Knee");

    await userEvent.click(await found(() => tagChip("Knee")));
    await expect.poll(() => device.location()).toBe(`${BASE}?q=metformin`);
    await expect.poll(currentTag).toBeNull();
    await expect.poll(results).toEqual([`medication:${METFORMIN.id}`]);
    await device.screen.unmount();

    await open("?q=metformin&tag=6d1f0b2a-3c4e-4f5a-8b9c-0d1e2f3a4b5c");
    await expect.poll(results).toEqual([`medication:${METFORMIN.id}`]);
    expect(currentTag()).toBeNull();
  });

  test("past a dozen tags a filter box narrows the chips, keeping the one that's on", async () => {
    const more = Array.from({ length: 11 }, (_, i) => tag(`Extra ${String(i + 1).padStart(2, "0")}`));
    await renderWithDevice({
      route: ROUTES,
      url: `${BASE}?tag=${URGENT.id}`,
      fixtures: [...world(), ...more],
      search: true,
    });
    const filter = await found(() => document.querySelector<HTMLInputElement>("[data-search-tag-filter]"));
    expect(tagChips()).toHaveLength(14);
    await userEvent.type(filter, "pres");
    await expect.poll(tagChips).toEqual(["Blood pressure", "Urgent"]);
    await userEvent.clear(filter);
    await userEvent.type(filter, "zzz");
    await expect.poll(tagChips).toEqual(["Urgent"]);
  });

  test("typing a tag's name finds what carries it, as title matches, with the tag's chip", async () => {
    const device = await open("");
    const field = await found(() => document.querySelector<HTMLInputElement>("[data-search-field]"));
    await userEvent.type(field, "blood");
    await expect.poll(() => device.location()).toBe(`${BASE}?q=blood`);
    // Neither note's text says "blood"; the todo's title doesn't either.
    await expect
      .poll(() => results().sort())
      .toEqual([`todo:${BP_TODO.id}`, `entry:${LUNCH_NOTE.id}`, `entry:${GARDEN_NOTE.id}`].sort());
    expect(resultChips(LUNCH_NOTE.id)).toEqual([BP.id]);
    expect(resultChips(BP_TODO.id)).toEqual([BP.id]);
    // Words in any order, each a prefix of a word in the name.
    await userEvent.clear(field);
    await userEvent.type(field, "pressure blo");
    await expect.poll(() => results().sort()).toContain(`entry:${GARDEN_NOTE.id}`);
    await userEvent.clear(field);
    await userEvent.type(field, "bloods");
    await expect.poll(statusLine).toBe("No matches for “bloods”");
    expect(results()).toEqual([]);
  });

  test("-word still drops a tag-matched item containing it", async () => {
    await open("?q=blood%20-lunch");
    await expect.poll(results).toContain(`entry:${GARDEN_NOTE.id}`);
    expect(results()).not.toContain(`entry:${LUNCH_NOTE.id}`);
    expect(results()).toContain(`todo:${BP_TODO.id}`);
  });

  test("a tag put on here shows in the list at once", async () => {
    const device = await open(`?tag=${KNEE.id}`);
    await expect.poll(results).toEqual([`medication:${METFORMIN.id}`]);
    expect(await tagRecord(device.db, KNEE.id, "entry", UNTAGGED_NOTE.id)).toEqual({ ok: true });
    await device.settle();
    await expect.poll(results).toEqual([`medication:${METFORMIN.id}`, `entry:${UNTAGGED_NOTE.id}`]);
  });
});
