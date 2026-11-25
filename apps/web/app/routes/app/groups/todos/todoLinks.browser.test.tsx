import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as todosRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, entryTodo, fx, todo, TEST_GROUP } from "../../../../../test/fixtures";

// The todo sheets' link pickers (todos slice 3): a provider, an appointment
// (upcoming and the last 30 days', soonest first) and a current
// medication; the prefills from a provider's, medication's or event's page;
// and an edited todo's removed or cancelled links. The appointment is a link
// row (planner-3), written with the todo; editing leaves it alone, so the
// edit sheet has no appointment picker. `entryId` links any live note or
// event. The choices' order is
// unit-tested (todoLinks.test.ts); the service's link rules are integration
// tests.

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
const world = () => [LARK, CORNER, GONE, SOON, LATER, RECENT, OLD, CANCELLED, METFORMIN, AMOX];

const open = (url: string, fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url, role: "owner", fixtures });

type Device = Awaited<ReturnType<typeof open>>;
type LinkRow = {
  provider_id: string | null;
  event_id: string | null;
  medication_id: string | null;
  entries: string | null;
};
/** The todo's provider and medication, its `event_id` (never written now) and its linked entries' ids. */
const linksOf = async (device: Device, title: string) =>
  (
    await device.query<LinkRow>(
      `SELECT provider_id, event_id, medication_id,
         (SELECT group_concat(entry_id) FROM timeline_entry_todo l WHERE l.todo_id = todo.id) AS entries
       FROM todo WHERE title = ?`,
      [title],
    )
  )[0];
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

const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim() ?? "");

describe("the todo sheet's link pickers", () => {
  test("picks a provider, an appointment and a current medication, and saves all three", async () => {
    const device = await open(`${LIST}/new`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Bring the BP log");

    // Providers: every live type, not the removed one.
    await userEvent.click(dialog.getByRole("combobox", { name: "Find a provider" }));
    await expect.poll(options).toHaveLength(2);
    expect(options().join(" | ")).not.toContain("Dr. Gone");
    await userEvent.click(page.getByRole("option", { name: /^Corner Pharmacy/ }));
    await expect.element(dialog.getByText("Corner Pharmacy", { exact: true })).toBeInTheDocument();

    // Events: upcoming soonest first, then the last 30 days'; never cancelled or older ones.
    await expect
      .element(dialog.getByRole("combobox", { name: "Find an event" }))
      .toHaveAttribute("placeholder", "Upcoming and recent events");
    await userEvent.click(dialog.getByRole("combobox", { name: "Find an event" }));
    await expect
      .poll(() => options().map((o) => o.split(/Tomorrow|[A-Z][a-z]+day/)[0]?.trim()))
      .toEqual(["Cardiology", "Eye doctor", "Podiatry"]);
    await userEvent.keyboard("eye");
    await expect.poll(options).toHaveLength(1);
    await userEvent.click(page.getByRole("option", { name: /^Eye doctor/ }));
    await expect.element(dialog.getByText(/^Eye doctor · /)).toBeInTheDocument();

    // Medications: current only.
    await userEvent.click(dialog.getByRole("combobox", { name: "Find a medication" }));
    await expect.poll(options).toEqual(["Metformin 500 mg"]);
    await userEvent.click(page.getByRole("option", { name: "Metformin 500 mg" }));

    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    expect(await linksOf(device, "Bring the BP log")).toEqual({
      provider_id: CORNER.id,
      event_id: null,
      medication_id: METFORMIN.id,
      entries: LATER.id,
    });
    // The todo, then its one link, in one local transaction.
    const ops = await uploads(device);
    expect(ops.map((o) => o.op)).toEqual(["PUT todo", "PUT timeline_entry_todo"]);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
  });

  test("starts with the link a page passed in, and × clears one", async () => {
    const device = await open(
      `${LIST}/new?providerId=${LARK.id}&eventId=${SOON.id}&medicationId=${METFORMIN.id}`,
    );
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog.getByText("Dr. Mira Lark", { exact: true })).toBeInTheDocument();
    await expect.element(dialog.getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();
    await expect.element(dialog.getByText("Metformin 500 mg", { exact: true })).toBeInTheDocument();
    expect(document.querySelector('[role="combobox"]')).not.toBeNull(); // the assignee's

    await userEvent.click(dialog.getByRole("button", { name: "Clear the medication" }));
    await expect.element(dialog.getByRole("combobox", { name: "Find a medication" })).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Ask about the stress test");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect
      .poll(() => linksOf(device, "Ask about the stress test"))
      .toEqual({
        provider_id: LARK.id,
        event_id: null,
        medication_id: null,
        entries: SOON.id,
      });
  });

  test("an old appointment passed in still shows; a prefilled removed provider is refused on save", async () => {
    await open(`${LIST}/new?eventId=${OLD.id}&providerId=${GONE.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog.getByText(/^Old visit · /)).toBeInTheDocument();
    await expect.element(dialog.getByText("Dr. Gone (removed)")).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Follow up");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.element(dialog.getByText("Choose a provider in this care group")).toBeInTheDocument();
  });

  test("a new todo shows a cancelled appointment passed in, greyed", async () => {
    await open(`${LIST}/new?eventId=${CANCELLED.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog.getByText(/^Dental cleaning · .* \(cancelled\)$/)).toBeInTheDocument();
  });

  test("editing a backfilled todo keeps a removed provider, greyed, and its appointment link; the save uploads no `event_id`", async () => {
    // Backfilled: its `event_id` and the link row the migration made.
    const linked = todo({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8d01",
      title: "Reschedule the cleaning",
      providerId: GONE.id,
      eventId: CANCELLED.id,
      medicationId: AMOX.id,
    });
    const device = await open(`${LIST}/${linked.id}/edit`, [
      ...world(),
      linked,
      entryTodo(CANCELLED.id, linked.id),
    ]);
    const dialog = page.getByRole("dialog", { name: "Edit todo" });
    await expect.element(dialog.getByText("Dr. Gone (removed)")).toBeInTheDocument();
    // A stopped medication stays on its chip.
    await expect.element(dialog.getByText("Amoxicillin", { exact: true })).toBeInTheDocument();
    // Its appointments are links, which the todo's page shows; the form leaves them alone.
    await expect.element(dialog.getByRole("combobox", { name: "Find an event" })).not.toBeInTheDocument();

    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Rebook the cleaning");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect
      .poll(() => linksOf(device, "Rebook the cleaning"))
      .toEqual({
        provider_id: GONE.id,
        event_id: CANCELLED.id,
        medication_id: AMOX.id,
        entries: CANCELLED.id,
      });
    const ops = await uploads(device);
    expect(ops.map((o) => o.op)).toEqual(["PATCH todo"]);
    expect(ops[0]?.data).toMatchObject({ title: "Rebook the cleaning" });
    expect(ops[0]?.data).not.toHaveProperty("event_id");
  });
});

describe("todos/new with an entry (`entryId`)", () => {
  const NOTE = fx.note({
    id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e01",
    title: "Rough night",
    text: "Up at 3.",
  });

  test("a note's saves a todo linked to it, in one local transaction", async () => {
    const device = await open(`${LIST}/new?entryId=${NOTE.id}`, [...world(), NOTE]);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Ask about sleep");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect
      .poll(() => linksOf(device, "Ask about sleep"))
      .toMatchObject({ event_id: null, entries: NOTE.id });
    const ops = await uploads(device);
    expect(ops.map((o) => o.op)).toEqual(["PUT todo", "PUT timeline_entry_todo"]);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
  });

  test("an event's fills the appointment picker", async () => {
    const device = await open(`${LIST}/new?entryId=${SOON.id}`);
    const dialog = page.getByRole("dialog", { name: "Add a todo" });
    await expect.element(dialog.getByText(/^Cardiology · Tomorrow/)).toBeInTheDocument();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), "Bring the meds list");
    await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
    await expect.poll(() => linksOf(device, "Bring the meds list")).toMatchObject({ entries: SOON.id });
  });

  test("one that isn't a live note or event is ignored: a symptom, a deleted note, an unknown id", async () => {
    const symptom = fx.symptom({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e02" });
    const deleted = fx.note({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8e03", deletedAt: when(-HOUR) });
    const ids = [symptom.id, deleted.id, "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f8eff"];
    for (const [n, id] of ids.entries()) {
      const device = await open(`${LIST}/new?entryId=${id}`, [...world(), symptom, deleted]);
      const dialog = page.getByRole("dialog", { name: "Add a todo" });
      await userEvent.fill(dialog.getByRole("textbox", { name: "Todo" }), `Plain ${n}`);
      await userEvent.click(dialog.getByRole("button", { name: "Add todo" }));
      await expect.poll(() => linksOf(device, `Plain ${n}`)).toMatchObject({ entries: null });
      await device.screen.unmount();
    }
  });
});
