import type { DeviceRoute } from "../../../test/device";
import type { GroupRole } from "../../../test/fixtures";

import { addDays, localDate } from "@caretook/data/schema";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { at, fx, todo, TEST_GROUP, TEST_TIME_ZONE, TEST_USER } from "../../../test/fixtures";
import * as medicationRoute from "../../routes/app/groups/medication/route";
import * as providerRoute from "../../routes/app/groups/provider/route";

// `LinkedTodos` (todos slice 3) on the pages that have it: a provider's page
// and a medication's page (an entry's page has its own Todos since
// planner-3: entry/entryTodos.browser.test.tsx). Open linked todos
// in list order with ticks (for whoever may complete them) and Undo; writers'
// quick add (todo-links-6: a linked todo, and each row's linked subtask);
// hidden from readers when there are none.

const G = "/app/groups/:groupId";
const ROUTES: DeviceRoute[] = [
  { path: `${G}/providers/:providerId`, module: providerRoute },
  { path: `${G}/medications/:medicationId`, module: medicationRoute },
];
const url = (path: string) => `/app/groups/${TEST_GROUP.id}/${path}`;

const today = localDate(new Date(), TEST_TIME_ZONE);

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa002";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const VIEWER_ID = TEST_USER.id;

const LARK = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa101", name: "Dr. Mira Lark" });
const METFORMIN = fx.medication({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa301", name: "Metformin" });
const OTHER = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa102", name: "Corner Pharmacy" });

const linked = (n: number, v: Parameters<typeof todo>[0]) =>
  todo({ id: `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fa4${String(n).padStart(2, "0")}`, ...v });

const world = () => [
  SAM,
  LARK,
  OTHER,
  METFORMIN,
  // The provider's: a later one, an overdue one of mine, a done one, a deleted one.
  linked(1, {
    title: "Ask about the stress test",
    providerId: LARK.id,
    dueOn: addDays(today, 3),
    assigneeId: SAM_ID,
  }),
  linked(2, {
    title: "Call Dr. Lark's office",
    providerId: LARK.id,
    dueOn: addDays(today, -1),
    assigneeId: VIEWER_ID,
  }),
  linked(3, { title: "Fax the referral", providerId: LARK.id, doneAt: at(), doneBy: SAM_ID }),
  linked(4, { title: "Deleted one", providerId: LARK.id, deletedAt: at() }),
  // The medication's.
  linked(6, { title: "Refill Metformin", medicationId: METFORMIN.id, dueOn: today, assigneeId: VIEWER_ID }),
];

const open = (path: string, role: GroupRole = "owner", fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url: url(path), role, fixtures });

const region = () => page.getByRole("region", { name: "Todos" });
const titles = () =>
  [...document.querySelectorAll("[data-linked-todos] [data-todo-title]")].map((el) => el.textContent?.trim());
const ticks = () => [...document.querySelectorAll<HTMLInputElement>("[data-linked-todos] [data-todo-tick]")];

describe("LinkedTodos", () => {
  test("a provider's page lists its open todos, overdue first, with ticks and Undo for a writer", async () => {
    const device = await open(`providers/${LARK.id}`);
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Call Dr. Lark's office", "Ask about the stress test"]);
    expect(
      document.querySelector('[data-linked-todos] [data-todo-state="overdue"] [data-todo-due]')?.textContent,
    ).toBe("Overdue · 1 day");
    expect(ticks()).toHaveLength(2);
    await expect
      .element(region().getByRole("link", { name: "Call Dr. Lark's office" }))
      .toHaveAttribute("href", url(`todos/${linked(2, {}).id}`));

    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Ask about the stress test” done" }));
    await expect.poll(titles).toEqual(["Call Dr. Lark's office"]);
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Ask about the stress test" }))
      .toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Undo Ask about the stress test" }));
    await expect.poll(titles).toEqual(["Call Dr. Lark's office", "Ask about the stress test"]);
    const [row] = await device.query<{ done_at: string | null }>("SELECT done_at FROM todo WHERE id = ?", [
      linked(1, {}).id,
    ]);
    expect(row?.done_at).toBeNull();
  });

  test("a writer's quick add adds a todo linked here, and a row's adds a linked subtask; both list here", async () => {
    const device = await open(`providers/${OTHER.id}`);
    const field = region().getByRole("textbox", { name: "New todo" });
    await userEvent.click(field);
    await userEvent.keyboard("Call to confirm{Enter}");
    await expect.poll(titles).toEqual(["Call to confirm"]);
    await expect.element(field).toHaveValue("");
    await expect.element(field).toHaveFocus();
    const [made] = await device.query<{ id: string; provider_id: string; parent_id: string | null }>(
      "SELECT id, provider_id, parent_id FROM todo WHERE title = ?",
      ["Call to confirm"],
    );
    expect(made).toMatchObject({ provider_id: OTHER.id, parent_id: null });
    expect(device.location()).toBe(url(`providers/${OTHER.id}`));

    await userEvent.click(region().getByRole("button", { name: "Add subtask to Call to confirm" }));
    await userEvent.keyboard("Ask about the hours{Enter}");
    await expect.poll(titles).toContain("Ask about the hours");
    const [sub] = await device.query<{ provider_id: string; parent_id: string }>(
      "SELECT provider_id, parent_id FROM todo WHERE title = ?",
      ["Ask about the hours"],
    );
    expect(sub).toEqual({ provider_id: OTHER.id, parent_id: made!.id });
  });

  test("a viewer sees the list with ticks only on their own todos, and no quick add", async () => {
    await open(`providers/${LARK.id}`, "viewer");
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Call Dr. Lark's office", "Ask about the stress test"]);
    expect(ticks().map((t) => t.getAttribute("aria-label"))).toEqual(["Mark “Call Dr. Lark's office” done"]);
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
  });

  test("a medication's page lists its todos; a viewer assigned one can tick it", async () => {
    const device = await open(`medications/${METFORMIN.id}`, "viewer");
    await expect.element(region()).toBeInTheDocument();
    expect(titles()).toEqual(["Refill Metformin"]);
    await userEvent.click(page.getByRole("checkbox", { name: "Mark “Refill Metformin” done" }));
    // Ticking the last one keeps the region up while Undo is offered.
    await expect
      .element(page.getByRole("status").filter({ hasText: "Done: Refill Metformin" }))
      .toBeInTheDocument();
    await expect.poll(titles).toEqual([]);
    const patch = (await device.queued()).find((w) => w.op === "PATCH");
    expect(Object.keys(patch?.data ?? {}).sort()).toEqual(["done_at", "done_by"]);
  });

  test("hidden from a viewer when there are none", async () => {
    await open(`providers/${OTHER.id}`, "viewer");
    await expect
      .element(page.getByRole("heading", { name: "Corner Pharmacy", level: 1 }))
      .toBeInTheDocument();
    expect(document.querySelector("[data-linked-todos]")).toBeNull();
    expect(document.querySelector("[data-todo-quick-add]")).toBeNull();
  });

  test("a writer sees the section with only the quick add when there are none", async () => {
    await open(`providers/${OTHER.id}`);
    await expect.element(region().getByRole("textbox", { name: "New todo" })).toBeInTheDocument();
    expect(titles()).toEqual([]);
    expect(document.querySelector('[aria-label="Open todos"]')).toBeNull();
  });
});
