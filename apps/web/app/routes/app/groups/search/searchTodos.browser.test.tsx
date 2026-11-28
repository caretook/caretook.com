import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as searchRoute from "./route";
import * as todoRoute from "../todo/route";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, todo, TEST_GROUP, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { addDays, localDate } from "@caretook/data/domain";

// Todos on the search page (todos slice 5): a todo is found by its title
// and by its notes, sits after medications and before entries, is marked
// when done, opens its page, and drops out once deleted. What a document
// holds is `todoSearchDocument`'s unit test.

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/search", module: searchRoute },
  { path: "/app/groups/:groupId/todos/:todoId", module: todoRoute },
];
const searchUrl = (q: string, all?: string) =>
  `/app/groups/${TEST_GROUP.id}/search?q=${encodeURIComponent(q)}${all ? `&all=${all}` : ""}`;

const today = localDate(new Date(), TEST_TIME_ZONE);

const FORM = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d01",
  title: "Insurance form",
  dueOn: addDays(today, 1),
});
const FORM_NOTES = fx.document({
  ownerId: FORM.id,
  subject: "todo",
  text: "Ask the front desk at Valley Heart Clinic for the claim number.",
});
const FAX = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d02",
  title: "Fax the referral",
  doneAt: at(new Date(Date.now() - 3_600_000)),
});
const GONE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d03",
  title: "Insurance card copy",
  deletedAt: hoursAgo(2),
});
const world = () => [
  FORM,
  FORM_NOTES,
  FAX,
  GONE,
  fx.medication({ name: "Metformin", reason: "Insurance covers the generic" }),
  fx.note({ text: "Called about the insurance" }),
];

const open = (url: string, fixtures = world()) =>
  renderWithDevice({ route: ROUTES, url, fixtures, search: true });

const sectionOrder = () =>
  [...document.querySelectorAll<HTMLElement>("[data-section]")].map((s) => s.dataset.section);
const todoResults = () =>
  [...document.querySelectorAll<HTMLElement>('[data-result="todo"]')].map((r) => r.dataset.resultId);
const result = (id: string) => document.querySelector<HTMLElement>(`[data-result-id="${id}"]`);

describe("search: todos", () => {
  test("a todo matches by title, after medications and before entries", async () => {
    await open(searchUrl("insurance"));
    await expect.poll(sectionOrder).toEqual(["medication", "todo", "entry"]);
    // The deleted "Insurance card copy" has no document.
    expect(todoResults()).toEqual([FORM.id]);
    await expect.element(page.getByRole("heading", { name: /Todos/ })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Insurance form" })).toBeVisible();
    expect(result(FORM.id)?.textContent).toContain("Due tomorrow");
    expect(result(FORM.id)?.hasAttribute("data-done")).toBe(false);
    expect(document.querySelector("[data-search-status]")?.textContent).toBe(
      "1 medication, 1 todo and 1 entry",
    );
  });

  test("a todo matches by its notes, with a line from them", async () => {
    await open(searchUrl("claim number"));
    await expect.poll(todoResults).toEqual([FORM.id]);
    const snippet = result(FORM.id)?.querySelector("[data-snippet]");
    expect(snippet?.textContent).toContain("claim number");
    expect(snippet?.querySelectorAll("mark")).toHaveLength(2);
  });

  test("a done todo is marked", async () => {
    await open(searchUrl("referral"));
    await expect.poll(todoResults).toEqual([FAX.id]);
    const row = result(FAX.id)!;
    expect(row.hasAttribute("data-done")).toBe(true);
    expect(row.querySelector("[data-marker]")?.textContent).toBe("Done");
    expect(row.textContent).not.toContain("Due");
  });

  test("a result opens the todo's page", async () => {
    const device = await open(searchUrl("insurance"));
    await expect.poll(todoResults).toEqual([FORM.id]);
    await userEvent.click(page.getByRole("link", { name: "Insurance form" }));
    await expect.poll(device.location).toBe(`/app/groups/${TEST_GROUP.id}/todos/${FORM.id}`);
    await expect.element(page.getByRole("heading", { name: "Insurance form" })).toBeVisible();
  });

  test("a todo that arrives, is renamed or is deleted is followed (the index's triggers)", async () => {
    const device = await open(searchUrl("pharmacy"));
    await expect
      .poll(() => document.querySelector("[data-search-status]")?.textContent)
      .toMatch(/No matches/);
    const id = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d04";
    await device.sync(todo({ id, title: "Call the pharmacy" }));
    await expect.poll(todoResults).toEqual([id]);
    await device.sync(todo({ id, title: "Phone the pharmacy" }));
    await expect.element(page.getByRole("link", { name: "Phone the pharmacy" })).toBeVisible();
    await device.sync(todo({ id, title: "Phone the pharmacy", deletedAt: hoursAgo(0) }));
    await expect.poll(todoResults).toEqual([]);
  });

  test("?all=todo shows the todos in full", async () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      todo({ id: `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7e0${i}`, title: `Refill form ${i + 1}` }),
    );
    await open(searchUrl("refill"), many);
    await expect.poll(() => todoResults().length).toBe(5);
    await expect.element(page.getByRole("link", { name: /Show all 7/ })).toBeVisible();
    await userEvent.click(page.getByRole("link", { name: /Show all 7/ }));
    await expect.poll(() => todoResults().length).toBe(7);
    await expect.element(page.getByRole("link", { name: /Show fewer/ })).toBeVisible();
  });
});
