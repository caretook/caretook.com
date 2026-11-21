import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as todoRoute from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, todo, TEST_GROUP } from "../../../../../test/fixtures";
import { removeEntry } from "~/lib/timeline/timeline.sync";

// The todo page's link rows (todos slice 3): the provider with its call and
// map actions, the appointment with its time (struck through when
// cancelled), the medication, each opening its page; a deleted provider or
// medication greyed "(removed)"; a deleted event's link gone (the device's
// removeEntry clears it, as the server does).

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
const LINKED = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f9d01",
  title: "Bring the blood pressure log",
  providerId: LARK.id,
  eventId: VISIT.id,
  medicationId: METFORMIN.id,
});

const open = (
  id: string,
  fixtures: Parameters<typeof renderWithDevice>[0]["fixtures"],
  role: GroupRole = "owner",
) => renderWithDevice({ route: ROUTES, url: pageOf(id), role, fixtures });

const row = (kind: string) => document.querySelector<HTMLElement>(`[data-todo-link="${kind}"]`);
const nameIn = (kind: string) => row(kind)?.querySelector("[data-todo-link-name]");

describe("the todo page's links", () => {
  test("lists the provider with its actions, the appointment with its time, and the medication, each a link", async () => {
    await open(LINKED.id, [LARK, VISIT, METFORMIN, LINKED], "viewer");
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
    await open(LINKED.id, [lark(gone), visit({ cancelledAt: when(-HOUR) }), metformin(gone), LINKED]);
    await expect.poll(() => nameIn("provider")?.textContent).toBe("Dr. Mira Lark (removed)");
    expect(nameIn("provider")?.tagName).toBe("P");
    expect(row("provider")?.querySelector("a")).toBeNull();
    expect(nameIn("medication")?.textContent).toBe("Metformin 500 mg (removed)");
    expect(row("medication")?.querySelector("a")).toBeNull();

    expect(row("event")?.hasAttribute("data-cancelled")).toBe(true);
    expect(nameIn("event")?.className).toContain("line-through");
    expect(row("event")?.textContent).toContain("Cancelled");
  });

  test("a deleted appointment's link goes quietly: removeEntry clears it on the device", async () => {
    const device = await open(LINKED.id, [LARK, VISIT, METFORMIN, LINKED]);
    await expect.poll(() => row("event")).not.toBeNull();
    expect((await removeEntry(device.db, VISIT.id)).ok).toBe(true);
    await expect.poll(() => row("event")).toBeNull();
    const [after] = await device.query<{ event_id: string | null; provider_id: string }>(
      "SELECT event_id, provider_id FROM todo WHERE id = ?",
      [LINKED.id],
    );
    expect(after).toEqual({ event_id: null, provider_id: LARK.id });
    const patch = (await device.queued()).find((w) => w.op === "PATCH" && w.id === LINKED.id);
    expect(patch?.data).toMatchObject({ event_id: null });
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
