import type { GroupRole } from "../../../../../test/fixtures";

import { TAG_COLORS } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, recordTag, tag, TEST_GROUP } from "../../../../../test/fixtures";
import * as entryRoute from "./route";

// Tags on the entry page (tags slice 2, quick tags in tags-2 slice 4): every
// chip under the time, for every role; for whoever may tag it, an × on each
// chip and "Add tag" opening the picker (`QuickTags`), and no Tags in ⋯. The
// chips follow live. Adding a tag in the picker gives it a color no other
// group tag has. The rows' chips and the roles in full are
// timeline/timelineTags.browser.test.tsx's.

const ROUTES = [{ path: "/app/groups/:groupId/entries/:entryId", module: entryRoute }];
const SAM = fx.person({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d02", name: "Sam Okafor", role: "caretaker" });
const VISIT = fx.event({
  title: "Knee check",
  occurredAt: at(new Date(Date.now() - 20 * 60_000)),
  text: "Fine.",
});
const SAMS = fx.note({ text: "Sam's visit notes", createdBy: SAM.id });
const URGENT = tag("Urgent");
const KNEE = tag("Knee");
const MOVE = tag("Care home move");
const world = () => [
  SAM,
  VISIT,
  SAMS,
  URGENT,
  KNEE,
  MOVE,
  recordTag(URGENT.id, VISIT.id),
  recordTag(KNEE.id, VISIT.id),
  recordTag(KNEE.id, SAMS.id),
];
const openEntry = (role: GroupRole, fixtures = world(), id = VISIT.id) =>
  renderWithDevice({
    route: ROUTES,
    url: `/app/groups/${TEST_GROUP.id}/entries/${id}`,
    fixtures,
    role,
  });

const chips = () =>
  [...document.querySelectorAll('[data-region="tags"] [data-tag-chip]')]
    .map((c) => c.textContent?.trim())
    .join(",");
const tagButtons = () =>
  [...document.querySelectorAll('[data-region="tags"] button')].map(
    (b) => b.getAttribute("aria-label") ?? b.textContent?.trim(),
  );
const MENU = () =>
  document.querySelector<HTMLButtonElement>(
    'main header [data-region="actions"] button[aria-label^="Actions for"]',
  );
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const openPicker = async () => {
  await userEvent.click(page.getByRole("button", { name: "Add tag" }));
  await found(() => document.querySelector("[data-tag-picker]"));
};
const linksOf = async (device: Awaited<ReturnType<typeof openEntry>>, entryId: string) =>
  (
    await device.query<{ name: string }>(
      "SELECT t.name FROM record_tag r JOIN tag t ON t.id = r.tag_id WHERE r.entry_id = ? ORDER BY t.name_key",
      [entryId],
    )
  ).map((r) => r.name);

describe("tags on the entry page", () => {
  test("a caretaker removes a tag with one tap on its chip and adds one through Add tag; ⋯ has no Tags", async () => {
    const device = await openEntry("caretaker");
    await expect.poll(chips).toBe("Knee,Urgent");
    expect(tagButtons()).toEqual(["Remove tag Knee", "Remove tag Urgent", "Add tag"]);

    await userEvent.click(page.getByRole("button", { name: "Remove tag Urgent" }));
    await device.settle();
    await expect.poll(chips).toBe("Knee");
    expect(await linksOf(device, VISIT.id)).toEqual(["Knee"]);
    expect((await device.queued()).some((w) => w.type === "record_tag" && w.op === "DELETE")).toBe(true);

    await openPicker();
    await userEvent.click(page.getByRole("checkbox", { name: "Care home move" }));
    await device.settle();
    await expect.poll(chips).toBe("Care home move,Knee");
    expect(document.querySelector('[data-region="tags"] [data-tag-more]')).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Done", exact: true }));

    await userEvent.click(await found(MENU));
    await waitUntil(() => menuItems().length > 0, "the menu");
    expect(menuItems()).not.toContain("Tags");
  });

  test("adding a tag in the picker writes the one color no other group tag has", async () => {
    // Nine of the ten palette colors taken, so the pick has one answer.
    const [free, ...taken] = TAG_COLORS;
    const colored = taken.map((color, i) => tag(`Colored ${i + 1}`, { color }));
    const device = await openEntry("owner", [...world(), ...colored]);
    await openPicker();
    await userEvent.fill(page.getByRole("searchbox", { name: "Find or add a tag" }), "Lab results");
    await userEvent.click(page.getByRole("button", { name: "Add “Lab results”" }));
    await device.settle();
    await expect.poll(chips).toBe("Knee,Lab results,Urgent");
    const [added] = await device.query<{ color: string | null }>(
      "SELECT color FROM tag WHERE group_id = ? AND name = ?",
      [TEST_GROUP.id, "Lab results"],
    );
    expect(added?.color).toBe(free);
  });

  test("a chip carries its tag's color; a tag with no color is the neutral chip", async () => {
    const [color] = TAG_COLORS;
    const painted = tag("Knee", { color });
    await openEntry("viewer", [
      VISIT,
      URGENT,
      painted,
      recordTag(URGENT.id, VISIT.id),
      recordTag(KNEE.id, VISIT.id),
    ]);
    await expect.poll(chips).toBe("Knee,Urgent");
    const chip = (id: string) =>
      document.querySelector<HTMLElement>(`[data-region="tags"] [data-tag-chip="${id}"]`)!;
    expect(chip(KNEE.id).classList).toContain(`bg-avatar-${color}`);
    expect(chip(KNEE.id).dataset.tagColor).toBe(color);
    expect(chip(URGENT.id).className).not.toMatch(/bg-avatar-/);
    expect(chip(URGENT.id).classList).toContain("badge-neutral");
    expect(chip(URGENT.id).dataset.tagColor).toBeUndefined();
  });

  test("a viewer sees the chips and no buttons, and ⋯ has no Tags", async () => {
    await openEntry("viewer");
    await expect.poll(chips).toBe("Knee,Urgent");
    expect(tagButtons()).toEqual([]);
    await userEvent.click(await found(MENU));
    await waitUntil(() => menuItems().length > 0, "the menu");
    expect(menuItems()).toEqual(["Print"]);
  });

  test("an Easy helper gets the buttons on their own entry only", async () => {
    const own = await openEntry("easy_helper");
    await expect.poll(chips).toBe("Knee,Urgent");
    expect(tagButtons()).toEqual(["Remove tag Knee", "Remove tag Urgent", "Add tag"]);
    await userEvent.click(page.getByRole("button", { name: "Remove tag Knee" }));
    await own.settle();
    await expect.poll(chips).toBe("Urgent");
    await own.screen.unmount();

    await openEntry("easy_helper", world(), SAMS.id);
    await expect.poll(chips).toBe("Knee");
    expect(tagButtons()).toEqual([]);
  });
});
