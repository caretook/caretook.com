import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { at, fx, symptomType } from "../../../../../test/fixtures";
import {
  activeChips,
  closeFilters,
  currentChips,
  filterButton,
  openFilters,
  openTimeline,
  rows,
  TIMELINE_URL,
  world,
} from "./timelineWorld";

// The timeline's symptom-type filter (symptom-catalog slice 5): under
// Symptoms, the Filter sheet lists the catalog rows the group has live
// entries of, as a multi-select (`?symptom=` repeated, any of them); each
// one on is a removable chip and counts on the Filter button. The device
// query matches the stored pointer, so paging fills a window as usual. The
// URLs are timelineFilters.test.ts's. The device is offline throughout.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));

const NAUSEA = symptomType("Nausea");
const FALL = symptomType("Fall");
const KNEE = symptomType("Knee pain");
/** In the catalog, but its only entry is deleted: not offered. */
const RASH = symptomType("Rash");
/** In the catalog with no entries: not offered. */
const COUGH = symptomType("Cough");

const symptomFixtures = [
  NAUSEA,
  FALL,
  KNEE,
  RASH,
  COUGH,
  fx.symptom({ name: "Nausea", occurredAt: minutesAgo(1) }),
  // Spelled differently, the same catalog row (its pointer is the folded name's).
  fx.symptom({ name: "nausea ", occurredAt: minutesAgo(2) }),
  fx.symptom({ name: "Fall", occurredAt: minutesAgo(3) }),
  fx.symptom({ name: "Knee pain", occurredAt: minutesAgo(4) }),
  fx.symptom({ name: "Rash", occurredAt: minutesAgo(5), deletedAt: minutesAgo(5) }),
];

const typeLinks = () => [
  ...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Show symptom types"] a'),
];
const typeLink = (label: string) => typeLinks().find((a) => a.textContent?.trim() === label)!;
const typeNames = () => typeLinks().map((a) => a.textContent?.trim());
const chosen = () => typeLinks().filter((a) => a.getAttribute("aria-current") === "true");
const rowNames = () => rows().map((li) => li.textContent ?? "");
const buttonName = () => filterButton().getAttribute("aria-label");

describe("the symptom-type filter", () => {
  test("lists the types with live entries; two chosen list entries of either; removing a chip widens the list", async () => {
    const device = await openTimeline({ query: "?kind=symptom", fixtures: [world(10), symptomFixtures] });
    await waitUntil(() => rows().length > 0);
    await openFilters();
    await expect.poll(typeNames).toEqual(["All symptoms", "Fall", "Knee pain", "Nausea"]);
    expect(chosen().map((a) => a.textContent?.trim())).toEqual(["All symptoms"]);

    await userEvent.click(typeLink("Nausea"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom&symptom=${NAUSEA.id}`);
    await expect.poll(() => rows().length).toBe(2);
    expect(rowNames().every((text) => /nausea/i.test(text))).toBe(true);

    await userEvent.click(typeLink("Fall"));
    await expect
      .poll(() => device.location())
      .toBe(`${TIMELINE_URL}?kind=symptom&symptom=${NAUSEA.id}&symptom=${FALL.id}`);
    await expect.poll(() => rows().length).toBe(3);
    expect(rowNames().some((text) => text.includes("Fall"))).toBe(true);
    expect(chosen().map((a) => a.textContent?.trim())).toEqual(["Fall", "Nausea"]);

    await closeFilters();
    expect(buttonName()).toBe("Filter, 3 on");
    expect(activeChips().map((a) => a.textContent?.trim())).toEqual(["Symptoms", "Nausea", "Fall"]);

    // Off one of two: the other's entries stay.
    await userEvent.click(device.screen.getByRole("link", { name: "Nausea: clear this filter" }));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom&symptom=${FALL.id}`);
    await expect.poll(() => rows().length).toBe(1);
    expect(buttonName()).toBe("Filter, 2 on");

    // Off the last: every symptom again, wider than the one type.
    await userEvent.click(device.screen.getByRole("link", { name: "Fall: clear this filter" }));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    await expect.poll(() => rows().length).toBeGreaterThan(4);
    expect(currentChips()).toBe("Symptoms: clear this filter");
  });

  test("a chosen type in the sheet takes itself off; All symptoms takes them all off; another kind drops them", async () => {
    const device = await openTimeline({
      query: `?kind=symptom&symptom=${NAUSEA.id}&symptom=${KNEE.id}`,
      fixtures: [world(10), symptomFixtures],
    });
    await expect.poll(() => rows().length).toBe(3);
    await openFilters();
    await expect.poll(() => chosen().map((a) => a.textContent?.trim())).toEqual(["Knee pain", "Nausea"]);

    await userEvent.click(typeLink("Knee pain"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom&symptom=${NAUSEA.id}`);
    await expect.poll(() => rows().length).toBe(2);

    await userEvent.click(typeLink("Fall"));
    await userEvent.click(typeLink("All symptoms"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    expect(chosen().map((a) => a.textContent?.trim())).toEqual(["All symptoms"]);

    await userEvent.click(typeLink("Nausea"));
    await expect.poll(() => chosen().map((a) => a.textContent?.trim())).toEqual(["Nausea"]);
    await userEvent.click(
      await found(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Show entries"] a')].find(
          (a) => a.textContent?.trim() === "Notes",
        ),
      ),
    );
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    expect(typeLinks()).toEqual([]);
  });

  test("paging still fills a window under the filter, and reaches the oldest", async () => {
    // 35 nausea entries between 35 headaches: a page of 30 has only nausea in it.
    const paged = Array.from({ length: 35 }, (_, i) => [
      fx.symptom({ name: "Nausea", severity: 1, occurredAt: minutesAgo(10 + 2 * i) }),
      fx.symptom({ name: "Headache", severity: 1, occurredAt: minutesAgo(11 + 2 * i) }),
    ]).flat();
    await openTimeline({
      query: `?kind=symptom&symptom=${NAUSEA.id}`,
      fixtures: [world(10), NAUSEA, symptomType("Headache"), paged],
    });
    await expect.poll(() => rows().length).toBe(30);
    expect(rowNames().every((text) => text.includes("Nausea"))).toBe(true);
    await waitUntil(() => {
      document.querySelector("[data-older-entries]")?.scrollIntoView({ block: "end" });
      return rows().length >= 35;
    }, "the older nausea entries");
    expect(rows().length).toBe(35);
    expect(rowNames().every((text) => text.includes("Nausea"))).toBe(true);
  });
});
