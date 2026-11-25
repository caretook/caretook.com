import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as todoRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, entryTodo, fx, todo, TEST_GROUP } from "../../../../../test/fixtures";
import { removeEntry } from "~/lib/timeline/timeline.sync";

// The todo page's link rows (todos slice 3): the provider with its call and
// map actions, the appointment with its time (struck through when
// cancelled), the medication, each opening its page; a deleted provider or
// medication greyed "(removed)"; a deleted event's link gone. Its events
// are link rows (planner-3): the fixtures are a backfilled todo, its
// `event_id` with the row the migration made for it.

const ROUTES: DeviceRoute[] = [{ path: "/app/groups/:groupId/todos/:todoId", module: todoRoute }];
const pageOf = (id: string) => `/app/groups/${TEST_GROUP.id}/todos/${id}`;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const when = (ms: number) => at(new Date(Date.now() + ms));

type Over = Record<string, unknown>;
const LARK_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9a01";
const VISIT_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9b01";
const METFORMIN_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9c01";
const lark = (v: Over = {}) =>
  fx.provider({ id: LARK_ID, name: "Dr. Mira Lark", address: "12 Elm St, Springfield", ...v });
const visit = (v: Over = {}) =>
  fx.event({ id: VISIT_ID, title: "Cardiology follow-up", occurredAt: when(2 * DAY), ...v });
const metformin = (v: Over = {}) =>
  fx.medication({ id: METFORMIN_ID, name: "Metformin", strength: "500 mg", ...v });
const LARK = lark();
const VISIT = visit();
const METFORMIN = metformin();
const LINKED_FIELDS = {
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9d01",
  title: "Bring the blood pressure log",
  providerId: LARK.id,
  eventId: VISIT.id,
  medicationId: METFORMIN.id,
};
const LINKED = todo(LINKED_FIELDS);
const LINKED_ROW = entryTodo(VISIT.id, LINKED.id);

const open = (
  id: string,
  fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"],
  role: GroupRole = "owner",
) => renderWithDevice({ route: ROUTES, url: pageOf(id), role, fixtures });

const row = (kind: string) => document.querySelector<HTMLElement>(`[data-todo-link="${kind}"]`);
const nameIn = (kind: string) => row(kind)?.querySelector("[data-todo-link-name]");

describe("the todo page's links", () => {
  test("lists the provider with its actions, the appointment with its time, and the medication, each a link", async () => {
    await open(LINKED.id, [LARK, VISIT, METFORMIN, LINKED, LINKED_ROW], "viewer");
    const links = page.getByRole("region", { name: "Linked to" });
    await expect.element(links).toBeInTheDocument();

    const provider = links.getByRole("link", { name: "Dr. Mira Lark" });
    await expect
      .element(provider)
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/providers/${LARK.id}`);
    await expect.element(links.getByRole("link", { name: /^Call Dr\. Mira Lark/ })).toBeInTheDocument();
    await expect
      .element(links.getByRole("link", { name: /^Open Dr\. Mira Lark.s address in maps/ }))
      .toBeInTheDocument();

    await expect
      .element(links.getByRole("link", { name: "Cardiology follow-up" }))
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/entries/${VISIT.id}`);
    expect(row("event")?.querySelector("[data-todo-link-when]")?.textContent).toMatch(
      / · \d{1,2}:\d\d [AP]M$/,
    );
    expect(row("event")?.hasAttribute("data-cancelled")).toBe(false);

    await expect
      .element(links.getByRole("link", { name: "Metformin 500 mg" }))
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/medications/${METFORMIN.id}`);
  });

  test("greys a removed provider and medication, and strikes a cancelled appointment through", async () => {
    const gone = { deletedAt: when(-HOUR) };
    await open(LINKED.id, [
      lark(gone),
      visit({ cancelledAt: when(-HOUR) }),
      metformin(gone),
      LINKED,
      LINKED_ROW,
    ]);
    await expect.poll(() => nameIn("provider")?.textContent).toBe("Dr. Mira Lark (removed)");
    expect(nameIn("provider")?.tagName).toBe("P");
    expect(row("provider")?.querySelector("a")).toBeNull();
    expect(nameIn("medication")?.textContent).toBe("Metformin 500 mg (removed)");
    expect(row("medication")?.querySelector("a")).toBeNull();

    expect(row("event")?.hasAttribute("data-cancelled")).toBe(true);
    expect(nameIn("event")?.className).toContain("line-through");
    expect(row("event")?.textContent).toContain("Cancelled");
  });

  test("a deleted appointment's link goes quietly; offline, removeEntry keeps the todo and its link row", async () => {
    const device = await open(LINKED.id, [LARK, VISIT, METFORMIN, LINKED, LINKED_ROW]);
    await expect.poll(() => row("event")).not.toBeNull();
    expect((await removeEntry(device.db, VISIT.id)).ok).toBe(true);
    await expect.poll(() => row("event")).toBeNull();
    await expect
      .element(page.getByRole("heading", { name: "Bring the blood pressure log", level: 1 }))
      .toBeInTheDocument();
    const [after] = await device.query<{ deleted_at: string | null; provider_id: string }>(
      "SELECT deleted_at, provider_id FROM todo WHERE id = ?",
      [LINKED.id],
    );
    expect(after).toEqual({ deleted_at: null, provider_id: LARK.id });
    expect(await device.query("SELECT id FROM timeline_entry_todo WHERE todo_id = ?", [LINKED.id])).toEqual([
      { id: LINKED_ROW.id },
    ]);
    // Only the event's delete uploads: the todo isn't written (the server clears an old client's `event_id`).
    expect((await device.queued()).map((w) => `${w.op} ${w.id}`)).toEqual([`PATCH ${VISIT.id}`]);
  });

  test("lists every linked event from its link rows, newest first, and none from `event_id` alone", async () => {
    const later = fx.event({
      id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9b02",
      title: "Echo scan",
      occurredAt: when(5 * DAY),
    });
    const old = fx.event({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9b03", title: "Old visit" });
    const todoRow = todo({ ...LINKED_FIELDS, eventId: old.id });
    await open(LINKED.id, [
      LARK,
      VISIT,
      METFORMIN,
      later,
      old,
      todoRow,
      LINKED_ROW,
      entryTodo(later.id, LINKED.id),
    ]);
    await expect.poll(() => document.querySelectorAll('[data-todo-link="event"]').length).toBe(2);
    expect(
      [...document.querySelectorAll('[data-todo-link="event"] [data-todo-link-name]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(["Echo scan", "Cardiology follow-up"]);
  });

  test("shows no links region for a todo without links", async () => {
    const plain = todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9d02", title: "Water the plants" });
    await open(plain.id, [plain]);
    await expect
      .element(page.getByRole("heading", { name: "Water the plants", level: 1 }))
      .toBeInTheDocument();
    expect(document.querySelector("[data-todo-links]")).toBeNull();
  });
});
