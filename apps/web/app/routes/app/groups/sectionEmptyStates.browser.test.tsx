import type { AccentedSection } from "~/lib/app-shell/sectionAccents";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { accentClass } from "~/components/ui";
import { sectionAccent } from "~/lib/app-shell/sectionAccents";
import { rgba } from "../../../../test/contrast";
import { renderWithDevice } from "../../../../test/device";
import { at, TEST_USER, todo } from "../../../../test/fixtures";
import { found } from "../../../../test/found";
import { LIST, MEDICATION_ROUTES, PASSES } from "./medications/medicationWorld";
import { PERIOD_ROUTES, PERIODS_URL } from "./periods/periodWorld";
import { PLANNER_ROUTES, PLANNER_URL, TODOS_URL } from "./planner/plannerWorld";
import { PROVIDER_ROUTES, PROVIDERS_URL } from "./providers/providerWorld";
import { chooseEasyMode, openTimeline } from "./timeline/timelineWorld";

// Each accented section's main list with nothing in it: the section's icon in
// a soft circle above its existing words. A filtered list and Easy mode stay
// quiet. The circle is compared by its painted colour.

// `EmptyState`'s circle: the chip in the row right above its line. The screens
// share no hook for it. A page header with a description has the same shape,
// so anything inside a `header` is left out.
const chip = () =>
  document.querySelector<HTMLElement>(
    "main div:not(header *):has(> [data-icon-chip]):has(+ p) > [data-icon-chip]",
  );

/** What the section's soft chip paints, measured from a probe with the same classes. */
const softFill = (section: AccentedSection) => {
  const mark = sectionAccent(section, { easy: false })!;
  const probe = document.createElement("span");
  probe.className = accentClass(mark.accent, "soft");
  document.body.append(probe);
  const fill = rgba(getComputedStyle(probe).backgroundColor);
  probe.remove();
  return fill;
};

const expectCircle = async (section: AccentedSection) => {
  const circle = await found(chip);
  expect(circle.getAttribute("aria-hidden")).toBe("true");
  expect(rgba(getComputedStyle(circle).backgroundColor)).toEqual(softFill(section));
};

describe("a section with nothing in it", () => {
  test.each([
    ["Providers", "providers", PROVIDER_ROUTES, PROVIDERS_URL, "No providers yet."],
    ["the Medications list", "medications", MEDICATION_ROUTES, LIST, "No medications yet."],
    ["Passes", "medications", MEDICATION_ROUTES, PASSES, "No passes yet."],
    ["the Planner", "planner", PLANNER_ROUTES, PLANNER_URL, "No upcoming events or todos."],
    ["Todos", "planner", PLANNER_ROUTES, TODOS_URL, "No open todos."],
  ] as const)("%s shows its icon circle and its words", async (_name, section, route, url, words) => {
    await renderWithDevice({ route: [...route], url, fixtures: [] });
    await expect.element(page.getByText(words)).toBeVisible();
    await expectCircle(section);
  });

  test("Care periods shows its circle, and a writer keeps the header's add", async () => {
    await renderWithDevice({ route: PERIOD_ROUTES, url: PERIODS_URL, fixtures: [] });
    await expect.element(page.getByText(/^No care periods yet\./)).toBeVisible();
    await expectCircle("periods");
    await expect.element(page.getByRole("link", { name: "Add period" })).toBeVisible();
  });

  test("the timeline shows its circle, and a writer keeps Add an entry", async () => {
    await openTimeline({ role: "caretaker", fixtures: [] });
    await expect.element(page.getByText("Nothing logged today yet.")).toBeVisible();
    await expectCircle("timeline");
    await expect.element(page.getByRole("button", { name: "Add an entry" })).toBeVisible();
  });

  test("a viewer's empty timeline shows the circle too", async () => {
    await openTimeline({ role: "viewer", fixtures: [] });
    await found(() => document.querySelector("[data-empty]"));
    await expectCircle("timeline");
  });
});

describe("what stays quiet", () => {
  test("a filtered timeline shows its line and no circle", async () => {
    await openTimeline({ role: "viewer", fixtures: [], query: "?kind=symptom" });
    await found(() => document.querySelector("[data-empty]"));
    expect(chip()).toBeNull();
  });

  test("a filtered Todos list shows its line and no circle", async () => {
    await renderWithDevice({ route: PLANNER_ROUTES, url: `${TODOS_URL}?who=mine`, fixtures: [] });
    await expect.element(page.getByText("Nothing assigned to you.")).toBeVisible();
    expect(chip()).toBeNull();
  });

  test("Todos with only Done ones shows its line and no circle", async () => {
    const finished = todo({ title: "Refill the pill box", doneAt: at(), doneBy: TEST_USER.id });
    await renderWithDevice({ route: PLANNER_ROUTES, url: TODOS_URL, fixtures: [finished] });
    await expect.element(page.getByText("Refill the pill box")).toBeVisible();
    await expect.element(page.getByText("No open todos.")).toBeVisible();
    expect(chip()).toBeNull();
  });

  test("the timeline in Easy mode has no accent", async () => {
    chooseEasyMode();
    await openTimeline({ role: "caretaker", fixtures: [] });
    const empty = await found(() => document.querySelector("[data-easy-list] [data-empty]"));
    // The easy view's tiles above the list have chips of their own.
    expect(empty.querySelector("[data-icon-chip]")).toBeNull();
    expect(document.querySelector("[data-easy-list] [data-icon-chip]")).toBeNull();
  });

  test("the Planner for an easy role has no accent", async () => {
    await renderWithDevice({ route: PLANNER_ROUTES, url: PLANNER_URL, role: "easy_viewer", fixtures: [] });
    await expect.element(page.getByText("No upcoming events or todos.")).toBeVisible();
    expect(chip()).toBeNull();
  });
});
