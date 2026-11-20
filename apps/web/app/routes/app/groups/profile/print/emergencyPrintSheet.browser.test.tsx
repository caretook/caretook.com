import type { Fixtures } from "../../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as print from "./route";
import { renderWithDevice } from "../../../../../../test/device";
import { allergy, fx, TEST_GROUP } from "../../../../../../test/fixtures";

// The emergency sheet's allergies (quick-fixes slice 41, B-112): each one on
// file, worded as the printed medication sheets word them, or what the
// recipient's record says when there are none. The wording rules are unit
// tested (emergencyPrintSheet.test.ts, allergies.test.ts); the sheet's flow
// and print media are in emergencySheetPage.browser.test.tsx.

const PRINT = `/app/groups/${TEST_GROUP.id}/profile/print`;
const ROUTE = { path: "/app/groups/:groupId/profile/print", module: print };

const allergiesSection = () => page.getByRole("region", { name: "Allergies" });

const openSheet = (fixtures: Fixtures) =>
  renderWithDevice({ route: ROUTE, url: PRINT, role: "owner", fixtures });

describe("the emergency sheet's allergies", () => {
  test("lists each allergy on file, most severe first, with its reaction and severity", async () => {
    await openSheet([
      allergy({ substance: "Sulfa", reaction: "rash", severity: "mild" }),
      allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" }),
      allergy({ substance: "Latex", reaction: null, severity: "unknown" }),
      allergy({ substance: "Peanuts", deletedAt: "2026-11-01 10:00:00" }),
    ]);
    await expect.element(allergiesSection()).toBeVisible();
    const items = allergiesSection().getByRole("listitem");
    await expect
      .poll(() => items.elements().map((el) => el.textContent))
      .toEqual(["Penicillin (hives, severe)", "Sulfa (rash, mild)", "Latex"]);
    expect(items.elements()[0]).toHaveClass("font-semibold");
    expect(document.querySelector("[data-sheet-allergies-empty]")).toBeNull();
  });

  test("says No known allergies when that's recorded", async () => {
    await openSheet([fx.recipient({ noKnownAllergiesAt: "2026-11-01 10:00:00" })]);
    await expect.element(allergiesSection().getByText("No known allergies")).toBeVisible();
    expect(allergiesSection().getByRole("listitem").elements()).toHaveLength(0);
  });

  test("says Allergies not recorded when nothing is, so a blank is never read as none", async () => {
    await openSheet([]);
    await expect.element(allergiesSection().getByText("Allergies not recorded")).toBeVisible();
  });

  test("an allergy added on another device shows before it's printed", async () => {
    const device = await openSheet([]);
    await expect.element(allergiesSection().getByText("Allergies not recorded")).toBeVisible();
    await device.sync(allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" }));
    await expect.element(allergiesSection().getByText("Penicillin (hives, severe)")).toBeVisible();
  });
});
