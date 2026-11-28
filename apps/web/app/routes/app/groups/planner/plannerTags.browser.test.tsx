import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { found, waitUntil } from "../../../../../test/found";
import {
  at,
  fx,
  recordTag,
  tag,
  TEST_GROUP,
  TEST_TIME_ZONE,
  TEST_USER,
  todo,
} from "../../../../../test/fixtures";
import { PLANNER_ROUTES } from "./plannerWorld";
import { addDays, localDate } from "@caretook/data/domain";

// Tags on todos and the Planner (tags slice 4): a writer tags a todo from
// its page's Add tag (`QuickTags`), and from the Todos and Planner rows
// without opening them (tags-3: the Planner's ⋯ has no Tags); a viewer who may tick it sees its chips and no tag control;
// `?tag=` narrows the Todos tab and Upcoming's events and todos (and is
// carried to Past as a chip), survives a reload, and a deleted tag reads as
// no filter. The filter options are unit tests (`todoFilters`,
// `upcomingFilters`, `lib/tags/tagFilter`).

const GROUP = TEST_GROUP.id;
const TODOS = `/app/groups/${GROUP}/todos`;
const PLANNER = `/app/groups/${GROUP}/planner`;
const today = localDate(new Date(), TEST_TIME_ZONE);
const inDays = (n: number) => at(new Date(Date.now() + n * 86_400_000));

const URGENT = tag("Urgent");
const MOVE = tag("Care home move");
const PHARMACY = todo({
  id: "4b3e7d10-6a2c-4f1e-9b7d-2c8e5a1f0a01",
  title: "Call the pharmacy",
  dueOn: addDays(today, 1),
  assigneeId: TEST_USER.id,
});
const FORMS = todo({
  id: "4b3e7d10-6a2c-4f1e-9b7d-2c8e5a1f0a02",
  title: "Sign the move-in forms",
  dueOn: addDays(today, 2),
});
const VISIT = fx.event({ title: "Tour Maple House", occurredAt: inDays(3) });
const DENTIST = fx.event({ title: "Dentist", occurredAt: inDays(4) });
const PAST_VISIT = fx.event({ title: "First visit to Maple House", occurredAt: inDays(-3) });
const PAST_CHECK = fx.event({ title: "Eye check", occurredAt: inDays(-4) });
const world = () => [
  URGENT,
  MOVE,
  PHARMACY,
  FORMS,
  VISIT,
  DENTIST,
  PAST_VISIT,
  PAST_CHECK,
  recordTag(URGENT.id, PHARMACY.id, "todoId"),
  recordTag(MOVE.id, FORMS.id, "todoId"),
  recordTag(MOVE.id, VISIT.id),
  recordTag(MOVE.id, PAST_VISIT.id),
];

const open = (url: string, role: GroupRole = "owner") =>
  renderWithDevice({ route: PLANNER_ROUTES, url, role, fixtures: world() });

const chipsIn = (root: Element | null | undefined) =>
  [...(root?.querySelectorAll("[data-tag-chip]") ?? [])].map((c) => c.textContent?.trim()).join(",");
const headerChips = () => chipsIn(document.querySelector("main header [data-todo-tags]"));
const todoRows = () =>
  [...document.querySelectorAll<HTMLElement>("main [data-todo]")].map((r) => r.dataset.todo);
const plannerRows = () =>
  [...document.querySelectorAll<HTMLElement>("main [data-upcoming-item], main [data-planner-todo]")].map(
    (r) => r.dataset.upcomingItem ?? r.dataset.plannerTodo,
  );
const filterButton = () => page.getByRole("button", { name: /^Filter(, \d+ on)?$/ });
const choose = async (option: string) => {
  await expect.element(filterButton()).toBeVisible();
  await userEvent.click(filterButton());
  await userEvent.click(page.getByRole("menuitemradio", { name: option, exact: true }));
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
};
const filterChips = () =>
  [...document.querySelectorAll<HTMLAnchorElement>('main nav[aria-label="Filters on"] a')].map((a) =>
    a.textContent?.trim(),
  );

describe("tags on a todo", () => {
  test("a writer tags a todo from its page's Add tag; its chips follow, and the Todos row shows them", async () => {
    const device = await open(`${TODOS}/${PHARMACY.id}`);
    await expect.poll(headerChips).toBe("Urgent");
    await userEvent.click(page.getByRole("button", { name: "Add tag" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Care home move" }));
    await device.settle();
    await expect.poll(headerChips).toBe("Care home move,Urgent");
    expect(await device.query("SELECT tag_id FROM record_tag WHERE todo_id = ?", [PHARMACY.id])).toHaveLength(
      2,
    );

    // Back on the list (the same device), the row has both.
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    await userEvent.click(
      await found(() => document.querySelector<HTMLAnchorElement>(`main a[href="${TODOS}"]`)),
    );
    await expect
      .poll(() => chipsIn(document.querySelector(`main [data-todo="${PHARMACY.id}"]`)))
      .toBe("Care home move,Urgent");
  });

  test("a viewer who may tick their todo sees its chips and no tag control", async () => {
    await open(`${TODOS}/${PHARMACY.id}`, "viewer");
    await expect.poll(headerChips).toBe("Urgent");
    // They may tick it…
    await expect
      .poll(() =>
        [...document.querySelectorAll("main button")].map(
          (b) => b.getAttribute("aria-label") ?? b.textContent?.trim(),
        ),
      )
      .toContain("Mark “Call the pharmacy” done");
    // …but there's no ⋯ and no tag control for them.
    expect(document.querySelector('main header button[aria-label^="Actions for"]')).toBeNull();
    expect(document.querySelectorAll("main header [data-todo-tags] button")).toHaveLength(0);
    expect(document.querySelector("[data-tag-picker]")).toBeNull();
  });
});

describe("?tag= on the Todos tab", () => {
  test("narrows the list, survives a reload, and a deleted tag reads as no filter", async () => {
    const first = await open(TODOS);
    await expect.poll(todoRows).toEqual([PHARMACY.id, FORMS.id]);
    await choose("Care home move");
    await expect.poll(() => first.location()).toBe(`${TODOS}?tag=${MOVE.id}`);
    await expect.poll(todoRows).toEqual([FORMS.id]);
    await expect.poll(filterChips).toEqual(["Care home move"]);

    await first.screen.unmount();
    const device = await open(`${TODOS}?tag=${MOVE.id}`);
    await expect.poll(todoRows).toEqual([FORMS.id]);

    // The tag is deleted elsewhere: the list is unfiltered and the chip goes.
    await device.unsync([MOVE]);
    await device.settle();
    await expect.poll(todoRows).toEqual([PHARMACY.id, FORMS.id]);
    await expect.poll(filterChips).toEqual([]);
  });
});

describe("?tag= on the Planner", () => {
  test("narrows Upcoming's events and todos, survives a reload, and is carried to Past as a chip", async () => {
    const first = await open(PLANNER);
    await waitUntil(() => plannerRows().length === 4, "Upcoming's rows");
    await choose("Care home move");
    await expect.poll(() => first.location()).toBe(`${PLANNER}?tag=${MOVE.id}`);
    await expect.poll(plannerRows).toEqual([FORMS.id, VISIT.id]);
    // Chips on both kinds of row.
    expect(chipsIn(document.querySelector(`main [data-upcoming-item="${VISIT.id}"]`))).toBe("Care home move");
    expect(chipsIn(document.querySelector(`main [data-planner-todo="${FORMS.id}"]`))).toBe("Care home move");

    await first.screen.unmount();
    const device = await open(`${PLANNER}?tag=${MOVE.id}`);
    await expect.poll(plannerRows).toEqual([FORMS.id, VISIT.id]);

    await userEvent.click(page.getByRole("link", { name: "Past" }));
    await expect.poll(() => device.location()).toBe(`${PLANNER}/past?tag=${MOVE.id}`);
    await expect.poll(plannerRows).toEqual([PAST_VISIT.id]);
    await expect.poll(filterChips).toEqual(["Care home move"]);
  });

  test("a deleted tag reads as no filter", async () => {
    const device = await open(`${PLANNER}?tag=${MOVE.id}`);
    await expect.poll(plannerRows).toEqual([FORMS.id, VISIT.id]);
    await device.unsync([MOVE]);
    await device.settle();
    await expect.poll(plannerRows).toEqual([PHARMACY.id, FORMS.id, VISIT.id, DENTIST.id]);
    await expect.poll(filterChips).toEqual([]);
  });

  test("a writer tags and untags an event's row without opening it; a tap beside the chips opens it; ⋯ has no Tags", async () => {
    const device = await open(PLANNER);
    const row = `main [data-upcoming-item="${DENTIST.id}"]`;
    await found(() => document.querySelector(row));
    await userEvent.click(page.getByCss(row).getByRole("button", { name: "Add tag" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Urgent" }));
    await device.settle();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector("[data-tag-picker]")).toBeNull();
    await expect.poll(() => chipsIn(document.querySelector(row))).toBe("Urgent");
    expect(device.location()).toBe(PLANNER);

    await userEvent.click(page.getByCss(row).getByRole("button", { name: "Remove tag Urgent" }));
    await device.settle();
    await expect.poll(() => chipsIn(document.querySelector(row))).toBe("");
    expect(await device.query("SELECT id FROM record_tag WHERE entry_id = ?", [DENTIST.id])).toEqual([]);
    expect(device.location()).toBe(PLANNER);

    // Beside a row's chips is still the row's open target.
    const visit = document.querySelector<HTMLElement>(`main [data-upcoming-item="${VISIT.id}"]`)!;
    const line = visit.querySelector<HTMLElement>("[data-quick-tags]")!.getBoundingClientRect();
    const opener = visit.querySelector('a[aria-label^="Open "]');
    expect(document.elementFromPoint(line.right + 12, line.top + line.height / 2)).toBe(opener);

    await userEvent.click(
      await found(() =>
        document.querySelector<HTMLButtonElement>(`${row} button[aria-label^="Actions for"]`),
      ),
    );
    await waitUntil(() => document.querySelectorAll("[role=menuitem]").length > 0, "the menu");
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).not.toContain(
      "Tags",
    );
  });

  test("a writer untags a todo's card with one tap and Undo puts it back; the Todos row tags too", async () => {
    const device = await open(PLANNER);
    const card = `main [data-planner-todo="${FORMS.id}"]`;
    await expect.poll(() => chipsIn(document.querySelector(card))).toBe("Care home move");
    await userEvent.click(page.getByCss(card).getByRole("button", { name: "Remove tag Care home move" }));
    await device.settle();
    await expect.poll(() => chipsIn(document.querySelector(card))).toBe("");
    const toast = page.getByRole("alertdialog", { name: "Removed Care home move" });
    await userEvent.click(toast.getByRole("button", { name: "Undo" }));
    await device.settle();
    await expect.poll(() => chipsIn(document.querySelector(card))).toBe("Care home move");
    expect(await device.query("SELECT tag_id FROM record_tag WHERE todo_id = ?", [FORMS.id])).toEqual([
      { tag_id: MOVE.id },
    ]);
    expect(device.location()).toBe(PLANNER);
    await device.screen.unmount();

    const todos = await open(TODOS);
    const row = `main [data-todo="${PHARMACY.id}"]`;
    await found(() => document.querySelector(row));
    await userEvent.click(page.getByCss(row).getByRole("button", { name: "Add tag" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Care home move" }));
    await todos.settle();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => chipsIn(document.querySelector(row))).toBe("Care home move,Urgent");
    expect(todos.location()).toBe(TODOS);
  });

  test("a viewer sees the rows' chips with no × or Add tag, and no Tags in ⋯", async () => {
    await open(PLANNER, "viewer");
    const visit = `main [data-upcoming-item="${VISIT.id}"]`;
    await expect.poll(() => chipsIn(document.querySelector(visit))).toBe("Care home move");
    expect(chipsIn(document.querySelector(`main [data-planner-todo="${FORMS.id}"]`))).toBe("Care home move");
    expect(document.querySelector("main [data-tag-remove], main [data-quick-tag-add]")).toBeNull();
    await userEvent.click(
      await found(() =>
        document.querySelector<HTMLButtonElement>(
          `main [data-upcoming-item="${DENTIST.id}"] button[aria-label^="Actions for"]`,
        ),
      ),
    );
    await waitUntil(() => document.querySelectorAll("[role=menuitem]").length > 0, "the menu");
    expect([...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim())).not.toContain(
      "Tags",
    );
  });
});
