import { describe, expect, test } from "vitest";
import { bandNames, bandsAlternate } from "../../../../../test/bands";
import { fx, hoursAgo } from "../../../../../test/fixtures";
import { $, openProfile } from "./profileWorld";

// The profile in bands (ui-kit slice 7): the header band, then each section
// as a named band in today's order. A viewer sees the sections they saw
// before and the "more details" line, and the bands still alternate with the
// writers' sections absent. No card surfaces are left on the page.

const PULSE = fx.vital({ occurredAt: hoursAgo(2), readings: [{ type: "heartRate", value: 72 }] });
const onPage = () => !!$("main[data-bands] [data-profile-header] h1");

describe("the profile's bands", () => {
  test("an owner's bands in order, with no cards", async () => {
    await openProfile({ fixtures: [PULSE] });
    await expect.poll(() => onPage() && bandNames().includes("Emergency contacts")).toBe(true);
    expect(bandNames()).toEqual([
      "(header)",
      "Basics",
      "Conditions",
      "Note for helpers",
      "Recent vital averages",
      "Contact",
      "Insurance",
      "Emergency contacts",
    ]);
    expect(bandsAlternate()).toBe(true);
    expect(document.querySelector("main .card, main [class~=card]")).toBeNull();
  });

  test.each(["light", "dark"] as const)(
    "a viewer sees their sections and the more-details line, still alternating (%s)",
    async (theme) => {
      await openProfile({ role: "viewer", theme });
      await expect.poll(() => onPage() && bandNames().includes("Note for helpers")).toBe(true);
      expect(bandNames()).toEqual(["(header)", "Basics", "Conditions", "Note for helpers", "(band)"]);
      expect($("main [data-band]:last-child [data-viewer-more]")?.textContent?.trim()).toBe(
        "More details are visible to caretakers.",
      );
      expect(bandsAlternate()).toBe(true);
    },
  );
});
