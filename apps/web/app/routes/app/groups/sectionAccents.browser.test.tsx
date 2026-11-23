import type { Accent } from "~/components/ui/accents";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { accentClass } from "~/components/ui/accents";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { LIST, MEDICATION_ROUTES, world as medicationWorld } from "./medications/medicationWorld";
import { PERIOD_ROUTES, PERIODS_URL } from "./periods/periodWorld";
import { openPlanner } from "./planner/plannerWorld";
import { directory, PROVIDER_ROUTES, PROVIDERS_URL } from "./providers/providerWorld";
import { chooseEasyMode, openTimeline } from "./timeline/timelineWorld";

// Each section's colour as its page paints it: the chip before the title and,
// on Medications and the Planner, the current tab. Compared with the accent's
// own fill as the browser computes it, never a class name.

const chip = () => document.querySelector<HTMLElement>("main header [data-icon-chip]");

/** The fill the kit gives an accent's soft look, as the browser paints it. */
const softFill = (accent: Accent) => {
  const probe = document.createElement("span");
  probe.className = accentClass(accent, "soft");
  document.body.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
};

const expectChip = async (accent: Accent) => {
  const box = await found(chip);
  expect(getComputedStyle(box).backgroundColor).toBe(softFill(accent));
};

const expectCurrentTab = async (nav: string, accent: Accent) => {
  const current = await found(() =>
    document.querySelector<HTMLElement>(`nav[aria-label="${nav}"] a[aria-current="page"]`),
  );
  expect(getComputedStyle(current).backgroundColor).toBe(softFill(accent));
};

describe("each section's chip", () => {
  test("Timeline is indigo", async () => {
    await openTimeline();
    await expectChip("indigo");
  });

  test("Providers is lime", async () => {
    await renderWithDevice({ route: PROVIDER_ROUTES, url: PROVIDERS_URL, fixtures: directory() });
    await expectChip("lime");
  });

  test("Medications is teal, and so is its current tab", async () => {
    await renderWithDevice({ route: MEDICATION_ROUTES, url: LIST, fixtures: [medicationWorld()] });
    await expectChip("teal");
    await expectCurrentTab("Medications tabs", "teal");
  });

  test("the Planner is orange, and so is its current tab", async () => {
    await openPlanner({ role: "caretaker" });
    await expectChip("orange");
    await expectCurrentTab("Planner or todos", "orange");
  });

  test("Care periods is plum", async () => {
    await renderWithDevice({ route: PERIOD_ROUTES, url: PERIODS_URL, fixtures: [] });
    await expectChip("plum");
  });
});

describe("Easy stays neutral", () => {
  test("the timeline in Easy mode has no chip", async () => {
    chooseEasyMode();
    await openTimeline();
    await found(() => document.querySelector("[data-easy-timeline]"));
    expect(chip()).toBeNull();
  });

  test("the Planner for an easy role has no chip and no tabs", async () => {
    await openPlanner({ role: "easy_helper" });
    await expect.element(page.getByRole("heading", { level: 1, name: "Planner" })).toBeVisible();
    expect(chip()).toBeNull();
    expect(document.querySelector('nav[aria-label="Planner or todos"]')).toBeNull();
  });
});
