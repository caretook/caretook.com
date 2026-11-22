import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, TEST_USER } from "../../../../../test/fixtures";
import { openTimeline, rows, SAM, setView, TIMELINE_URL } from "./timelineWorld";
import { found, waitUntil } from "../../../../../test/found";

// The day summaries on the test device: the line in each day's sticky header,
// what it says (arrows in words), expanding by tap and keyboard, live updates
// (a local add and another device's entry), every filter hiding it, and the
// header's Highlights / Full / Off switch. What a day's line holds (no
// highlights, doses or notes alone) is daySummary.test.ts's; the header
// staying stuck is timelineLayout.browser.test.tsx's.

// Tens of seconds, not minutes: the entries stay on today for a run just after midnight (B-225, B-227).
const minutesAgo = (m: number) => at(new Date(Date.now() - m * 10_000));
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

/** The default line: highlights only (Cough 2 is old and mild; notes and authors aren't highlights). */
const TODAY_TEXT = "BP 150/90 ↑ · Nausea 5 (new) · Fell in bathroom";
const TODAY_FULL = "BP 150/90 ↑ · Nausea 5 (new) · Cough 2 · Fell in bathroom · Alex, Sam";

const summaries = () => [...document.querySelectorAll<HTMLElement>("[data-day-summary]")];
const summaryButton = (i = 0) => summaries()[i]?.querySelector("button");
/** Whether a region shows (a closed `Collapse` is hidden once it has slid shut). */
const shown = (el: HTMLElement) => el.checkVisibility({ visibilityProperty: true });
const lineOf = (i = 0) => summaryButton(i)?.querySelector(".truncate")?.textContent ?? "";

describe("the day summary", () => {
  test("sits inside each day's sticky header, under the date, and says how the day went", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2, "two summaries");
    const today = await found(() => summaries()[0]);
    const yesterday = summaries()[1];
    // In the sticky header, after the date's row.
    const header = today.closest("[data-day-header]")!;
    expect(header).toBeTruthy();
    expect(header.querySelector("h3")?.compareDocumentPosition(today)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(yesterday?.closest("[data-day-header]")).toBeTruthy();
    expect(lineOf(0)).toBe(TODAY_TEXT);
    expect(lineOf(1)).toBe("Cough 3 (new)");
    expect(yesterday).toBeTruthy();
  });

  test("is read as text, with the arrow in words", async () => {
    const device = await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2);
    const button = device.screen.getByRole("button", { name: /^Day summary: BP 150\/90/ });
    await expect
      .element(button)
      .toHaveAccessibleName(
        "Day summary: BP 150/90, higher than last week; Nausea 5 (new); Fell in bathroom",
      );
  });

  test("expands and collapses by tap and by keyboard", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2);
    const button = summaryButton()!;
    const details = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => shown(details)).toBe(false);
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");

    await userEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await expect.poll(() => shown(details)).toBe(true);
    expect([...details.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Vitals: BP 150/90 ↑(higher than last week)",
      "Symptoms: Nausea 5 (new), Cough 2",
      "Events: Fell in bathroom",
      "Logged by: Alex, Sam",
    ]);
    await userEvent.click(button);
    await expect.poll(() => shown(details)).toBe(false);

    button.focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => shown(details)).toBe(true);
    await userEvent.keyboard(" ");
    await expect.poll(() => shown(details)).toBe(false);
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
    await waitUntil(() => lineOf(0).includes("Fell in bathroom · Walk in the garden"), "the new event");

    const high = fx.vital({ occurredAt: minutesAgo(3), readings: [{ type: "heartRate", value: 140 }] });
    await device.sync([high]);
    await waitUntil(() => lineOf(0).startsWith("BP 150/90 ↑ · HR 140 bpm ↑ ·"), "the reading");

    await device.unsync([fall]);
    await waitUntil(() => !lineOf(0).includes("Walk in the garden"), "the event gone");
  });

  test.each([
    ["a kind", "?kind=symptom", /^Symptoms: clear this filter$/],
    ["an author", `?author=${TEST_USER.id}`, /clear this filter$/],
    // The kind's chip takes the vital type with it.
    ["a vital type", "?kind=vital&vital=bloodPressure", /^Vitals: clear this filter$/],
    ["a search", "?q=cough", /clear the search$/],
  ])("%s filter hides every summary; clearing it brings them back", async (_, query, clear) => {
    const device = await openTimeline({ fixtures, query });
    await waitUntil(() => rows().length > 0 || !!document.querySelector("[data-empty]"));
    expect(summaries()).toHaveLength(0);

    await userEvent.click(device.screen.getByRole("link", { name: clear }));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await waitUntil(() => summaries().length === 2, "summaries back");
  });

  test("the header's menu switches to the full line, and off", async () => {
    const device = await openTimeline({ fixtures });
    await waitUntil(() => summaries().length === 2);
    const choose = async (mode: string) => {
      await userEvent.click(device.screen.getByRole("button", { name: "View options" }));
      await userEvent.click(device.screen.getByRole("menuitemradio", { name: new RegExp(`^${mode}`) }));
    };

    await choose("Full");
    await waitUntil(() => lineOf(0) === TODAY_FULL, "the full line");
    expect(lineOf(1)).toBe("BP 120/80 · Cough 3 (new) · Alex");

    await choose("Off");
    await waitUntil(() => summaries().length === 0, "no summaries");

    await choose("Highlights");
    await waitUntil(() => lineOf(0) === TODAY_TEXT, "highlights back");
  });
});
