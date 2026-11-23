import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { at, fx } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { dayKeyIn } from "./timelineDays";
import { chooseEasyMode, frames, openTimeline, rows, rowWith, TIMELINE_URL, world } from "./timelineWorld";

// The date button: the toolbar's popover and the one beside Back to today.

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const daysAgo = (d: number, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t;
};
const key = (d: number) => dayKeyIn(daysAgo(d).toISOString(), zone);
const farWorld = () => [
  ...world(10),
  fx.note({ occurredAt: at(daysAgo(40, 9)), text: "Forty days back" }),
  fx.symptom({ occurredAt: at(daysAgo(50, 9)), name: "Fifty days back" }),
  // Enough below the far days that the page can scroll them to the top.
  ...Array.from({ length: 30 }, (_, i) =>
    fx.note({ occurredAt: at(daysAgo(51 + i, 9)), text: `Older note ${i}` }),
  ),
];
const paramsOf = (url: string) => new URL(url, location.origin).searchParams;
const dateInput = () => document.querySelector<HTMLInputElement>("[data-day-picker] input[type=date]");
const goButton = () => page.getByRole("dialog").getByRole("button", { name: "Go", exact: true });
const firstHeading = () => document.querySelector("section[aria-labelledby^='day-']");
const headingAtTop = () => {
  const top = firstHeading()?.getBoundingClientRect().top ?? Infinity;
  return top >= 0 && top < 40;
};

const pick = async (name: string, day: string) => {
  await userEvent.click(page.getByRole("button", { name, exact: true }));
  await userEvent.fill(await found(dateInput), day);
  await userEvent.click(goButton());
  await waitUntil(() => !document.querySelector("[data-day-picker]"), "the popover to close");
};
const landedOn = async (text: string) => {
  await waitUntil(() => rows()[0]?.textContent?.includes(text), `${text} to come first`);
  await waitUntil(headingAtTop, "the day's heading at the top");
  // Focus going back to the date button must not pull the page away from the day.
  await frames(5);
  expect(headingAtTop()).toBe(true);
};

describe("the timeline's date picker", () => {
  test.each(["full", "easy"] as const)(
    "a viewer picks a past day and lands on it (%s view)",
    async (mode) => {
      if (mode === "easy") chooseEasyMode();
      const device = await openTimeline({ role: "viewer", fixtures: farWorld() });
      await pick("Go to a day", key(40));
      await landedOn("Forty days back");
      expect(paramsOf(device.location()).get("day")).toBe(key(40));
    },
  );

  test("it opens on the current jump day, and the button beside Back to today jumps again", async () => {
    await openTimeline({ fixtures: farWorld(), query: `?day=${key(40)}` });
    await landedOn("Forty days back");
    await userEvent.click(page.getByRole("button", { name: "Go to another day" }));
    expect((await found(dateInput)).value).toBe(key(40));
    await userEvent.fill(await found(dateInput), key(50));
    await userEvent.click(goButton());
    await landedOn("Fifty days back");
  });

  test("a future day can't be submitted", async () => {
    const device = await openTimeline({ fixtures: farWorld() });
    await userEvent.click(page.getByRole("button", { name: "Go to a day" }));
    const input = await found(dateInput);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(input.max).toBe(dayKeyIn(new Date().toISOString(), zone));
    await userEvent.fill(input, dayKeyIn(tomorrow.toISOString(), zone));
    await expect.element(goButton()).toBeDisabled();
    await expect.element(page.getByText("The timeline ends today.")).toBeVisible();
    input.form?.requestSubmit();
    await frames();
    expect(device.location()).toBe(TIMELINE_URL);
  });

  test("a kind filter stays on and a search ends", async () => {
    const device = await openTimeline({ fixtures: farWorld(), query: "?kind=symptom&q=back" });
    await pick("Go to a day", key(45));
    await waitUntil(() => rows()[0]?.textContent?.includes("Fifty days back"), "the symptom to come first");
    const params = paramsOf(device.location());
    expect(params.get("kind")).toBe("symptom");
    expect(params.get("day")).toBe(key(45));
    expect(params.has("q")).toBe(false);
  });

  test("picking the same day again scrolls back to it", async () => {
    await openTimeline({ fixtures: farWorld() });
    await pick("Go to a day", key(40));
    await landedOn("Forty days back");
    window.scrollTo({ top: document.documentElement.scrollHeight });
    await waitUntil(() => !headingAtTop(), "the list to scroll away");
    await pick("Go to another day", key(40));
    await waitUntil(headingAtTop, "the day's heading back at the top");
    expect(rowWith("Forty days back")).toBeTruthy();
  });
});
