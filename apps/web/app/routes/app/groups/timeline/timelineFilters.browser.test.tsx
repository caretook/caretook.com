import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { TEST_USER } from "../../../../../test/fixtures";
import {
  authorOf,
  chip,
  chips,
  currentChips,
  iconOf,
  openTimeline,
  PRIMARY_VISIT,
  rowKinds,
  rowOf,
  rows,
  SAM,
  setView,
  tapAt,
  TIMELINE_URL,
  waitUntil,
} from "./timelineWorld";

// The timeline's filters on the test device (from phase2.mjs: kindIconFilters,
// authorFilters and vitalTypeFilters): the kind icon and the author control
// as links, the chips, both filters together, the empty state, the keyboard,
// rows and cards, writer and viewer. The device is offline throughout, so
// "offline: both filters" is every test here. The URLs are
// timelineFilters.test.ts's.

const KNOWN = [
  "Show only notes",
  "Show only symptoms",
  "Show only events",
  "Show only vitals",
  "Show only doses",
  "Show only medication changes",
];
const vitalsLine = () => document.querySelector('section[aria-labelledby="latest-vitals"] ul')?.textContent;
const authorChip = () =>
  document.querySelector<HTMLAnchorElement>('nav[aria-label="Show entries"] a[aria-label^="By "]');

describe("the kind icon", () => {
  test.each(["owner", "viewer"] as const)(
    "%s: every icon is a named link; a symptom's shows only symptoms, its chip current; All clears it",
    async (role) => {
      const device = await openTimeline({ role });
      await waitUntil(() => rows().length > 0);
      const names = rows().map((li) => iconOf(li)?.getAttribute("aria-label") ?? "none");
      expect(names.every((n) => KNOWN.includes(n))).toBe(true);

      await userEvent.click(iconOf(rowOf("Symptom")!));
      await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
      await expect.poll(rowKinds).toBe("Symptom: ");
      expect(currentChips()).toBe("Symptoms");

      await userEvent.click(chips()[0]!);
      await expect.poll(() => device.location()).toBe(TIMELINE_URL);
      await expect.poll(() => rowKinds().split(",").length).toBeGreaterThan(1);
      expect(currentChips()).toBe("All");
    },
  );

  test("a reload keeps the filter; another chip changes it; a tap on an event opens it, and Back keeps the filter", async () => {
    const device = await openTimeline({ query: "?kind=symptom" });
    await expect.poll(rowKinds).toBe("Symptom: ");
    expect(currentChips()).toBe("Symptoms");

    await userEvent.click(chip("Events"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=event`);
    await expect.poll(rowKinds).toBe("Event: ");

    // A tap elsewhere on the row (its text), not on a link.
    await tapAt(rowOf("Event")!.querySelector("p")!);
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=event`);
    await expect.poll(rowKinds).toBe("Event: ");
    expect(currentChips()).toBe("Events");
  });

  test("keyboard: Tab from a row's open link reaches its icon, named; Enter filters", async () => {
    const device = await openTimeline();
    await waitUntil(() => !!rowOf("Note"));
    const note = rowOf("Note")!;
    note.querySelector<HTMLAnchorElement>('a[aria-label^="Open"]')!.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(iconOf(note));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Show only notes");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    await expect.poll(rowKinds).toBe("Note: ");
  });

  test("cards: the same icon filters", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    await setView("Cards");
    await userEvent.click(iconOf(rowOf("Symptom")!));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    await expect.poll(rowKinds).toBe("Symptom: ");
    expect(currentChips()).toBe("Symptoms");
  });
});

describe("the author filter", () => {
  const samLink = () =>
    rows()
      .map(authorOf)
      .find((a) => a?.getAttribute("aria-label") === "Show only Sam Okafor's entries")!;

  test.each(["owner", "viewer"] as const)(
    "%s: every author is a named link; one tap shows only theirs, with their chip and avatar",
    async (role) => {
      const device = await openTimeline({ role });
      await waitUntil(() => rows().length > 0);
      expect(
        rows().every((li) => /^Show only .+'s entries$/.test(authorOf(li)?.getAttribute("aria-label") ?? "")),
      ).toBe(true);
      await userEvent.click(samLink());
      await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
      await expect.poll(() => new Set(rows().map((li) => authorOf(li).dataset.author)).size).toBe(1);
      expect(authorOf(rows()[0]!).dataset.author).toBe(SAM.id);
      expect(currentChips()).toBe("All,By Sam Okafor: clear this filter");
      expect(authorChip()?.querySelector("[aria-hidden]")?.textContent?.trim()).toBe("SO");
    },
  );

  test("then a kind on top; the author chip clears only the author, All only the kind; the same author again changes nothing", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    const vitals = vitalsLine();
    await userEvent.click(samLink());
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
    expect(vitalsLine()).toBe(vitals); // Latest vitals ignores the author filter.

    await userEvent.click(iconOf(rowOf("Symptom")!));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom&author=${SAM.id}`);
    await expect.poll(rowKinds).toBe("Symptom: ");
    expect(currentChips()).toBe("Symptoms,By Sam Okafor: clear this filter");

    await userEvent.click(authorChip()!);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    expect(currentChips()).toBe("Symptoms");
    expect(authorChip()).toBeNull();

    await userEvent.click(samLink());
    await userEvent.click(chips()[0]!);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
    expect(currentChips()).toBe("All,By Sam Okafor: clear this filter");
    await expect.poll(() => rowKinds().split(",").length).toBeGreaterThan(1);

    const count = rows().length;
    await userEvent.click(samLink());
    await new Promise((r) => setTimeout(r, 300));
    expect(device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
    expect(rows().length).toBe(count);
  });

  test('with both filters on, an event\'s "with …" line still shows', async () => {
    await openTimeline({ query: `?kind=event&author=${SAM.id}` });
    await waitUntil(() => rows().length > 0);
    const li = rows().find((r) => r.textContent?.includes(PRIMARY_VISIT.row.title as string))!;
    expect(li.querySelectorAll("[data-with] [data-with-name]").length).toBe(2);
    expect(li.querySelector("[data-with-more]")?.textContent?.trim()).toBe("+1");
  });

  test("a filter with no matches says so, and the chips stay", async () => {
    // The signed-in user wrote no symptoms.
    const device = await openTimeline({ query: `?kind=symptom&author=${TEST_USER.id}` });
    await expect.element(device.screen.getByText(`No symptoms by ${TEST_USER.name} yet.`)).toBeVisible();
    expect(rows().length).toBe(0);
    expect(currentChips()).toBe(`Symptoms,By ${TEST_USER.name}: clear this filter`);
  });

  test("keyboard: Tab from the kind icon reaches the author control; Enter filters", async () => {
    const device = await openTimeline();
    await waitUntil(() => !!samLink());
    const li = samLink().closest("li")!;
    iconOf(li).focus();
    for (let i = 0; i < 3 && document.activeElement !== authorOf(li); i++) await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Show only Sam Okafor's entries");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
  });

  test("cards: the author's name is the control", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    await setView("Cards");
    expect(samLink().textContent?.trim()).toBe("Sam Okafor");
    await userEvent.click(samLink());
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
    expect(currentChips()).toBe("All,By Sam Okafor: clear this filter");
  });
});

describe("the vital-type filter", () => {
  test("Vitals brings up the type chips; Blood pressure lists only those; All clears both", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    const types = () => [...document.querySelectorAll('nav[aria-label="Show vital types"] a')];
    expect(types().length).toBe(0);

    await userEvent.click(chip("Vitals"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital`);
    await expect.poll(() => types().map((a) => a.textContent?.trim())).toContain("Blood pressure");
    expect(types()[0]?.textContent?.trim()).toBe("All vitals");
    expect(
      types()
        .find((a) => a.getAttribute("aria-current") === "true")
        ?.textContent?.trim(),
    ).toBe("All vitals");

    await userEvent.click(types().find((a) => a.textContent?.trim() === "Blood pressure")!);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital&vital=bloodPressure`);
    await expect.poll(() => rows().length).toBe(1);
    expect(rows()[0]!.textContent).toMatch(/BP \d+\/\d+ mmHg/);

    await userEvent.click(chip("All"));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    expect(types().length).toBe(0);
  });
});
