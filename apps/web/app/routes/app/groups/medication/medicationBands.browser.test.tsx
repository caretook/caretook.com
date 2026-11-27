import { waitUntil } from "../../../../../test/found";
import { describe, expect, test } from "vitest";
import { bandNames, bandsAlternate } from "../../../../../test/bands";
import { renderWithDevice } from "../../../../../test/device";
import { todo } from "../../../../../test/fixtures";
import {
  LISINOPRIL,
  MEDICATION_ROUTES,
  medicationUrl,
  OXYBUTYNIN,
  world,
} from "../medications/medicationWorld";

// The medication page in bands (ui-kit slice 6): the header band, then each
// part as a named band in today's order; a viewer sees the same parts as
// before and no others, and a part with nothing to show leaves no band.

const onPage = () => !!document.querySelector("main .ProseMirror") && !!document.querySelector("main h1");
const PARTS = ["Allergies", "Details", "Prescriber and pharmacy", "Refills"];

describe("the medication page's bands", () => {
  test("a writer's bands in order, the linked todos a band of their own", async () => {
    await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: medicationUrl(LISINOPRIL.id),
      fixtures: [world(), todo({ title: "Ask about the refill", medicationId: LISINOPRIL.id })],
      role: "caretaker",
    });
    await waitUntil(onPage, "the page");
    await waitUntil(() => bandNames().includes("Todos"), "the todos");
    expect(bandNames()).toEqual(["(header)", ...PARTS, "Todos", "Notes", "History"]);
    expect(bandsAlternate()).toBe(true);
  });

  test("a writer with no linked todos keeps the Todos band with its quick add", async () => {
    await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: medicationUrl(LISINOPRIL.id),
      fixtures: world(),
    });
    await waitUntil(onPage, "the page");
    expect(bandNames()).toEqual(["(header)", ...PARTS, "Todos", "Notes", "History"]);
    expect(document.querySelector("main [data-band] [data-todo-quick-add]")).toBeTruthy();
  });

  test.each(["light", "dark"] as const)(
    "a viewer sees the same parts with no todos band, and the rest still alternate (%s)",
    async (theme) => {
      await renderWithDevice({
        route: MEDICATION_ROUTES,
        url: medicationUrl(OXYBUTYNIN.id),
        fixtures: world(),
        role: "viewer",
        theme,
      });
      await waitUntil(onPage, "the page");
      expect(bandNames()).toEqual(["(header)", ...PARTS, "Notes", "History"]);
      expect(bandsAlternate()).toBe(true);
    },
  );

  test("at 420 px no band scrolls the page sideways", async () => {
    await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: medicationUrl(LISINOPRIL.id),
      fixtures: world(),
      width: 420,
    });
    await waitUntil(onPage, "the page");
    const root = document.documentElement;
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    for (const band of document.querySelectorAll("main [data-band]")) {
      expect(band.getBoundingClientRect().right).toBeLessThanOrEqual(root.clientWidth + 0.5);
    }
  });
});
