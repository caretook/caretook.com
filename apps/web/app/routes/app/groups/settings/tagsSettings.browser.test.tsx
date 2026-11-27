import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsIndex from "./index/route";
import * as settingsLayout from "./layout/route";
import * as tagsPage from "./tags/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, recordTag, tag, TEST_GROUP, todo } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";

// The Tags page in group settings (tags-3 slice 2): the group's tags A to
// Z, each a chip in its color with a live count of the live records carrying
// it (one counts query); rename and recolor for whoever `canRenameTag`
// allows, Delete for owners after the count confirm; a viewer sees the list
// only. The rules are tagRules.test.ts's; the picker's own rename and delete
// are timelineTagEdit.browser.test.tsx's.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: settingsLayout,
    children: [
      { path: BASE, id: "group-settings-index", module: settingsIndex },
      { path: `${BASE}/tags`, module: tagsPage },
    ],
  },
];
const SETTINGS = `/app/groups/${TEST_GROUP.id}/settings`;
const TAGS = `${SETTINGS}/tags`;

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const NOTE_AT = minutesAgo(5);
const NOTE = fx.note({ occurredAt: NOTE_AT, text: "Walked to the mailbox" });
const SYMPTOM = fx.symptom({ occurredAt: minutesAgo(10), name: "Sore knee", severity: 3 });
const GONE = fx.note({ occurredAt: minutesAgo(30), text: "Deleted note", deletedAt: minutesAgo(1) });
const CALL = todo({ title: "Call the pharmacy" });
const URGENT = tag("Urgent", { color: "coral" });
const KNEE = tag("Knee", { color: "jade" });
const BILLS = tag("Bills", { color: null });
const fixtures = [
  NOTE,
  SYMPTOM,
  GONE,
  CALL,
  URGENT,
  KNEE,
  BILLS,
  recordTag(URGENT.id, NOTE.id),
  recordTag(URGENT.id, SYMPTOM.id),
  recordTag(URGENT.id, CALL.id, "todoId"),
  // A soft-deleted record keeps its link but isn't counted.
  recordTag(URGENT.id, GONE.id),
  recordTag(KNEE.id, NOTE.id),
];

const open = (role: GroupRole = "owner", url = TAGS) =>
  renderWithDevice({ route: ROUTES, url, role, fixtures });

const LIST = () => document.querySelector<HTMLElement>("main [data-tag-list]");
const rowOf = (id: string) => LIST()?.querySelector<HTMLElement>(`[data-tag-row="${id}"]`) ?? null;
const listed = () =>
  [...(LIST()?.querySelectorAll("[data-tag-row]") ?? [])].map((r) =>
    [
      r.querySelector("[data-tag-chip]")?.textContent?.trim(),
      r.querySelector("[data-tag-chip]")?.getAttribute("data-tag-color") ?? "-",
      r.querySelector("[data-tag-uses]")?.textContent?.trim(),
    ].join(" "),
  );
const buttonsIn = (el: Element | null) => el?.querySelectorAll("button").length ?? 0;
const DIALOG = () => document.querySelector<HTMLDialogElement>("dialog[open]");

describe("the Tags page", () => {
  test('the settings list shows "Tags", and it opens the page', async () => {
    const device = await open("owner", SETTINGS);
    const item = await found(() => document.querySelector<HTMLElement>('[data-settings-item="tags"]'));
    expect(item.textContent).toContain("Tags");
    await userEvent.click(item);
    await expect.poll(device.location).toBe(TAGS);
    await expect.element(page.getByRole("heading", { level: 1, name: "Tags" })).toBeVisible();
  });

  test("lists the group's tags A to Z, each in its color with a live count of live records", async () => {
    const device = await open("owner");
    await found(LIST);
    expect(listed()).toEqual(["Bills - 0 items", "Knee jade 1 item", "Urgent coral 3 items"]);

    // Another device tags a record and deletes one: the counts follow.
    await device.sync([recordTag(BILLS.id, CALL.id, "todoId")]);
    await device.settle();
    await expect.poll(listed).toEqual(["Bills - 1 item", "Knee jade 1 item", "Urgent coral 3 items"]);
    await device.sync(fx.note({ id: NOTE.id, occurredAt: NOTE_AT, deletedAt: minutesAgo(0) }));
    await device.settle();
    await expect.poll(listed).toEqual(["Bills - 1 item", "Knee jade 0 items", "Urgent coral 2 items"]);
  });

  test("a caretaker renames one and recolors one; no Delete", async () => {
    const device = await open("caretaker");
    await found(LIST);
    expect(rowOf(URGENT.id)?.querySelector("[data-tag-delete]")).toBeNull();

    await userEvent.click(page.getByRole("button", { name: "Rename Urgent" }));
    const input = page.getByRole("textbox", { name: "Rename “Urgent”" });
    await userEvent.clear(input);
    await userEvent.type(input, "Today");
    await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
    await device.settle();
    await expect.poll(listed).toEqual(["Bills - 0 items", "Knee jade 1 item", "Today coral 3 items"]);

    await userEvent.click(page.getByRole("button", { name: "Color of Knee" }));
    const colors = page.getByRole("radiogroup", { name: "Color of “Knee”" });
    await expect.element(colors.getByRole("radio", { name: "Jade" })).toBeChecked();
    // The radio is visually hidden and its swatch sits over it: a tap lands on the swatch.
    await userEvent.click(colors.getByRole("radio", { name: "Sky" }), { force: true });
    await device.settle();
    await expect.poll(listed).toEqual(["Bills - 0 items", "Knee sky 1 item", "Today coral 3 items"]);
    expect(await device.query("SELECT color FROM tag WHERE id = ?", [KNEE.id])).toEqual([{ color: "sky" }]);
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.poll(() => document.querySelector('[role="radiogroup"]')).toBeNull();
  });

  test("an owner deletes one after the confirm names its count; the records stay", async () => {
    const device = await open("owner");
    await found(LIST);

    await userEvent.click(page.getByRole("button", { name: "Delete Urgent" }));
    await found(DIALOG);
    expect(DIALOG()?.textContent).toContain("Delete the tag “Urgent”?");
    expect(DIALOG()?.textContent).toContain("It comes off 3 records");
    await userEvent.click(page.getByRole("button", { name: "Cancel", exact: true }).last());
    await expect.poll(DIALOG).toBeNull();
    expect(listed()).toHaveLength(3);

    await userEvent.click(page.getByRole("button", { name: "Delete Urgent" }));
    await found(DIALOG);
    await userEvent.click(page.getByRole("button", { name: "Delete tag" }));
    await device.settle();
    await expect.poll(DIALOG).toBeNull();
    await expect.poll(listed).toEqual(["Bills - 0 items", "Knee jade 1 item"]);
    expect(await device.query("SELECT id FROM record_tag WHERE tag_id = ?", [URGENT.id])).toEqual([]);
    expect(await device.query("SELECT id FROM timeline_entry WHERE deleted_at IS NULL")).toHaveLength(2);
  });

  test("a viewer sees the list with no actions", async () => {
    await open("viewer");
    await found(LIST);
    expect(listed()).toEqual(["Bills - 0 items", "Knee jade 1 item", "Urgent coral 3 items"]);
    expect(buttonsIn(LIST())).toBe(0);
  });

  test("a group with no tags says so", async () => {
    await renderWithDevice({ route: ROUTES, url: TAGS, role: "owner", fixtures: [NOTE] });
    await found(() => document.querySelector("[data-tags-empty]"));
    expect(LIST()).toBeNull();
  });
});
