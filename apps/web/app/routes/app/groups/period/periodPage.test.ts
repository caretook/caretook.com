import { describe, expect, it } from "vitest";
import { deleteConfirmText, neighbourLabel, spanDatesText } from "./periodPage";

const LA = "America/Los_Angeles";
const now = new Date("2026-11-19T20:00:00.000Z");

const span = (
  type: string,
  startsAt: string,
  endsAt: string | null,
  { label = null as string | null, dateOnly = false } = {},
) => ({
  period: {
    id: `${type}-${startsAt}`,
    startedAt: startsAt,
    createdAt: startsAt,
    deletedAt: null,
    type,
    label,
    dateOnly,
  },
  startsAt,
  endsAt,
});

const rehab = span("rehab", "2026-11-02T17:00:00.000Z", "2026-11-12T22:20:00.000Z");
const home = span("home", "2026-11-12T22:20:00.000Z", null);
const homeOnDay = span("home", "2026-11-12T08:00:00.000Z", null, { dateOnly: true });

describe("deleteConfirmText", () => {
  it("says the previous period runs on to where the deleted one ended", () => {
    expect(deleteConfirmText({ previous: rehab, next: home }, LA, now)).toBe(
      "Rehab will continue until Nov 12, 14:20.",
    );
    expect(deleteConfirmText({ previous: rehab, next: homeOnDay }, LA, now)).toBe(
      "Rehab will continue until Nov 12.",
    );
  });

  it("says the previous period becomes current again when the current one goes", () => {
    expect(deleteConfirmText({ previous: rehab, next: null }, LA, now)).toBe(
      "Rehab will be the current period again.",
    );
  });

  it("says the next period becomes first, or that none are left; Other reads as its label", () => {
    expect(deleteConfirmText({ previous: null, next: home }, LA, now)).toBe("Home will be the first period.");
    expect(deleteConfirmText({ previous: null, next: null }, LA, now)).toBe("There will be no care periods.");
    const other = span("other", "2026-11-02T17:00:00.000Z", "2026-11-12T22:20:00.000Z", {
      label: "Daughter's house",
    });
    expect(deleteConfirmText({ previous: other, next: null }, LA, now)).toBe(
      "Daughter's house will be the current period again.",
    );
  });
});

describe("neighbours' wording", () => {
  it("gives a span's dates, the current one running to now", () => {
    expect(spanDatesText(rehab, LA, now)).toBe("Nov 2, 09:00 – Nov 12");
    expect(spanDatesText(homeOnDay, LA, now)).toBe("Nov 12 – now");
  });

  it("names a neighbour link for screen readers", () => {
    expect(neighbourLabel("previous", rehab, LA, now)).toBe("Previous period: Rehab, Nov 2, 09:00 – Nov 12");
    expect(neighbourLabel("next", home, LA, now)).toBe("Next period: Home, Nov 12, 14:20 – now");
  });
});
