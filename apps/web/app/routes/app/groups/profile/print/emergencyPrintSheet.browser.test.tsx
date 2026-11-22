import type { Fixtures } from "../../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as print from "./route";
import { renderWithDevice } from "../../../../../../test/device";
import { allergy, condition, fx, TEST_GROUP } from "../../../../../../test/fixtures";

// The emergency sheet's allergies and conditions (quick-fixes slice 41,
// B-112) from the device's copy, and a change arriving before it's printed.
// Their order, wording and the none / not recorded lines are unit tested
// (emergencyPrintSheet.test.ts, allergies.test.ts); the sheet's flow and print
// media are in emergencySheetPage.browser.test.tsx.

const PRINT = `/app/groups/${TEST_GROUP.id}/profile/print`;
const ROUTE = { path: "/app/groups/:groupId/profile/print", module: print };

const allergiesSection = () => page.getByRole("region", { name: "Allergies" });

const openSheet = (fixtures: Fixtures) =>
  renderWithDevice({ route: ROUTE, url: PRINT, role: "owner", fixtures });

describe("the emergency sheet's allergies and conditions", () => {
  const conditionsSection = () => page.getByRole("region", { name: "Conditions" });

  test("the device's allergies and active conditions are on the sheet", async () => {
    await openSheet([
      fx.recipient(),
      allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" }),
      condition({ name: "Type 2 diabetes", sinceYear: 2015, note: "diet-controlled" }),
    ]);
    await expect.element(allergiesSection().getByText("Penicillin (hives, severe)")).toBeVisible();
    await expect
      .element(conditionsSection().getByText("Type 2 diabetes (since 2015; diet-controlled)"))
      .toBeVisible();
  });

  test("an allergy added on another device shows before it's printed", async () => {
    const device = await openSheet([]);
    await expect.element(allergiesSection().getByText("Allergies not recorded")).toBeVisible();
    await device.sync(allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" }));
    await expect.element(allergiesSection().getByText("Penicillin (hives, severe)")).toBeVisible();
  });
});
