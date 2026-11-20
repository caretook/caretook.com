import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, TEST_USER } from "../../../../../test/fixtures";
import { openTimeline, rows, SAM, setView, TIMELINE_URL, waitUntil } from "./timelineWorld";

// The day summaries on the test device: the line under each day's heading,
// what it says (arrows in words), expanding by tap and keyboard, live updates
// (a local add and another device's entry), and every filter hiding it.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const daysAgo = (d: number, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return at(t);
};

const TODAY = [
  fx.vital({
    occurredAt: minutesAgo(40),
    readings: [{ type: "bloodPressure", systolic: 150, diastolic: 90 }],
  }),
  fx.symptom({ occurredAt: minutesAgo(35), name: "Nausea", severity: 5, createdBy: SAM.id }),
  fx.symptom({ occurredAt: minutesAgo(30), name: "Cough", severity: 2 }),
  fx.event({ occurredAt: minutesAgo(25), title: "Fell in bathroom" }),
  fx.event({ occurredAt: minutesAgo(20), title: "Dialysis", cancelledAt: minutesAgo(21) }),
  fx.note({ occurredAt: minutesAgo(15), text: "Quiet morning." }),
  fx.note({ occurredAt: minutesAgo(10), text: "Ate lunch.", createdBy: SAM.id }),
];
const YESTERDAY = [
  fx.vital({ occurredAt: daysAgo(1), readings: [{ type: "bloodPressure", systolic: 120, diastolic: 80 }] }),
  fx.symptom({ occurredAt: daysAgo(1, 12), name: "Cough", severity: 3 }),
];
const fixtures = [SAM, ...TODAY, ...YESTERDAY];

const TODAY_TEXT = "BP 150/90 ↑ · Nausea 5 (new) · Cough 2 · Fell in bathroom · 2 notes · Alex, Sam";

const summaries = () => [...document.querySelectorAll<HTMLElement>("[data-day-summary]")];
const summaryButton = (i = 0) => summaries()[i]?.querySelector("button");
const lineOf = (i = 0) => summaryButton(i)?.querySelector(".truncate")?.textContent ?? "";

describe("the day summary", () => {
  test("sits under each day's heading (not in it), and says how the day went", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2, 4000, "two summaries");
    const [today, yesterday] = summaries();
    // Right after the sticky heading, outside it.
    expect(today!.previousElementSibling?.hasAttribute("data-day-header")).toBe(true);
    expect(today!.closest("[data-day-header]")).toBeNull();
    expect(lineOf(0)).toBe(TODAY_TEXT);
    expect(lineOf(1)).toBe("BP 120/80 · Cough 3 (new) · Alex");
    expect(yesterday).toBeTruthy();
  });

  test("is read as text, with the arrow in words", async () => {
    const device = await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2);
    const button = device.screen.getByRole("button", { name: /^Day summary: BP 150\/90/ });
    await expect
      .element(button)
      .toHaveAccessibleName(
        "Day summary: BP 150/90, higher than last week; Nausea 5 (new); Cough 2; Fell in bathroom; 2 notes; Alex, Sam",
      );
  });

  test("expands and collapses by tap and by keyboard", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2);
    const button = summaryButton()!;
    const details = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(details.hidden).toBe(true);

    await userEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(details.hidden).toBe(false);
    expect([...details.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Vitals: BP 150/90 ↑(higher than last week)",
      "Symptoms: Nausea 5 (new), Cough 2",
      "Events: Fell in bathroom",
      "Notes: 2 notes",
      "Logged by: Alex, Sam",
    ]);
    await userEvent.click(button);
    expect(details.hidden).toBe(true);

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(details.hidden).toBe(false);
    await userEvent.keyboard(" ");
    expect(details.hidden).toBe(true);
  });

  test("shows in cards too", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2);
    await setView("Cards");
    expect(lineOf(0)).toBe(TODAY_TEXT);
  });

  test("updates live: another device's entry, then a removal", async () => {
    const device = await openTimeline({ fixtures });
    await waitUntil(() => lineOf(0) === TODAY_TEXT);
    const fall = fx.event({ occurredAt: minutesAgo(5), title: "Walk in the garden", createdBy: SAM.id });
    await device.sync([fall]);
    await waitUntil(() => lineOf(0).includes("Fell in bathroom · Walk in the garden"), 4000, "the new event");

    const high = fx.vital({ occurredAt: minutesAgo(3), readings: [{ type: "heartRate", value: 140 }] });
    await device.sync([high]);
    await waitUntil(() => lineOf(0).startsWith("BP 150/90 ↑ · HR 140 bpm ↑ ·"), 4000, "the reading");

    await device.unsync([fall]);
    await waitUntil(() => !lineOf(0).includes("Walk in the garden"), 4000, "the event gone");
  });

  test.each([
    ["a kind", "?kind=symptom", /^All$/],
    ["an author", `?author=${TEST_USER.id}`, /clear this filter$/],
    ["a vital type", "?kind=vital&vital=bloodPressure", /^All$/],
    ["a search", "?q=cough", /clear the search$/],
  ])("%s filter hides every summary; clearing it brings them back", async (_, query, clear) => {
    const device = await openTimeline({ fixtures, query });
    await waitUntil(() => rows().length > 0 || !!document.querySelector("[data-empty]"));
    expect(summaries()).toHaveLength(0);

    await userEvent.click(device.screen.getByRole("link", { name: clear }));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await waitUntil(() => summaries().length === 2, 4000, "summaries back");
  });

  test("a day with only doses has no summary", async () => {
    const med = fx.medication();
    await openTimeline({
      fixtures: [med, fx.dose({ medicationId: med.id, occurredAt: minutesAgo(30) })],
    });
    await waitUntil(() => rows().length > 0);
    expect(summaries()).toHaveLength(0);
  });
});
