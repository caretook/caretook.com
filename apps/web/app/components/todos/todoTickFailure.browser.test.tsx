import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { TEST_GROUP, todo } from "../../../test/fixtures";
import { getSync } from "~/lib/sync";
import { clearTodoUndo } from "~/lib/todos/todoUndo";
import * as todosRoute from "../../routes/app/groups/todos/route";

// A tick or Undo whose local write throws (B-527): the person is told, no
// rejection goes unhandled, and the todo stays as it really is.

const TITLE = "Call the pharmacy";
const ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fb001";
const FAILED = "Couldn't save that. Try again.";

const open = () =>
  renderWithDevice({
    route: { path: "/app/groups/:groupId/todos", module: todosRoute },
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    fixtures: [todo({ id: ID, title: TITLE })],
  });

const doneAt = async (device: Awaited<ReturnType<typeof open>>) =>
  (await device.query<{ done_at: string | null }>("SELECT done_at FROM todo WHERE id = ?", [ID]))[0]?.done_at;

const failNextWrite = () =>
  vi.spyOn(getSync().drizzle, "transaction").mockRejectedValueOnce(new Error("disk I/O error"));

const unhandled: unknown[] = [];
const onUnhandled = (event: PromiseRejectionEvent) => {
  unhandled.push(event.reason);
  event.preventDefault();
};

beforeEach(() => {
  unhandled.length = 0;
  window.addEventListener("unhandledrejection", onUnhandled);
  // The hook logs what it caught; keep the expected error out of the output.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  window.removeEventListener("unhandledrejection", onUnhandled);
  vi.restoreAllMocks();
  clearTodoUndo();
});

describe("a todo write that throws", () => {
  test("a failed Done says so, offers no Undo and leaves the todo open", async () => {
    const device = await open();
    failNextWrite();

    await userEvent.click(page.getByRole("checkbox", { name: `Mark “${TITLE}” done` }));

    await expect.element(page.getByText(FAILED)).toBeInTheDocument();
    await device.settle();
    expect(await doneAt(device)).toBeNull();
    await expect.element(page.getByRole("checkbox", { name: `Mark “${TITLE}” done` })).not.toBeChecked();
    await expect.element(page.getByRole("button", { name: `Undo ${TITLE}` })).not.toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  test("a failed Undo says so, keeps its Undo and leaves the todo done", async () => {
    const device = await open();
    await userEvent.click(page.getByRole("checkbox", { name: `Mark “${TITLE}” done` }));
    const undo = page.getByRole("button", { name: `Undo ${TITLE}` });
    await expect.element(undo).toBeInTheDocument();
    await device.settle();
    failNextWrite();

    await userEvent.click(undo);

    await expect.element(page.getByText(FAILED)).toBeInTheDocument();
    await device.settle();
    expect(await doneAt(device)).not.toBeNull();
    await expect.element(undo).toBeEnabled();
    expect(unhandled).toEqual([]);
  });
});
