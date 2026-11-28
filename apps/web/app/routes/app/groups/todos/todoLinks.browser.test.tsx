import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as todosRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, entryTodo, fx, newId, todo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { encodeNoteDoc, noteDocFromText } from "@caretook/data/domain";

// The todo sheets' links (todo-links slice 2): the shared "Link to" box
// (what it finds and in what order is linkToBox.browser.test.tsx's) and
// the chosen links as chips with × (one provider, one medication, any notes
// and events); the prefills from a provider's, medication's or event's page
// (`eventId` and `entryId` start the notes and events); and an edited todo's
// links, removed or cancelled ones greyed. Notes and events are link rows,
// written with the todo; the edit sheet makes them what it shows on Save.
// The service's link rules are integration tests.

const BASE = "/app/groups/:groupId/todos";
const ROUTES: DeviceRoute[] = [
  {
    path: BASE,
    module: todosRoute,
    children: [
      { path: `${BASE}/new`, module: newSheet },
      { path: `${BASE}/:todoId/edit`, module: editSheet },
    ],
  },
];
const LIST = `/app/groups/${TEST_GROUP.id}/todos`;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const when = (ms: number) => at(new Date(Date.now() + ms));

const LARK = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8a01", name: "Dr. Mira Lark" });
const CORNER = fx.provider({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8a02",
  type: "pharmacy",
  name: "Corner Pharmacy",
  specialty: null,
});
const GONE = fx.provider({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8a03",
  name: "Dr. Gone",
  deletedAt: when(-DAY),
});
const SOON = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b01",
  title: "Cardiology",
  occurredAt: when(DAY),
});
const LATER = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b02",
  title: "Eye doctor",
  occurredAt: when(5 * DAY),
});
const RECENT = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b03",
  title: "Podiatry",
  occurredAt: when(-3 * DAY),
});
const OLD = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b04",
  title: "Old visit",
  occurredAt: when(-40 * DAY),
});
const CANCELLED = fx.event({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8b05",
  title: "Dental cleaning",
  occurredAt: when(2 * DAY),
  cancelledAt: when(-HOUR),
});
const METFORMIN = fx.medication({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8c01",
  name: "Metformin",
  strength: "500 mg",
});
const AMOX = fx.medication({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8c02",
  name: "Amoxicillin",
  strength: null,
  status: "completed",
  stoppedOn: "2026-10-01",
});
const NIGHT = fx.note({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e01",
  title: "Rough night",
  text: "Up at 3.",
});
const world = () => [LARK, CORNER, GONE, SOON, LATER, RECENT, OLD, CANCELLED, METFORMIN, AMOX, NIGHT];

const open = (url: string, fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url, role: "owner", fixtures, search: true });

type Device = Awaited<ReturnType<typeof open>>;
type LinkRow = {
  provider_id: string | null;
  event_id: string | null;
  medication_id: string | null;
  entries: string | null;
};
/** The todo's provider and medication, its `event_id` (never written now) and its linked entries' ids, sorted. */
const linksOf = async (device: Device, title: string) =>
  (
    await device.query<LinkRow>(
      `SELECT provider_id, event_id, medication_id,
         (SELECT group_concat(entry_id) FROM (SELECT entry_id FROM timeline_entry_todo l
            WHERE l.todo_id = todo.id ORDER BY entry_id)) AS entries
       FROM todo WHERE title = ?`,
      [title],
    )
  )[0];
const ids = (...entries: { id: string }[]) =>
  entries
    .map((e) => e.id)
    .sort()
    .join(",");
/** The queued uploads' tables and ops, with their local transaction. */
const uploads = (device: Device) =>
  device.db.powersync
    .getAll<{ tx_id: number; data: string }>("SELECT tx_id, data FROM ps_crud ORDER BY id")
    .then((rows) =>
      rows.map((r) => {
        const op = JSON.parse(r.data) as { op: string; type: string; data?: Record<string, unknown> };
        return { tx: r.tx_id, op: `${op.op} ${op.type}`, data: op.data ?? {} };
      }),
    );

type Dialog = ReturnType<typeof page.getByRole>;

/** Pick what `text` finds in the sheet's "Link to" box. */
const pick = async (dialog: Dialog, text: string, option: RegExp) => {
  await userEvent.click(dialog.getByRole("combobox", { name: "Link to" }));
  await userEvent.keyboard(text);
  await userEvent.click(page.getByRole("option", { name: option }));
};
const chips = (dialog: Dialog) => dialog.getByRole("list", { name: "Linked to" });

describe("the todo sheet's links", () => {
  test("a new todo saved with a provider, a medication, a note and an event has all four", async () => {
    const device = await open(`${LIST}/new`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Bring the BP log");

    await pick(dialog, "corner", /^Corner Pharmacy/);
    await expect.element(chips(dialog).getByText("Corner Pharmacy", { exact: true })).toBeInTheDocument();
    await pick(dialog, "metformin", /^Metformin/);
    await expect.element(chips(dialog).getByText("Metformin 500 mg", { exact: true })).toBeInTheDocument();
    await pick(dialog, "eye doctor", /^Eye doctor/);
    await expect.element(chips(dialog).getByText(/^Eye doctor · /)).toBeInTheDocument();
    await pick(dialog, "rough", /^Rough night/);
    await expect.element(chips(dialog).getByText("Rough night", { exact: true })).toBeInTheDocument();
    // A second provider replaces the first.
    await pick(dialog, "lark", /^Dr\. Mira Lark/);
    await expect.element(chips(dialog).getByText("Corner Pharmacy")).not.toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    expect(await linksOf(device, "Bring the BP log")).toEqual({
      provider_id: LARK.id,
      event_id: null,
      medication_id: METFORMIN.id,
      entries: ids(LATER, NIGHT),
    });
    // The todo, then its two links, in one local transaction.
    const ops = await uploads(device);
    expect(ops.map((o) => o.op)).toEqual(["PUT todo", "PUT timeline_entry_todo", "PUT timeline_entry_todo"]);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
  });

  test("opened from a provider's or an event's page it starts with that link, and × clears one", async () => {
    const device = await open(
      `${LIST}/new?providerId=${LARK.id}&eventId=${SOON.id}&medicationId=${METFORMIN.id}`,
    );
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(chips(dialog).getByText("Dr. Mira Lark", { exact: true })).toBeInTheDocument();
    await expect.element(chips(dialog).getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();
    await expect.element(chips(dialog).getByText("Metformin 500 mg", { exact: true })).toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "Remove link to Metformin 500 mg" }));
    await expect.element(chips(dialog).getByText("Metformin 500 mg")).not.toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Ask about the stress test");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect
      .poll(() => linksOf(device, "Ask about the stress test"))
      .toEqual({ provider_id: LARK.id, event_id: null, medication_id: null, entries: SOON.id });
  });

  test("an event's page (`entryId`) starts with the event", async () => {
    const device = await open(`${LIST}/new?entryId=${SOON.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(chips(dialog).getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Bring the meds list");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(() => linksOf(device, "Bring the meds list")).toMatchObject({ entries: SOON.id });
  });

  test("an old appointment passed in still shows; a prefilled removed provider is refused on save", async () => {
    await open(`${LIST}/new?eventId=${OLD.id}&providerId=${GONE.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(chips(dialog).getByText(/^Old visit · /)).toBeInTheDocument();
    await expect.element(chips(dialog).getByText("Dr. Gone (removed)")).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Follow up");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.element(dialog.getByText("Choose a provider in this care group")).toBeInTheDocument();
  });

  test("a new todo shows a cancelled appointment passed in, greyed", async () => {
    await open(`${LIST}/new?eventId=${CANCELLED.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(chips(dialog).getByText(/^Dental cleaning · .* \(cancelled\)$/)).toBeInTheDocument();
  });
});

describe("the edit sheet's links", () => {
  const linked = todo({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8d01",
    title: "Reschedule the cleaning",
    providerId: GONE.id,
    // Backfilled: its `event_id` and the link row the migration made.
    eventId: CANCELLED.id,
    medicationId: AMOX.id,
  });
  const edit = () =>
    open(`${LIST}/${linked.id}/edit`, [
      ...world(),
      linked,
      entryTodo(CANCELLED.id, linked.id),
      entryTodo(SOON.id, linked.id),
    ]);

  test("shows its links, removed ones greyed; adds a note and removes an event on Save, uploading no `event_id`", async () => {
    const device = await edit();
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    await expect.element(chips(dialog).getByText("Dr. Gone (removed)")).toBeInTheDocument();
    // A stopped medication stays on its chip.
    await expect.element(chips(dialog).getByText("Amoxicillin", { exact: true })).toBeInTheDocument();
    await expect.element(chips(dialog).getByText(/^Dental cleaning · .* \(cancelled\)$/)).toBeInTheDocument();
    await expect.element(chips(dialog).getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();

    await pick(dialog, "rough", /^Rough night/);
    await expect.element(chips(dialog).getByText("Rough night", { exact: true })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: /^Remove link to Cardiology/ }));
    await expect.element(chips(dialog).getByText(/^Cardiology/)).not.toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Rebook the cleaning");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect
      .poll(() => linksOf(device, "Rebook the cleaning"))
      .toEqual({
        provider_id: GONE.id,
        event_id: CANCELLED.id,
        medication_id: AMOX.id,
        entries: ids(CANCELLED, NIGHT),
      });
    const ops = await uploads(device);
    expect(ops.map((o) => o.op)).toEqual([
      "PATCH todo",
      "PUT timeline_entry_todo",
      "DELETE timeline_entry_todo",
    ]);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
    expect(ops[0]?.data).toMatchObject({ title: "Rebook the cleaning" });
    expect(ops[0]?.data).not.toHaveProperty("event_id");
  });

  test("Cancel changes nothing", async () => {
    const device = await edit();
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    await expect.element(chips(dialog).getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();
    await pick(dialog, "rough", /^Rough night/);
    await userEvent.click(dialog.getByRole("button", { name: /^Remove link to Cardiology/ }));
    await userEvent.click(dialog.getByRole("button", { name: "Remove link to Amoxicillin" }));
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    expect(await linksOf(device, "Reschedule the cleaning")).toEqual({
      provider_id: GONE.id,
      event_id: CANCELLED.id,
      medication_id: AMOX.id,
      entries: ids(CANCELLED, SOON),
    });
    expect(await uploads(device)).toEqual([]);
  });

  test("a link another member makes while it's open shows, and a title-only Save keeps it (B-990)", async () => {
    const device = await edit();
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    await expect.element(chips(dialog).getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();
    // Another member links the note and unlinks the cardiology visit.
    await device.sync([entryTodo(NIGHT.id, linked.id)]);
    await device.unsync([entryTodo(SOON.id, linked.id)]);
    await device.settle();
    await expect.element(chips(dialog).getByText("Rough night", { exact: true })).toBeInTheDocument();
    await expect.element(chips(dialog).getByText(/^Cardiology/)).not.toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Rebook the cleaning");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect
      .poll(() => linksOf(device, "Rebook the cleaning"))
      .toMatchObject({ entries: ids(CANCELLED, NIGHT) });
    expect((await uploads(device)).map((o) => o.op)).toEqual(["PATCH todo"]);
  });

  test("names an untitled note by this device's unsent edits (B-991)", async () => {
    // Written offline: no server copy yet, only its pending update.
    const draft = fx.note({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e02", title: null });
    const update = newId();
    await open(`${LIST}/${linked.id}/edit`, [
      ...world(),
      linked,
      draft,
      entryTodo(draft.id, linked.id),
      {
        table: "note_update",
        id: update,
        row: {
          id: update,
          group_id: TEST_GROUP.id,
          document_id: draft.id,
          data: encodeNoteDoc(noteDocFromText("Pharmacy called back\nRefill Friday")),
          created_at: at(),
          created_by: TEST_USER.id,
        },
      },
    ]);
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    await expect
      .element(chips(dialog).getByText("Pharmacy called back", { exact: true }))
      .toBeInTheDocument();
  });
});

describe("todos/new with an entry (`entryId`)", () => {
  test("a note's saves a todo linked to it, in one local transaction", async () => {
    const device = await open(`${LIST}/new?entryId=${NIGHT.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(chips(dialog).getByText("Rough night", { exact: true })).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Ask about sleep");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect
      .poll(() => linksOf(device, "Ask about sleep"))
      .toMatchObject({ event_id: null, entries: NIGHT.id });
    const ops = await uploads(device);
    expect(ops.map((o) => o.op)).toEqual(["PUT todo", "PUT timeline_entry_todo"]);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
  });

  test("one that isn't a live note or event is ignored: a symptom, a deleted note, an unknown id", async () => {
    const symptom = fx.symptom({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e02" });
    const deleted = fx.note({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e03", deletedAt: when(-HOUR) });
    const unlinkable = [symptom.id, deleted.id, "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8eff"];
    for (const [n, id] of unlinkable.entries()) {
      const device = await open(`${LIST}/new?entryId=${id}`, [...world(), symptom, deleted]);
      const dialog = page.getByRole("dialog", { name: "Add a todo" });
      await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), `Plain ${n}`);
      await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
      await expect.poll(() => linksOf(device, `Plain ${n}`)).toMatchObject({ entries: null });
      await device.screen.unmount();
    }
  });
});
