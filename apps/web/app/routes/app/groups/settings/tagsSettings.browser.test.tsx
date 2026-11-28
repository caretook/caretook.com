import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsIndex from "./index/route";
import * as settingsLayout from "./layout/route";
import * as tagsPage from "./tags/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, recordTag, tag, TEST_GROUP, TEST_USER, todo } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { QuickTags } from "~/components/tags";
import { mergeTags } from "~/lib/tags/tags.sync";

// The Tags page in group settings (tags-3 slice 2): the group's tags A to
// Z, each a chip in its color with a live count of the live records carrying
// it (one counts query); rename and recolor for whoever `canRenameTag`
// allows, Delete for owners after the count confirm; a viewer sees the list
// only. Merge (slice 4), owners only: the other tags in a select, a confirm
// naming both and the count, then every record carrying it has the other
// tag once. The rules are tagRules.test.ts's; the picker's own rename and delete
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
// The Tags page with a note's own tag control beside it: its chips and its
// picker on the same device, for what a merge changes on records.
const TagsWithNote = (props: Parameters<typeof tagsPage.default>[0]) => (
  <>
    <tagsPage.default {...props} />
    <div data-note-tags="">
      <QuickTags target="entry" recordId={NOTE_ID} label="the note" createdBy={TEST_USER.id} max={null} />
    </div>
  </>
);
const WITH_NOTE: DeviceRoute[] = [
  {
    path: BASE,
    module: settingsLayout,
    children: [{ path: `${BASE}/tags`, module: { ...tagsPage, default: TagsWithNote } }],
  },
];
const SETTINGS = `/app/groups/${TEST_GROUP.id}/settings`;
const TAGS = `${SETTINGS}/tags`;

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const NOTE_AT = minutesAgo(5);
const NOTE = fx.note({ occurredAt: NOTE_AT, text: "Walked to the mailbox" });
const NOTE_ID = NOTE.id;
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

  test("an owner merges Urgent into Knee: each record carries Knee once, and Urgent is gone", async () => {
    const device = await renderWithDevice({ route: WITH_NOTE, url: TAGS, role: "owner", fixtures });
    await found(LIST);
    const noteChips = () =>
      [...document.querySelectorAll("[data-note-tags] [data-tag-chip]")].map((c) => c.textContent?.trim());
    expect(noteChips()).toEqual(["Knee", "Urgent"]);

    await userEvent.click(page.getByRole("button", { name: "Merge Urgent into another tag" }));
    await found(DIALOG);
    expect(DIALOG()?.textContent).toContain("Merge “Urgent” into another tag?");
    const confirm = page.getByRole("button", { name: "Merge tags" });
    await expect.element(confirm).toBeDisabled();
    const into = page.getByRole("combobox", { name: "Merge into" });
    expect([...(DIALOG()?.querySelectorAll("option") ?? [])].map((o) => o.textContent)).toEqual([
      "Choose a tag",
      "Bills",
      "Knee",
    ]);
    await userEvent.selectOptions(into, "Knee");
    expect(DIALOG()?.textContent).toContain("Merge “Urgent” into “Knee”?");
    expect(DIALOG()?.textContent).toContain("“Knee” goes on the 3 records tagged “Urgent”");
    await userEvent.click(confirm);
    // The merge reads (plain reads, which settle doesn't track) before its one write, so a settle
    // right after the click can go quiet before the write lands. The dialog closes once the write
    // is done: settle after that, so every live query (the list's and the note's chips) has rerun.
    await expect.poll(DIALOG).toBeNull();
    await device.settle();

    await expect.poll(listed).toEqual(["Bills - 0 items", "Knee jade 3 items"]);
    // The note carried both: one Knee link. The symptom and the todo gain one; the deleted note's link goes.
    const linksTo = (column: string, id: string) =>
      device.query(`SELECT tag_id FROM record_tag WHERE ${column} = ?`, [id]);
    expect(await linksTo("entry_id", NOTE.id)).toEqual([{ tag_id: KNEE.id }]);
    expect(await linksTo("entry_id", SYMPTOM.id)).toEqual([{ tag_id: KNEE.id }]);
    expect(await linksTo("todo_id", CALL.id)).toEqual([{ tag_id: KNEE.id }]);
    expect(await device.query("SELECT id FROM tag WHERE id = ?", [URGENT.id])).toEqual([]);
    await expect.poll(noteChips).toEqual(["Knee"]);

    // The picker no longer offers it.
    await userEvent.click(page.getByRole("button", { name: "Add tag" }));
    const picker = await found(() => document.querySelector("[data-tag-picker]"));
    expect(
      [...picker.querySelectorAll("[data-tag-toggle]")].map((t) => t.getAttribute("data-tag-toggle")),
    ).toEqual([BILLS.id, KNEE.id]);
  });

  test("a caretaker has no Merge, and mergeTags refuses one", async () => {
    const device = await open("caretaker");
    await found(LIST);
    expect(LIST()?.querySelector("[data-tag-merge]")).toBeNull();
    const res = await mergeTags(device.db, URGENT.id, KNEE.id);
    expect(res.ok).toBe(false);
    expect(await device.query("SELECT id FROM tag WHERE id = ?", [URGENT.id])).toHaveLength(1);
    expect(await device.query("SELECT id FROM record_tag WHERE tag_id = ?", [URGENT.id])).toHaveLength(4);
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
