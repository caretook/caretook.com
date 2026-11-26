import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx, recordTag, tag } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { openTimeline, rows, rowWith, SAM } from "./timelineWorld";

// Renaming and deleting a tag from the picker sheet (tags slice 3), opened
// from a timeline row's ⋯ menu: owners, admins and caretakers rename any
// tag, an Easy helper only one they created; a taken name is refused
// inline; every row's chips follow. Only an owner gets Delete, after a
// native <dialog> naming how many records carry the tag; the tag comes off
// every record and the records stay. The rules are tagRules.test.ts's; the
// server's refusals tags.int.test.ts's and syncTags.int.test.ts's.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const NOTE = fx.note({ occurredAt: minutesAgo(5), text: "Walked to the mailbox" });
const SYMPTOM = fx.symptom({ occurredAt: minutesAgo(10), name: "Sore knee", severity: 3 });
const SAMS_NOTE = fx.note({ occurredAt: minutesAgo(20), createdBy: SAM.id, text: "Sam's visit notes" });
// Urgent is this device's user's; Knee is Sam's.
const URGENT = tag("Urgent");
const KNEE = tag("Knee", { createdBy: SAM.id, updatedBy: SAM.id });
const MOVE = tag("Care home move");
const fixtures = [
  SAM,
  NOTE,
  SYMPTOM,
  SAMS_NOTE,
  URGENT,
  KNEE,
  MOVE,
  recordTag(URGENT.id, NOTE.id),
  recordTag(URGENT.id, SYMPTOM.id),
  recordTag(URGENT.id, SAMS_NOTE.id),
  recordTag(KNEE.id, NOTE.id),
  recordTag(KNEE.id, SAMS_NOTE.id),
];

const actionsOf = (text: string) =>
  rowWith(text)?.querySelector<HTMLElement>('button[aria-label^="Actions for"]') ?? null;
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const chipsOf = (text: string) =>
  [...(rowWith(text)?.querySelectorAll("[data-tag-chip]") ?? [])].map((c) => c.textContent?.trim()).join(",");
const PICKER = () => document.querySelector<HTMLFormElement>("[data-tag-picker]");
const listed = () =>
  [...(PICKER()?.querySelectorAll("[data-tag-list] label") ?? [])]
    .map((l) => l.textContent?.trim())
    .join(",");
const renameButtons = () =>
  [...(PICKER()?.querySelectorAll<HTMLButtonElement>("[data-tag-edit]") ?? [])].map((b) =>
    b.getAttribute("aria-label"),
  );
const EDITOR = () => PICKER()?.querySelector<HTMLElement>("[data-tag-editor]") ?? null;
const RENAME = () => EDITOR()?.querySelector<HTMLInputElement>("[data-tag-rename]") ?? null;
const DELETE = () => EDITOR()?.querySelector<HTMLButtonElement>("[data-tag-delete]") ?? null;
const DIALOG = () => document.querySelector<HTMLDialogElement>("dialog[open]");

const open = (role: GroupRole) => openTimeline({ role, fixtures });
const ready = () => waitUntil(() => rows().length >= 3, "the rows");
const openPicker = async (text: string) => {
  await userEvent.click(await found(() => actionsOf(text)));
  await waitUntil(() => menuItems().length > 0, "the menu");
  await userEvent.click(page.getByRole("menuitem", { name: "Tags" }));
  await found(PICKER);
};
const startRename = async (name: string) => {
  await userEvent.click(page.getByRole("button", { name: `Rename ${name}` }));
  await found(RENAME);
};
const rename = async (name: string, to: string) => {
  await startRename(name);
  await userEvent.fill(await found(RENAME), to);
  await userEvent.click(page.getByRole("button", { name: "Save", exact: true }));
};

describe("renaming a tag", () => {
  test("a caretaker renames any tag in place; every chip follows; a taken name is refused inline", async () => {
    const device = await open("caretaker");
    await ready();
    await openPicker("Walked to the mailbox");
    await expect.poll(renameButtons).toEqual(["Rename Care home move", "Rename Knee", "Rename Urgent"]);

    // Sam's tag: renamed on every record that carries it.
    await rename("Knee", "  Left   knee ");
    await device.settle();
    await expect.poll(EDITOR).toBeNull();
    await expect.poll(listed).toBe("Care home move,Left knee,Urgent");
    await expect.poll(() => chipsOf("Walked to the mailbox")).toBe("Left knee,Urgent");
    await expect.poll(() => chipsOf("Sam's visit notes")).toBe("Left knee,Urgent");
    const [renamed] = await device.query<{ id: string; name: string; name_key: string }>(
      "SELECT id, name, name_key FROM tag WHERE id = ?",
      [KNEE.id],
    );
    expect(renamed).toEqual({ id: KNEE.id, name: "Left knee", name_key: "left knee" });
    const patch = (await device.queued()).find((w) => w.op === "PATCH" && w.id === KNEE.id);
    expect(patch?.data).toMatchObject({ name: "Left knee" });

    // A name another tag holds, in any case: refused in the editor, nothing changes.
    await rename("Urgent", "CARE HOME MOVE");
    await expect.element(page.getByText("The group already has a tag with that name.")).toBeVisible();
    expect(RENAME()?.getAttribute("aria-invalid")).toBe("true");
    // No Delete for a caretaker.
    expect(DELETE()).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Cancel", exact: true }));
    await expect.poll(EDITOR).toBeNull();
    await expect.poll(listed).toBe("Care home move,Left knee,Urgent");
    expect(chipsOf("Sore knee")).toBe("Urgent");
  });

  test("an Easy helper renames a tag they created, and gets no Rename on another's", async () => {
    const device = await open("easy_helper");
    await waitUntil(() => !!document.querySelector("[data-easy-list]"), "the easy view");
    await ready();
    await openPicker("Walked to the mailbox");
    await expect.poll(renameButtons).toEqual(["Rename Care home move", "Rename Urgent"]);

    // Enter saves the new name (the picker's form adds nothing).
    await startRename("Urgent");
    await userEvent.fill(await found(RENAME), "Pressing");
    await userEvent.keyboard("{Enter}");
    await device.settle();
    await expect.poll(EDITOR).toBeNull();
    await expect.poll(listed).toBe("Care home move,Knee,Pressing");
    await expect.poll(() => chipsOf("Walked to the mailbox")).toBe("Knee,Pressing");
    await expect.poll(() => chipsOf("Sam's visit notes")).toBe("Knee,Pressing");
    expect(await device.query("SELECT id FROM tag")).toHaveLength(3);
  });
});

describe("deleting a tag", () => {
  for (const role of ["admin", "caretaker"] as const)
    test(`a${role === "admin" ? "n admin" : " caretaker"} gets no Delete`, async () => {
      await open(role);
      await ready();
      await openPicker("Walked to the mailbox");
      await startRename("Urgent");
      expect(DELETE()).toBeNull();
      expect(EDITOR()?.textContent).not.toContain("Delete");
    });

  test("an owner deletes a tag after a dialog naming its records; it's off every record, and they stay", async () => {
    const device = await open("owner");
    await ready();
    await openPicker("Walked to the mailbox");
    await startRename("Urgent");

    // Cancel first: nothing changes.
    await userEvent.click(await found(DELETE));
    await found(DIALOG);
    expect(DIALOG()?.textContent).toContain("Delete the tag “Urgent”?");
    expect(DIALOG()?.textContent).toContain("It comes off 3 records");
    expect(DIALOG()?.textContent).toContain("The records stay.");
    await userEvent.click(page.getByRole("button", { name: "Cancel", exact: true }).last());
    await expect.poll(DIALOG).toBeNull();
    expect(chipsOf("Sore knee")).toBe("Urgent");

    await userEvent.click(await found(DELETE));
    await found(DIALOG);
    await userEvent.click(page.getByRole("button", { name: "Delete tag" }));
    await device.settle();
    await expect.poll(DIALOG).toBeNull();
    await expect.poll(listed).toBe("Care home move,Knee");
    await expect.poll(() => chipsOf("Walked to the mailbox")).toBe("Knee");
    expect(chipsOf("Sore knee")).toBe("");
    expect(chipsOf("Sam's visit notes")).toBe("Knee");

    // The records stay; the tag and its links are gone, queued as deletes.
    expect(rowWith("Sore knee")).toBeTruthy();
    expect(await device.query("SELECT id FROM tag WHERE id = ?", [URGENT.id])).toEqual([]);
    expect(await device.query("SELECT id FROM record_tag WHERE tag_id = ?", [URGENT.id])).toEqual([]);
    expect(await device.query("SELECT id FROM timeline_entry WHERE deleted_at IS NULL")).toHaveLength(3);
    const deletes = (await device.queued()).filter((w) => w.op === "DELETE");
    expect(deletes.filter((w) => w.type === "record_tag")).toHaveLength(3);
    expect(deletes.filter((w) => w.type === "tag").map((w) => w.id)).toEqual([URGENT.id]);
  });
});
