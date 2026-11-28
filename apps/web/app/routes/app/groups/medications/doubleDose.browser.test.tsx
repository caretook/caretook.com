import type { Fixture } from "../../../../../test/fixtures";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { textContrast } from "../../../../../test/contrast";
import { fixClock, found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, medicationPass, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { CLOCK, clockAt, clockMoment, MEDICATION_ROUTES, medicationUrl, SCHEDULE } from "./medicationWorld";
import { clockTime } from "@caretook/data/schema";

// A double dose called out (B-606): a slot given twice reads "Given twice:
// 9:55 and 9:58" beside a warning badge on Today's row, on its pass's card
// (closed), and on the medication's page; an as-needed day past its maximum
// says so with each time. Viewers see it too; a single dose shows nothing.
// Which dose is extra is dueDoses.test.ts's.

const RECIPIENT_HERE = fx.recipient({ timeZone: TEST_TIME_ZONE });

const ROUNDS = medicationPass({ name: "Rounds", time: clockAt(-10), sortOrder: 0 });
const DONEPEZIL = fx.medication({
  name: "Donepezil",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: clockAt(-6) }] },
});
const XA = fx.medication({
  name: "Xa",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ passId: ROUNDS.id }] },
});
const ONDANSETRON = fx.medication({
  name: "Ondansetron",
  strength: "4 mg",
  dose: "1 tablet",
  schedule: { type: "asNeeded", maxPerDay: 1 },
});

/** A given dose `minutes` from 10:00, for a slot (`scheduledFor`, `passId`) or as needed. */
const given = (
  medication: { id: string },
  minutes: number,
  slot: { scheduledFor?: string; passId?: string } = {},
) =>
  fx.dose({
    medicationId: medication.id,
    occurredAt: clockMoment(minutes),
    details: JSON.stringify({ medicationId: medication.id, status: "given", amount: "1 tablet", ...slot }),
  });

const twiceText = (a: number, b: number) =>
  `Given twice: ${clockTime(clockAt(a))} and ${clockTime(clockAt(b))}`;

const TODAY = () => document.querySelector<HTMLElement>("main [data-today]");
const warnings = (root: Element | null | undefined) =>
  [...(root?.querySelectorAll<HTMLElement>("[data-extra-dose-text]") ?? [])].map((el) => el.textContent);

const openToday = async (fixtures: Fixture[], role: "caretaker" | "viewer" = "caretaker") => {
  const device = await renderWithDevice({
    route: MEDICATION_ROUTES,
    url: SCHEDULE,
    role,
    fixtures: [RECIPIENT_HERE, fixtures],
  });
  await expect.poll(() => TODAY()?.querySelector("[data-slot], [data-as-needed], [data-pass]")).toBeTruthy();
  return device;
};

beforeEach(() => {
  fixClock(CLOCK);
});
afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.theme;
});

describe("Today", () => {
  test("a slot given twice shows the warning with both times on its row", async () => {
    await openToday([
      DONEPEZIL,
      given(DONEPEZIL, -5, { scheduledFor: clockAt(-6) }),
      given(DONEPEZIL, -2, { scheduledFor: clockAt(-6) }),
    ]);
    const row = await found(() => TODAY()?.querySelector(`[data-slot="${DONEPEZIL.id}@${clockAt(-6)}"]`));
    await expect.poll(() => warnings(row)).toEqual([twiceText(-5, -2)]);
    expect(row.querySelector("[data-extra-dose-badge]")?.textContent).toBe("Double dose");
  });

  test("a pass with a medication given twice says so on the closed card, and in its row once open", async () => {
    await openToday([
      ROUNDS,
      XA,
      given(XA, -9, { passId: ROUNDS.id, scheduledFor: clockAt(-10) }),
      given(XA, -4, { passId: ROUNDS.id, scheduledFor: clockAt(-10) }),
    ]);
    const card = await found(() => TODAY()?.querySelector<HTMLElement>(`[data-pass="pass:${ROUNDS.id}"]`));
    const header = () => card.firstElementChild;
    await expect.poll(() => warnings(header())).toEqual([`Xa 5 mg: ${twiceText(-9, -4)}`]);
    await userEvent.click(await found(() => card.querySelector<HTMLElement>("[data-pass-expand]")));
    const row = await found(() => card.querySelector(`[data-slot="${XA.id}@${clockAt(-10)}"]`));
    expect(warnings(row)).toEqual([twiceText(-9, -4)]);
  });

  test("an as-needed day past its maximum says so with each time", async () => {
    await openToday([ONDANSETRON, given(ONDANSETRON, -60), given(ONDANSETRON, -20)]);
    const row = await found(() => TODAY()?.querySelector(`[data-as-needed="${ONDANSETRON.id}"]`));
    await expect
      .poll(() => warnings(row))
      .toEqual([
        `Given twice today (most 1 a day): ${clockTime(clockAt(-60))} and ${clockTime(clockAt(-20))}`,
      ]);
  });

  test("a single dose, and an as-needed day at its maximum, show no warning", async () => {
    await openToday([
      DONEPEZIL,
      ROUNDS,
      XA,
      ONDANSETRON,
      given(DONEPEZIL, -5, { scheduledFor: clockAt(-6) }),
      given(XA, -9, { passId: ROUNDS.id, scheduledFor: clockAt(-10) }),
      given(ONDANSETRON, -20),
    ]);
    await expect
      .poll(
        () =>
          TODAY()?.querySelector(`[data-slot="${DONEPEZIL.id}@${clockAt(-6)}"] [data-slot-state]`)
            ?.textContent,
      )
      .toMatch(/^Given/);
    expect(TODAY()?.querySelector(`[data-as-needed="${ONDANSETRON.id}"]`)?.textContent).toContain(
      "1 of 1 today",
    );
    expect(document.querySelector("[data-extra-dose]")).toBeNull();
  });

  test.each(["light", "dark"] as const)("a viewer sees it, the badge readable in %s", async (theme) => {
    await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: SCHEDULE,
      role: "viewer",
      theme,
      fixtures: [
        RECIPIENT_HERE,
        DONEPEZIL,
        given(DONEPEZIL, -5, { scheduledFor: clockAt(-6) }),
        given(DONEPEZIL, -2, { scheduledFor: clockAt(-6) }),
      ],
    });
    const badge = await found(() => TODAY()?.querySelector("[data-extra-dose-badge]"));
    expect(textContrast(badge)).toBeGreaterThanOrEqual(4.5);
    expect(warnings(TODAY())).toEqual([twiceText(-5, -2)]);
  });
});

describe("the medication page", () => {
  const PAGE = () => document.querySelector<HTMLElement>("main [data-medication-extra-doses]");

  test("a slot given twice today shows the warning with both times", async () => {
    await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: medicationUrl(DONEPEZIL.id),
      fixtures: [
        RECIPIENT_HERE,
        DONEPEZIL,
        given(DONEPEZIL, -5, { scheduledFor: clockAt(-6) }),
        given(DONEPEZIL, -2, { scheduledFor: clockAt(-6) }),
      ],
    });
    const region = await found(PAGE);
    expect(warnings(region)).toEqual([twiceText(-5, -2)]);
    expect(region.querySelector("[data-extra-dose-badge]")?.textContent).toBe("Double dose");
  });

  test("a single dose shows none; a second one from another device brings it", async () => {
    const device = await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: medicationUrl(DONEPEZIL.id),
      fixtures: [RECIPIENT_HERE, DONEPEZIL, given(DONEPEZIL, -5, { scheduledFor: clockAt(-6) })],
    });
    await found(() => document.querySelector("main [data-medication-history]"));
    await device.settle();
    expect(PAGE()).toBeNull();
    expect(document.querySelector("[data-extra-dose]")).toBeNull();
    await device.sync(given(DONEPEZIL, -2, { scheduledFor: clockAt(-6) }));
    await device.settle();
    await expect.poll(() => warnings(PAGE())).toEqual([twiceText(-5, -2)]);
  });
});
