import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { todo } from "../../../../../test/fixtures";
import { fixClock } from "../../../../../test/found";
import { NOW, openPlanner, PAST_URL, PLANNER_URL, TODOS_URL } from "./plannerWorld";

// The Planner's Add > Todo from Upcoming or Past (B-689): a save always lands
// on the Todos tab, showing the new todo; Cancel and Escape go back to the
// tab it was opened from. Other openers of the sheet (a todo's page here)
// still come back where they were after a save.

const addButton = () => page.getByRole("button", { name: "Add", exact: true });
const sheet = () => page.getByRole("dialog", { name: "Add a todo" });
const tabCurrent = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('main nav[aria-label="Upcoming, past or todos"] a')]
    .find((a) => a.textContent?.trim() === label)
    ?.getAttribute("aria-current");
const undatedTitles = () =>
  [...document.querySelectorAll('[data-todo-section="undated"] [data-todo-title]')].map((el) =>
    el.textContent?.trim(),
  );

const openAddTodo = async () => {
  await userEvent.click(addButton());
  await userEvent.click(page.getByRole("menuitem", { name: "Todo" }));
  await expect.element(sheet()).toBeInTheDocument();
};

beforeEach(() => fixClock(NOW));
afterEach(() => {
  vi.useRealTimers();
});

describe("Add > Todo from the Planner", () => {
  for (const [name, url] of [
    ["Upcoming", PLANNER_URL],
    ["Past", PAST_URL],
  ] as const) {
    test(`from ${name}, a save lands on Todos with the new todo`, async () => {
      const device = await openPlanner({ role: "caretaker", url });
      await openAddTodo();
      await userEvent.fill(sheet().getByRole("textbox", { name: "Todo" }), `Order the ${name} refill`);
      await userEvent.click(sheet().getByRole("button", { name: "Add todo" }));
      await expect.poll(() => device.location()).toBe(TODOS_URL);
      await expect.poll(undatedTitles).toContain(`Order the ${name} refill`);
      expect(tabCurrent("Todos")).toBe("page");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    test(`from ${name}, Cancel and Escape go back to ${name}`, async () => {
      const device = await openPlanner({ role: "caretaker", url });
      await openAddTodo();
      await userEvent.click(sheet().getByRole("button", { name: "Cancel" }));
      await expect.poll(() => device.location()).toBe(url);
      await expect.poll(() => tabCurrent(name)).toBe("page");
      await openAddTodo();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => device.location()).toBe(url);
      await expect.poll(() => tabCurrent(name)).toBe("page");
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
  }

  test("a todo's page Edit still comes back to the page after a save", async () => {
    const t = todo({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d41", title: "Refill the pill box" });
    const pageUrl = `${TODOS_URL}/${t.id}`;
    const device = await openPlanner({ role: "caretaker", url: pageUrl, extra: [t] });
    // Edit lives in the header's ⋯ (B-1022).
    await userEvent.click(page.getByRole("button", { name: "Actions for Refill the pill box" }));
    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    const edit = page.getByRole("dialog", { name: "Edit todo" });
    await expect.element(edit).toBeInTheDocument();
    await userEvent.fill(edit.getByRole("textbox", { name: "Todo" }), "Refill the weekly pill box");
    await userEvent.click(edit.getByRole("button", { name: "Save" }));
    await expect.poll(() => device.location()).toBe(pageUrl);
    await expect
      .element(page.getByRole("heading", { name: "Refill the weekly pill box", level: 1 }))
      .toBeInTheDocument();
  });
});
