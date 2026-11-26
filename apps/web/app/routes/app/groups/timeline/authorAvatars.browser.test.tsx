import { beforeEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { at, fx, medicationPass, newId } from "../../../../../test/fixtures";
import { found, fixClock, stopsMoving, waitUntil } from "../../../../../test/found";
import { laTime, NOW, openPlanner, PLANNER_URL } from "../planner/plannerWorld";
import { chooseEasyMode, openTimeline, rowWith, setView } from "./timelineWorld";

// Authors on the Timeline and Planner wear their member look: rows, pass rows,
// the easy and read-only circles, the filter chip and the tooltip. The filter
// link, `data-author` and the screen-reader name stay; a former member stays
// neutral with initials.

const ROSA_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a41";
const IVO_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a42";
const FORMER_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1a49";
const ROSA = fx.user({ id: ROSA_ID, name: "Rosa Delgado", avatarColor: "jade", avatarIcon: "bird" });
const IVO = fx.user({ id: IVO_ID, name: "Ivo Marsh" });
const FORMER = fx.user({ id: FORMER_ID, name: "Noor Haddad" });
const PEOPLE = [ROSA, fx.member({ userId: ROSA_ID }), IVO, fx.member({ userId: IVO_ID }), FORMER];

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const NOTES = [
  fx.note({ occurredAt: minutesAgo(5), createdBy: ROSA_ID, text: "Rosa's walk note" }),
  fx.note({ occurredAt: minutesAgo(10), createdBy: IVO_ID, text: "Ivo's lunch note" }),
  fx.note({ occurredAt: minutesAgo(15), createdBy: FORMER_ID, text: "An older note" }),
];

const avatarIn = (el: Element | null | undefined) => el?.querySelector<HTMLElement>('[aria-hidden="true"]');
const expectRosa = (avatar: HTMLElement | null | undefined) => {
  expect(avatar?.dataset.avatarColor).toBe("jade");
  expect(avatar?.dataset.avatarIcon).toBe("bird");
  expect(avatar?.querySelector("svg")).not.toBeNull();
};

describe("on the Timeline", () => {
  test("a row shows the author's look and stays their filter link", async () => {
    await openTimeline({ fixtures: [PEOPLE, NOTES] });
    const link = await found(() =>
      rowWith("Rosa's walk note")?.querySelector<HTMLAnchorElement>("a[data-author]"),
    );
    expect(link.dataset.author).toBe(ROSA_ID);
    expect(link.getAttribute("aria-label")).toBe("Show only Rosa Delgado's entries");
    await waitUntil(() => avatarIn(link)?.dataset.avatarIcon === "bird", "Rosa's look");
    expectRosa(avatarIn(link));

    const ivo = avatarIn(rowWith("Ivo's lunch note")?.querySelector("a[data-author]"));
    expect(ivo?.hasAttribute("data-avatar-default")).toBe(true);
    expect(ivo?.textContent).toBe("IM");
  });

  test("a former member stays neutral with initials", async () => {
    await openTimeline({ fixtures: [PEOPLE, NOTES] });
    const link = await found(() =>
      rowWith("An older note")?.querySelector<HTMLAnchorElement>(`a[data-author="${FORMER_ID}"]`),
    );
    const avatar = avatarIn(link);
    expect(avatar?.hasAttribute("data-avatar-neutral")).toBe(true);
    expect(avatar?.hasAttribute("data-avatar-color")).toBe(false);
    expect(avatar?.textContent).toMatch(/^[A-Z?]{1,2}$/);
  });

  test("a pass row shows the author's look", async () => {
    const pass = medicationPass({ name: "Morning", time: "08:00" });
    const medication = fx.medication({ name: "Lisinopril" });
    const logId = newId();
    const dose = fx.dose({
      medicationId: medication.id,
      createdBy: ROSA_ID,
      occurredAt: minutesAgo(2),
      details: JSON.stringify({
        medicationId: medication.id,
        status: "given",
        amount: "1 tablet",
        passId: pass.id,
        passLogId: logId,
      }),
    });
    await openTimeline({ fixtures: [PEOPLE, pass, medication, dose] });
    const link = await found(() =>
      document.querySelector(`[data-pass-log="${logId}"] a[data-author="${ROSA_ID}"]`),
    );
    expect(link.getAttribute("aria-label")).toBe("Show only Rosa Delgado's entries");
    await waitUntil(() => avatarIn(link)?.dataset.avatarIcon === "bird", "Rosa's look");
    expectRosa(avatarIn(link));
  });

  test("the easy circle shows the look, with no link and its screen-reader name", async () => {
    chooseEasyMode();
    await openTimeline({ fixtures: [PEOPLE, NOTES] });
    const circle = await found(() => document.querySelector<HTMLElement>(`span[data-author="${ROSA_ID}"]`));
    expect(circle.closest("a")).toBeNull();
    expect(circle.querySelector(".sr-only")?.textContent).toBe("By Rosa Delgado");
    await waitUntil(() => avatarIn(circle)?.dataset.avatarIcon === "bird", "Rosa's look");
    expectRosa(avatarIn(circle));
  });

  test("the filter chip and the tooltip match the row", async () => {
    await openTimeline({ fixtures: [PEOPLE, NOTES], query: `?author=${ROSA_ID}`, width: 1280 });
    const chip = await found(() =>
      document.querySelector('a[aria-label="By Rosa Delgado: clear this filter"]'),
    );
    await waitUntil(() => avatarIn(chip)?.dataset.avatarIcon === "bird", "the chip's look");
    expectRosa(avatarIn(chip));

    const link = await found(() =>
      rowWith("Rosa's walk note")?.querySelector<HTMLAnchorElement>("a[data-author]"),
    );
    // A pointer press first: React Aria shows tooltips on hover only once the pointer is in use.
    await userEvent.click(await found(() => document.querySelector("section h3")));
    await stopsMoving(() => link);
    await userEvent.hover(link);
    const tip = await found(() => document.querySelector(`[data-author-tooltip="${ROSA_ID}"]`));
    expectRosa(avatarIn(tip));
    expect(tip.textContent).toContain("Rosa Delgado");
    await userEvent.unhover(link);
  });

  test("cards keep the author's name as the filter link", async () => {
    await openTimeline({ fixtures: [PEOPLE, NOTES] });
    await found(() => rowWith("Rosa's walk note"));
    await setView("Full");
    const link = await found(() =>
      rowWith("Rosa's walk note")?.querySelector<HTMLAnchorElement>(`a[data-author="${ROSA_ID}"]`),
    );
    expect(link.textContent).toBe("Rosa Delgado");
  });
});

describe("on the Planner", () => {
  beforeEach(() => fixClock(NOW));
  const event = () =>
    fx.event({ title: "Rosa's clinic visit", occurredAt: laTime(1, 15), createdBy: ROSA_ID });

  test("a row shows the look and stays the filter link; the author chip matches", async () => {
    const visit = event();
    await openPlanner({ extra: [...PEOPLE, visit], url: `${PLANNER_URL}?author=${ROSA_ID}` });
    const link = await found(() =>
      document.querySelector(`[data-upcoming-item="${visit.id}"] a[data-author="${ROSA_ID}"]`),
    );
    expect(link.getAttribute("aria-label")).toBe("Show only Rosa Delgado's entries");
    await waitUntil(() => avatarIn(link)?.dataset.avatarIcon === "bird", "Rosa's look");
    expectRosa(avatarIn(link));

    const chip = await found(() =>
      document.querySelector('a[aria-label="By Rosa Delgado: clear this filter"]'),
    );
    expectRosa(avatarIn(chip));
  });

  test("an easy role's read-only circle shows the look, with its name", async () => {
    const visit = event();
    await openPlanner({ role: "easy_viewer", extra: [...PEOPLE, visit] });
    const circle = await found(() =>
      document.querySelector<HTMLElement>(
        `[data-upcoming-item="${visit.id}"] span[data-author="${ROSA_ID}"]`,
      ),
    );
    expect(circle.title).toBe("Rosa Delgado");
    expect(circle.querySelector(".sr-only")?.textContent).toBe("Rosa Delgado");
    await waitUntil(() => avatarIn(circle)?.dataset.avatarIcon === "bird", "Rosa's look");
    expectRosa(avatarIn(circle));
  });
});
