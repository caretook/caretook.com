import { waitUntil } from "../../../../../test/found";
import { describe, expect, test } from "vitest";
import { bandNames, bandsAlternate } from "../../../../../test/bands";
import { renderWithDevice } from "../../../../../test/device";
import { fx } from "../../../../../test/fixtures";
import { CORNERSTONE, directory, PROVIDER_ROUTES, providerUrl } from "../providers/providerWorld";

// The provider page in bands (ui-kit slice 6): the header band, then each
// part as a named band in today's order; a viewer sees the same parts as
// before (no visit prep, no Add todo) and no others, and a part with nothing
// to show (no conditions here) leaves no band.

const onPage = () => !!document.querySelector("main .ProseMirror") && !!document.querySelector("main h1");
const ZINC = fx.medication({ name: "Zinc", strength: "50 mg", pharmacyId: CORNERSTONE.id });
const open = (role: "caretaker" | "viewer", theme?: "light" | "dark") =>
  renderWithDevice({
    route: PROVIDER_ROUTES,
    url: providerUrl(CORNERSTONE.id),
    fixtures: [directory(), ZINC],
    role,
    theme,
  });

describe("the provider page's bands", () => {
  test("a writer's bands in order; no conditions, no band", async () => {
    await open("caretaker");
    await waitUntil(() => onPage() && bandNames().includes("Medications"), "the page");
    expect(bandNames()).toEqual([
      "(header)",
      "Contact",
      "Visits",
      "Todos",
      "Notes",
      "Linked entries",
      "Medications",
    ]);
    expect(document.querySelector("main [data-band] [data-todo-quick-add]")).toBeTruthy();
    expect(bandsAlternate()).toBe(true);
  });

  test.each(["light", "dark"] as const)(
    "a viewer sees the same parts, without visit prep or Add todo, still alternating (%s)",
    async (theme) => {
      await open("viewer", theme);
      await waitUntil(() => onPage() && bandNames().includes("Medications"), "the page");
      expect(bandNames()).toEqual(["(header)", "Contact", "Notes", "Linked entries", "Medications"]);
      expect(bandsAlternate()).toBe(true);
    },
  );
});
