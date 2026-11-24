import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { TEST_USER } from "../../../../../test/fixtures";
import {
  activeChips,
  authorOf,
  chip,
  closeFilters,
  currentChips,
  filterButton,
  iconOf,
  openFilters,
  openTimeline,
  PRIMARY_VISIT,
  rowKinds,
  rowOf,
  rows,
  SAM,
  setView,
  tapAt,
  TIMELINE_URL,
} from "./timelineWorld";
import { found, waitUntil } from "../../../../../test/found";

// The timeline's filters on the test device (from phase2.mjs: kindIconFilters,
// authorFilters and vitalTypeFilters): the kind icon and the author control
// as links, the Filter button and its sheet, the removable chips, both
// filters together, the empty state, the keyboard, rows and cards, writer
// and viewer. The device is offline throughout, so
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
const vitalsLine = () => document.querySelector('[data-today-row="vitals"]')?.textContent;
const authorChip = () =>
  document.querySelector<HTMLAnchorElement>('nav[aria-label="Filters on"] a[aria-label^="By "]');
/** The kind's chip: the first one that isn't the author's. */
const kindChip = () => activeChips().find((a) => !a.getAttribute("aria-label")?.startsWith("By "));
const SYMPTOMS = "Symptoms: clear this filter";
const BY_SAM = "By Sam Okafor: clear this filter";

describe("the kind icon", () => {
  test.each(["owner", "viewer"] as const)(
    "%s: every icon is a named link; a symptom's shows only symptoms, with its chip; the chip clears it",
    async (role) => {
      const device = await openTimeline({ role });
      await waitUntil(() => rows().length > 0);
      const names = rows().map((li) => iconOf(li)?.getAttribute("aria-label") ?? "none");
      expect(names.every((n) => KNOWN.includes(n))).toBe(true);

      await userEvent.click(await found(() => iconOf(rowOf("Symptom")!)));
      await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
      await expect.poll(rowKinds).toBe("Symptom: ");
      expect(currentChips()).toBe(SYMPTOMS);

      await userEvent.click(await found(kindChip));
      await expect.poll(() => device.location()).toBe(TIMELINE_URL);
      await expect.poll(() => rowKinds().split(",").length).toBeGreaterThan(1);
      expect(currentChips()).toBe("");
    },
  );

  test("a reload keeps the filter; another kind in the sheet changes it; a tap on an event opens it, and Back keeps the filter", async () => {
    const device = await openTimeline({ query: "?kind=symptom" });
    await expect.poll(rowKinds).toBe("Symptom: ");
    expect(currentChips()).toBe(SYMPTOMS);

    await openFilters();
    expect(chip("Symptoms").getAttribute("aria-current")).toBe("true");
    await userEvent.click(chip("Events"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=event`);
    await expect.poll(rowKinds).toBe("Event: ");
    expect(chip("Events").getAttribute("aria-current")).toBe("true");
    await closeFilters();

    // A tap elsewhere on the row (its text), not on a link.
    await tapAt(() => rowOf("Event")?.querySelector("p"));
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    await userEvent.click(device.screen.getByRole("button", { name: "Go back" }));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=event`);
    await expect.poll(rowKinds).toBe("Event: ");
    expect(currentChips()).toBe("Events: clear this filter");
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

  test("a row's kind icon has the kit's button feel and filters without opening the entry (B-617)", async () => {
    const device = await openTimeline();
    const note = await found(() => rowOf("Note"));
    const icon = iconOf(note);
    expect(icon.classList).toContain("motion-press");
    expect(getComputedStyle(icon).transitionDuration.split(",").map(parseFloat)).toContain(0.12);
    expect(getComputedStyle(icon).zIndex).toBe("10");
    expect(authorOf(note).classList).toContain("motion-press");
    const rest = getComputedStyle(icon).boxShadow;
    await userEvent.hover(icon);
    await expect.poll(() => getComputedStyle(icon).boxShadow).not.toBe(rest);

    await userEvent.click(icon);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    await expect.poll(rowKinds).toBe("Note: ");
    await device.settle();
    expect(device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test("cards: the same icon filters", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    await setView("Cards");
    await userEvent.click(await found(() => iconOf(rowOf("Symptom")!)));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    await expect.poll(rowKinds).toBe("Symptom: ");
    expect(currentChips()).toBe(SYMPTOMS);
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
      expect(authorOf(await found(() => rows()[0])).dataset.author).toBe(SAM.id);
      expect(currentChips()).toBe(BY_SAM);
      expect(authorChip()?.querySelector("[aria-hidden]")?.textContent?.trim()).toBe("SO");
    },
  );

  test("then a kind on top; the author chip clears only the author, the kind chip only the kind; the same author again changes nothing", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    const vitals = vitalsLine();
    await userEvent.click(samLink());
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
    expect(vitalsLine()).toBe(vitals); // The Today card's vitals ignore the author filter.

    await userEvent.click(await found(() => iconOf(rowOf("Symptom")!)));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom&author=${SAM.id}`);
    await expect.poll(rowKinds).toBe("Symptom: ");
    expect(currentChips()).toBe(`${SYMPTOMS},${BY_SAM}`);

    await userEvent.click(await found(authorChip));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom`);
    expect(currentChips()).toBe(SYMPTOMS);
    expect(authorChip()).toBeNull();

    await userEvent.click(samLink());
    // Wait for the author to apply: under load, the kind chip's link was read before it did and dropped the author too.
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=symptom&author=${SAM.id}`);
    await device.settle();
    await userEvent.click(await found(kindChip));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?author=${SAM.id}`);
    expect(currentChips()).toBe(BY_SAM);
    await expect.poll(() => rowKinds().split(",").length).toBeGreaterThan(1);

    const count = rows().length;
    await userEvent.click(samLink());
    await device.settle();
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
    expect(currentChips()).toBe(`${SYMPTOMS},By ${TEST_USER.name}: clear this filter`);
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
    expect(currentChips()).toBe(BY_SAM);
  });
});

describe("the Filter button and its sheet", () => {
  const types = () => [
    ...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Show vital types"] a'),
  ];
  const typeChip = (label: string) => types().find((a) => a.textContent?.trim() === label)!;
  /** The button's name: "Filter", or "Filter, N on" (its badge shows N). */
  const buttonName = () => filterButton().getAttribute("aria-label");
  const badge = () => filterButton().querySelector("[data-count]")?.textContent ?? null;
  const chipRow = () => document.querySelector('nav[aria-label="Filters on"]');

  test("at phone width, no chip row and a plain Filter until a filter is set", async () => {
    const device = await openTimeline({ width: 420 });
    await waitUntil(() => rows().length > 0);
    expect(buttonName()).toBe("Filter");
    expect(chipRow()).toBeNull();
    expect(document.querySelector('nav[aria-label="Show entries"]')).toBeNull();

    await userEvent.click(await found(() => iconOf(rowOf("Note")!)));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=note`);
    await expect.poll(buttonName).toBe("Filter, 1 on");
    expect(chipRow()?.checkVisibility()).toBe(true);
  });

  test("Vitals, then Blood pressure in the sheet: both apply at once, the button counts 2, both chips show; Done closes it, focus back on the button", async () => {
    const device = await openTimeline();
    await waitUntil(() => rows().length > 0);
    await openFilters();
    expect(device.screen.getByRole("dialog", { name: "Filter entries" }).element()).toBeTruthy();
    expect(chip("All").getAttribute("aria-current")).toBe("true");
    expect(types()).toEqual([]);

    await userEvent.click(chip("Vitals"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital`);
    await expect.poll(() => types().map((a) => a.textContent?.trim())).toContain("Blood pressure");
    expect(types()[0]?.textContent?.trim()).toBe("All vitals");
    expect(typeChip("All vitals").getAttribute("aria-current")).toBe("true");

    await userEvent.click(typeChip("Blood pressure"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital&vital=bloodPressure`);
    await expect.poll(() => rows().length).toBe(1);
    expect(rows()[0]?.textContent).toMatch(/BP \d+\/\d+ mmHg/);
    expect(typeChip("Blood pressure").getAttribute("aria-current")).toBe("true");

    await closeFilters();
    expect(document.activeElement).toBe(filterButton());
    expect(buttonName()).toBe("Filter, 2 on");
    expect(activeChips().map((a) => a.textContent?.trim())).toEqual(["Vitals", "Blood pressure"]);
    expect(currentChips()).toBe("Vitals: clear this filter,Blood pressure: clear this filter");
  });

  test("removing a chip updates the URL and the count; the kind's chip takes its vital type with it", async () => {
    const device = await openTimeline({ query: `?kind=vital&author=${SAM.id}&vital=bloodPressure` });
    await waitUntil(() => activeChips().length === 3);
    expect(buttonName()).toBe("Filter, 3 on");

    await userEvent.click(
      await found(() => activeChips().find((a) => a.textContent?.trim() === "Blood pressure")),
    );
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital&author=${SAM.id}`);
    await expect.poll(buttonName).toBe("Filter, 2 on");
    expect(currentChips()).toBe(`Vitals: clear this filter,${BY_SAM}`);

    await userEvent.click(device.screen.getByRole("link", { name: BY_SAM }));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=vital`);
    await expect.poll(buttonName).toBe("Filter, 1 on");

    await userEvent.click(device.screen.getByRole("link", { name: "Vitals: clear this filter" }));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.poll(buttonName).toBe("Filter");
    expect(chipRow()).toBeNull();
  });

  test("Clear removes every filter but the search; Escape closes the sheet, focus back on the button", async () => {
    const device = await openTimeline({ query: `?kind=vital&author=${SAM.id}&q=reading&vital=weight` });
    await openFilters();
    // The author and the search are in the sheet too, as their chips.
    const other = device.screen.getByRole("navigation", { name: "Other filters" });
    expect(
      other
        .getByRole("link")
        .elements()
        .map((a) => a.getAttribute("aria-label")),
    ).toEqual([BY_SAM, "Matching “reading”: clear the search"]);

    await userEvent.click(device.screen.getByRole("link", { name: "Clear" }));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?q=reading`);
    await expect.poll(() => chip("All").getAttribute("aria-current")).toBe("true");
    expect(types()).toEqual([]);

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !document.querySelector('[role="dialog"]'), "the sheet to close");
    await expect.poll(() => document.activeElement).toBe(filterButton());
    expect(buttonName()).toBe("Filter");
    expect(currentChips()).toBe("Matching “reading”: clear the search");
  });

  test("Filter is the kit's IconButton, the magnifier's look plus its badge (B-617)", async () => {
    const device = await openTimeline({ width: 420, query: `?kind=symptom&author=${SAM.id}` });
    await waitUntil(() => activeChips().length === 2);
    const magnifier = device.screen.getByRole("button", { name: "Search entries" }).element();
    const classes = (el: Element) => [...el.classList].sort();
    expect(classes(filterButton())).toEqual([...classes(magnifier), "relative"].sort());
    expect(filterButton().getAttribute("title")).toBe("Filter, 2 on");
    expect(badge()).toBe("2");
    expect(filterButton().querySelector("[data-count]")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("icon-only, one circle with the magnifier: “Filter” with nothing on; with a kind and an author, “Filter, 2 on” and a badge of 2; it opens the sheet", async () => {
    const device = await openTimeline({ width: 420 });
    await waitUntil(() => rows().length > 0);
    const named = (name: string) => device.screen.getByRole("button", { name, exact: true });
    await expect.element(named("Filter")).toBeVisible();
    expect(named("Filter").element()).toBe(filterButton());
    expect(filterButton().getAttribute("aria-haspopup")).toBe("dialog");
    expect(filterButton().textContent?.trim()).toBe("");
    expect(badge()).toBeNull();
    const magnifier = document.querySelector<HTMLElement>('button[aria-label="Search entries"]')!;
    const [m, f] = [magnifier, filterButton()].map((el) => el.getBoundingClientRect()) as [DOMRect, DOMRect];
    expect([f.width, f.height]).toEqual([m.width, m.height]);
    expect(getComputedStyle(filterButton()).borderRadius).toBe(getComputedStyle(magnifier).borderRadius);

    await device.screen.unmount();
    const filtered = await openTimeline({ width: 420, query: `?kind=symptom&author=${SAM.id}` });
    await waitUntil(() => activeChips().length === 2);
    const button = filtered.screen.getByRole("button", { name: "Filter, 2 on", exact: true });
    await expect.element(button).toBeVisible();
    expect(badge()).toBe("2");
    await userEvent.click(button);
    await expect.element(filtered.screen.getByRole("dialog", { name: "Filter entries" })).toBeVisible();
    await closeFilters();
    expect(document.activeElement).toBe(filterButton());
  });
});
