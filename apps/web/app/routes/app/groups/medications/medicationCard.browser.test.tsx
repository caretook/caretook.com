import type { Fixture } from "../../../../../test/fixtures";
import type { DoseRow } from "./medicationWorld";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { fixClock, found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { appUrls } from "~/lib/app-shell/appUrls";
import {
  CLOCK,
  clockAt,
  dialogButton,
  DOSES_SQL,
  GROUP,
  LIST,
  MEDICATION_ROUTES,
  medicationUrl,
  menuItem,
  OPEN_DIALOG,
  SCHEDULE,
} from "./medicationWorld";

// The one medication card (B-698), on Schedule and on the list, on a fixed
// clock (10:00 in the recipient's zone): a tap anywhere on the card opens
// the medication, while Given, Log and the ⋯ menu stay their own controls.
// On the list, writers get Log on a current medication: the Dose sheet for a
// scheduled one, a dose now for an as-needed one (asking first past its
// maximum); a stopped one has none, and a viewer sees none. Today's own
// logging is today.browser.test.tsx's, the double-dose warning
// doubleDose.browser.test.tsx's.

const RECIPIENT_HERE = fx.recipient({ timeZone: TEST_TIME_ZONE });
/** Due at a time of its own, 5 minutes back. */
const T1 = clockAt(-5);
const DONEPEZIL = fx.medication({
  name: "Donepezil",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: T1 }] },
});
/** As needed, at most once a day. */
const ONDANSETRON = fx.medication({
  name: "Ondansetron",
  strength: "4 mg",
  dose: "1 tablet",
  schedule: { type: "asNeeded", maxPerDay: 1 },
});
const STOPPED = fx.medication({
  name: "Amoxicillin",
  strength: "500 mg",
  schedule: { type: "scheduled", slots: [{ time: "14:00" }] },
  status: "completed",
  startedOn: "2027-05-01",
  stoppedOn: "2027-05-20",
});

/** Where the list's Log goes, so landing on it shows. */
const DOSE_SHEET = {
  path: "/app/groups/:groupId/timeline/new/dose",
  module: { default: () => <p data-dose-sheet /> },
};

const open = async (url: string, role: "caretaker" | "viewer" = "caretaker", fixtures: Fixture[] = []) =>
  renderWithDevice({
    route: [...MEDICATION_ROUTES, DOSE_SHEET],
    url,
    role,
    fixtures: [RECIPIENT_HERE, DONEPEZIL, ONDANSETRON, STOPPED, ...fixtures],
  });

const doses = (device: { query: <T>(sql: string) => Promise<T[]> }) => device.query<DoseRow>(DOSES_SQL);
const slotRow = () => document.querySelector<HTMLElement>(`main [data-slot="${DONEPEZIL.id}@${T1}"]`);
const asNeededRow = () => document.querySelector<HTMLElement>(`main [data-as-needed="${ONDANSETRON.id}"]`);
const listRow = (id: string) => document.querySelector<HTMLElement>(`main li[data-medication-id="${id}"]`);
const LOGS = "[data-log-dose], [data-log-as-needed]";

beforeEach(() => {
  fixClock(CLOCK);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("on Schedule", () => {
  test("a tap on the card's body opens the medication", async () => {
    const device = await open(SCHEDULE);
    const amount = await found(() => slotRow()?.querySelector<HTMLElement>("p.text-sm"));
    await userEvent.click(amount, { force: true });
    await expect.poll(() => device.location()).toBe(medicationUrl(DONEPEZIL.id));
  });

  test("the ⋯ menu, Given and an as-needed Log never open it", async () => {
    const device = await open(SCHEDULE);
    await userEvent.click(await found(() => slotRow()?.querySelector('[aria-label^="More for"]')));
    await expect.poll(() => menuItem("Skipped…")).toBeTruthy();
    expect(device.location()).toBe(SCHEDULE);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => menuItem("Skipped…")).toBeUndefined();

    await userEvent.click(await found(() => slotRow()?.querySelector("[data-give]")));
    await expect.poll(async () => (await doses(device)).length).toBe(1);
    await userEvent.click(await found(() => asNeededRow()?.querySelector("[data-log-as-needed]")));
    await expect.poll(async () => (await doses(device)).length).toBe(2);
    expect(device.location()).toBe(SCHEDULE);
  });
});

describe("on the list", () => {
  test("a tap on the card opens it; a stopped one has no Log", async () => {
    const device = await open(LIST);
    expect(listRow(STOPPED.id)?.querySelector(LOGS)).toBeNull();
    const summary = await found(() =>
      listRow(DONEPEZIL.id)?.querySelector<HTMLElement>("[data-medication-summary]"),
    );
    await userEvent.click(summary, { force: true });
    await expect.poll(() => device.location()).toBe(medicationUrl(DONEPEZIL.id));
  });

  test("Log on a scheduled medication opens the Dose sheet on it", async () => {
    const device = await open(LIST);
    await userEvent.click(await found(() => listRow(DONEPEZIL.id)?.querySelector("[data-log-dose]")));
    await expect.poll(() => device.location()).toBe(appUrls.newDose(GROUP, { medicationId: DONEPEZIL.id }));
    expect(await doses(device)).toHaveLength(0);
  });

  test("an as-needed Log logs a dose now; past the maximum it asks first and saves on Log anyway", async () => {
    const device = await open(LIST);
    const log = () => listRow(ONDANSETRON.id)?.querySelector<HTMLElement>("[data-log-as-needed]");
    await userEvent.click(await found(log));
    await expect.poll(async () => (await doses(device)).length).toBe(1);
    await device.settle();
    expect(device.location()).toBe(LIST);
    await userEvent.click(await found(log));
    await expect.poll(() => OPEN_DIALOG()?.textContent ?? "").toContain("1 of 1 already given today");
    expect(await doses(device)).toHaveLength(1);
    await userEvent.click(await found(() => dialogButton("Log anyway")));
    await expect.poll(async () => (await doses(device)).length).toBe(2);
    expect(await doses(device)).toMatchObject([
      { medicationId: ONDANSETRON.id, status: "given", amount: "1 tablet" },
      { medicationId: ONDANSETRON.id, status: "given", amount: "1 tablet" },
    ]);
  });

  test("a viewer sees no Log", async () => {
    await open(LIST, "viewer");
    await expect.poll(() => listRow(DONEPEZIL.id)).toBeTruthy();
    expect(document.querySelectorAll(`main ${LOGS}`)).toHaveLength(0);
  });
});
