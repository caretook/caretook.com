import { describe, expect, test } from "vitest";
import { bandNames, bandsAlternate } from "../../../../../test/bands";
import { renderWithDevice } from "../../../../../test/device";
import { HOME_NOW, HOSPITAL, PERIOD_ROUTES, periodUrl, track, waitUntil } from "../periods/periodWorld";

// The care period page in bands (ui-kit slice 6): the header band, then
// each part as a named band in today's order; a viewer sees the same parts
// (only the actions differ), and a part with nothing to show (no place at
// home) leaves no band.

const onPage = (id: string) => () =>
  !!document.querySelector(`main[data-period-page="${id}"]`) && !!document.querySelector("main .ProseMirror");

describe("the care period page's bands", () => {
  test("a writer's bands in order", async () => {
    await renderWithDevice({ route: PERIOD_ROUTES, url: periodUrl(HOSPITAL.id), fixtures: track() });
    await waitUntil(onPage(HOSPITAL.id), 4000, "the page");
    expect(bandNames()).toEqual(["(header)", "Dates", "Place", "Notes", "Other care periods"]);
    expect(bandsAlternate()).toBe(true);
  });

  test.each(["light", "dark"] as const)(
    "a viewer on a period with no place: no Place band, the rest still alternate (%s)",
    async (theme) => {
      await renderWithDevice({
        route: PERIOD_ROUTES,
        url: periodUrl(HOME_NOW.id),
        fixtures: track(),
        role: "viewer",
        theme,
      });
      await waitUntil(onPage(HOME_NOW.id), 4000, "the page");
      expect(bandNames()).toEqual(["(header)", "Dates", "Notes", "Other care periods"]);
      expect(bandsAlternate()).toBe(true);
    },
  );
});
