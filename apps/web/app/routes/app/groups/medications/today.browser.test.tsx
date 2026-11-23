import type { Fixture } from "../../../../../test/fixtures";
import type { DoseRow } from "./medicationWorld";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { fixClock, found } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { fx, medicationPass } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import {
  clockAt,
  clockMoment,
  DOSES_SQL,
  SCHEDULE,
  MEDICATION_ROUTES,
  menuItem,
  OPEN_DIALOG,
  dialogButton,
  CLOCK,
} from "./medicationWorld";

// Today on the Schedule tab (medications.mjs's Today, pass
// slot and Given all steps), on a fixed clock: 10:00 on Wednesday Jun 9 2027 in
// Los Angeles, the recipient's zone and the test browser's. Times of their
// own and passes a few minutes back are due; one tap logs Given, the ⋯ marks
// Skipped or Refused with a note, an as-needed medication past its maximum
// asks first; Given all logs a pass's open medications in one round with
// Undo; a dose from another device shows who logged it; a viewer gets the
// states without controls. The device never connects, so every write here is
// the offline one too (it's queued). What's due is dueDoses.test.ts's and
// duePasses.test.ts's; a round's upload is syncMedications.int.test.ts's.

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });

/** Donepezil at two times of its own, both due (6 and 3 minutes back). */
const T1 = clockAt(-6);
const T2 = clockAt(-3);
const DONEPEZIL = fx.medication({
  name: "Donepezil",
  strength: "5 mg",
  dose: "1 tablet",
  schedule: { type: "scheduled", slots: [{ time: T1 }, { time: T2 }] },
});
/** As needed, at most once a day. */
const ONDANSETRON = fx.medication({
  name: "Ondansetron",
  strength: "4 mg",
  dose: "1 tablet",
  schedule: { type: "asNeeded", maxPerDay: 1 },
});

/** Two passes, 7 and 4 minutes back: three medications in the first (one with its own amount), one in the second. */
const R1 = clockAt(-7);
const ROUNDS = medicationPass({ name: "Rounds", time: R1, sortOrder: 0 });
const ROUND_2 = medicationPass({ name: "Round 2", time: clockAt(-4), sortOrder: 1 });
const inPass = (name: string, passId: string, amount?: string) =>
  fx.medication({
    name,
    strength: "5 mg",
    dose: "1 tablet",
    schedule: { type: "scheduled", slots: [{ passId, ...(amount && { amount }) }] },
  });
const XA = inPass("Xa", ROUNDS.id, "2 tablets");
const YB = inPass("Yb", ROUNDS.id);
const ZC = inPass("Zc", ROUNDS.id);
const WD = inPass("Wd", ROUND_2.id);

const TODAY = () => document.querySelector<HTMLElement>("main [data-today]");
const slot = (medicationId: string, time: string, root = TODAY()) =>
  root?.querySelector<HTMLElement>(`[data-slot="${medicationId}@${time}"]`) ?? null;
const slotState = (medicationId: string, time: string, root = TODAY()) =>
  slot(medicationId, time, root)?.querySelector<HTMLElement>("[data-slot-state]")?.dataset.slotState ?? null;
const card = (passId: string) => TODAY()?.querySelector<HTMLElement>(`[data-pass="pass:${passId}"]`) ?? null;
const cardState = (passId: string) => card(passId)?.dataset.passState ?? null;
const UNDO = () => document.querySelector<HTMLElement>("[data-pass-undo-label]")?.textContent?.trim() ?? null;

/** The list with Today on it (`useDueDoses` answers a moment after the first paint). */
const open = async (fixtures: Fixture[], role: "owner" | "caretaker" | "viewer" = "caretaker") => {
  const device = await renderWithDevice({
    route: MEDICATION_ROUTES,
    url: SCHEDULE,
    role,
    fixtures: [SAM, fixtures],
  });
  await expect.poll(() => TODAY()?.querySelector("[data-slot], [data-as-needed]")).toBeTruthy();
  return device;
};

const doses = async (device: { query: <T>(sql: string) => Promise<T[]> }) => device.query<DoseRow>(DOSES_SQL);

/** Open a slot's ⋯, choose Skipped… or Refused…, type a note and confirm. */
const mark = async (row: HTMLElement, item: "Skipped…" | "Refused…", note: string) => {
  await userEvent.click(await found(() => row.querySelector('[aria-label^="More for"]')));
  await expect.poll(() => menuItem(item)).toBeTruthy();
  await userEvent.click(await found(() => menuItem(item)));
  await expect.poll(() => OPEN_DIALOG()?.querySelector("textarea")).toBeTruthy();
  await userEvent.type(await found(() => OPEN_DIALOG()?.querySelector("textarea")), note);
  await userEvent.click(
    await found(() => dialogButton(item === "Skipped…" ? "Mark skipped" : "Mark refused")),
  );
};

const expand = async (passId: string) => {
  const button = card(passId)!.querySelector<HTMLElement>("[data-pass-expand]")!;
  if (button.getAttribute("aria-expanded") !== "true") await userEvent.click(button);
  await expect.poll(() => button.getAttribute("aria-expanded")).toBe("true");
};

beforeEach(() => {
  fixClock(CLOCK);
});
afterEach(() => {
  clearUndo();
  vi.useRealTimers();
});

describe("times of their own", () => {
  test("both slots due; one tap on Given logs the slot now with the medication's dose, queued", async () => {
    const device = await open([DONEPEZIL]);
    expect(slotState(DONEPEZIL.id, T1)).toBe("due");
    expect(slotState(DONEPEZIL.id, T2)).toBe("due");
    await expect.poll(() => TODAY()?.textContent).not.toContain("Times are");
    await userEvent.click(await found(() => slot(DONEPEZIL.id, T1)?.querySelector("[data-give]")));
    await expect.poll(() => slotState(DONEPEZIL.id, T1)).toBe("given");
    expect(slotState(DONEPEZIL.id, T2)).toBe("due");
    expect(await doses(device)).toMatchObject([
      { medicationId: DONEPEZIL.id, status: "given", amount: "1 tablet", scheduledFor: T1 },
    ]);
    const queued = (await device.queued()).filter((w) => w.type === "timeline_entry");
    expect(queued).toHaveLength(1);
  });

  test("Skipped… asks for a note, then marks the slot skipped with it", async () => {
    const device = await open([DONEPEZIL]);
    await mark(slot(DONEPEZIL.id, T2)!, "Skipped…", "Asleep");
    await expect.poll(() => slotState(DONEPEZIL.id, T2)).toBe("skipped");
    await expect.poll(() => OPEN_DIALOG()).toBeNull();
    expect(await doses(device)).toMatchObject([
      { medicationId: DONEPEZIL.id, status: "skipped", scheduledFor: T2, note: "Asleep", amount: null },
    ]);
  });

  test("with the recipient in New York, her slots are read in her zone, and Today says whose times they are", async () => {
    // 13:00 in New York is 10:00 here: a slot at 12:57 New York time is due now.
    const NY = fx.medication({
      name: "Donepezil",
      strength: "5 mg",
      schedule: { type: "scheduled", slots: [{ time: "12:57" }, { time: T1 }] },
    });
    await open([fx.recipient({ timeZone: "America/New_York" }), NY]);
    expect(slotState(NY.id, "12:57")).toBe("due");
    // 09:54 New York time was three hours ago here: overdue.
    expect(slotState(NY.id, T1)).toBe("overdue");
    await expect.poll(() => TODAY()?.textContent).toContain("Times are New York time");
  });

  test("a viewer sees Today and each slot's state, with no logging controls", async () => {
    await open([DONEPEZIL, ONDANSETRON, ROUNDS, XA], "viewer");
    expect(slotState(DONEPEZIL.id, T1)).toBe("due");
    await expect.poll(() => TODAY()?.querySelector("[data-as-needed]")).toBeTruthy();
    // A pass's expand isn't a logging control.
    await expect.poll(() => TODAY()?.querySelectorAll("button:not([data-pass-expand])")).toHaveLength(0);
  });
});

describe("as needed", () => {
  test("Log counts it; past the maximum the next Log asks first ('1 of 1 already given today') and saves on Log anyway", async () => {
    const device = await open([ONDANSETRON]);
    const row = () => TODAY()!.querySelector<HTMLElement>(`[data-as-needed="${ONDANSETRON.id}"]`)!;
    expect(row().textContent).toContain("0 of 1 today");
    await userEvent.click(await found(() => row().querySelector("[data-log-as-needed]")));
    await expect.poll(() => row().textContent).toContain("1 of 1 today");
    await userEvent.click(await found(() => row().querySelector("[data-log-as-needed]")));
    await expect.poll(() => OPEN_DIALOG()?.textContent ?? "").toContain("1 of 1 already given today");
    expect(await doses(device)).toHaveLength(1);
    await userEvent.click(await found(() => dialogButton("Log anyway")));
    await expect.poll(() => row().textContent).toContain("2 of 1 today");
    expect(await doses(device)).toMatchObject([
      { medicationId: ONDANSETRON.id, status: "given", amount: "1 tablet" },
      { medicationId: ONDANSETRON.id, status: "given", amount: "1 tablet" },
    ]);
  });
});

describe("passes", () => {
  const passWorld = [ROUNDS, ROUND_2, XA, YB, ZC, WD];

  test("Today groups by pass: its name, Due and Given all for writers; a slot in it shows the pass's amount", async () => {
    await open(passWorld);
    expect(cardState(ROUNDS.id)).toBe("due");
    expect(card(ROUNDS.id)?.querySelector("[data-pass-name]")?.textContent).toBe("Rounds");
    expect(card(ROUNDS.id)?.querySelector("[data-pass-badge]")?.textContent).toBe("Due");
    expect(card(ROUNDS.id)?.querySelector("[data-given-all]")).toBeTruthy();
    await expand(ROUNDS.id);
    expect(slot(XA.id, R1, card(ROUNDS.id))?.textContent).toContain("2 tablets");
    expect(slot(YB.id, R1, card(ROUNDS.id))?.textContent).not.toContain("2 tablets");
  });

  test("a pass slot's Given logs the dose with its pass and amount; once the pass moves, that dose still answers its slot", async () => {
    const device = await open([ROUNDS, XA]);
    await expand(ROUNDS.id);
    await userEvent.click(await found(() => slot(XA.id, R1)?.querySelector("[data-give]")));
    await expect.poll(() => slotState(XA.id, R1)).toBe("given");
    expect(await doses(device)).toMatchObject([
      { medicationId: XA.id, passId: ROUNDS.id, amount: "2 tablets", scheduledFor: R1 },
    ]);
    // The pass retimed (another device, or the Passes screen): the slot moves with it, still given.
    const later = clockAt(-2);
    await device.sync(medicationPass({ id: ROUNDS.id, name: "Rounds", time: later, sortOrder: 0 }));
    await device.settle();
    expect(slot(XA.id, R1)).toBeNull();
    expect(slotState(XA.id, later)).toBe("given");
    expect(cardState(ROUNDS.id)).toBe("done");
  });

  test("Given all logs every open medication in one round with each slot's amount, offers Undo; Undo removes exactly those doses", async () => {
    const device = await open(passWorld);
    await userEvent.click(await found(() => card(ROUNDS.id)?.querySelector("[data-given-all]")));
    await expect.poll(() => cardState(ROUNDS.id)).toBe("done");
    await expect.poll(UNDO).toBe("Rounds logged");
    const logged = await doses(device);
    expect(logged.map((d) => d.medicationId).sort()).toEqual([XA.id, YB.id, ZC.id].sort());
    expect(new Set(logged.map((d) => d.passLogId)).size).toBe(1);
    expect(logged[0]?.passLogId).toBeTruthy();
    expect(logged.find((d) => d.medicationId === XA.id)?.amount).toBe("2 tablets");
    expect(logged.every((d) => d.passId === ROUNDS.id && d.status === "given")).toBe(true);
    // The other pass is untouched.
    expect(cardState(ROUND_2.id)).toBe("due");

    await userEvent.click(getByCss("[data-pass-undo-button]"));
    await expect.poll(() => cardState(ROUNDS.id)).toBe("due");
    await expect.poll(UNDO).toBeNull();
    expect(card(ROUNDS.id)?.hasAttribute("data-pass-partly")).toBe(false);
    expect(await doses(device)).toHaveLength(0);
    // Soft deletes: the three rows stay, deleted.
    const all = await device.query<{ n: number }>(
      "SELECT count(*) AS n FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NOT NULL",
    );
    expect(all[0]?.n).toBe(3);
  });

  test("Refused… in a pass, and a dose from another device with who logged it; Given all then logs only what's open, in the same round", async () => {
    const device = await open(passWorld);
    await expand(ROUNDS.id);
    await mark(slot(YB.id, R1)!, "Refused…", "Spat it out");
    await expect.poll(() => slotState(YB.id, R1)).toBe("refused");
    const [refused] = await doses(device);
    expect(refused).toMatchObject({ status: "refused", note: "Spat it out", passId: ROUNDS.id });
    expect(refused?.passLogId).toBeTruthy();

    // Sam gives Xa on his phone, in the same round.
    await device.sync(
      fx.dose({
        medicationId: XA.id,
        createdBy: SAM.id,
        occurredAt: clockMoment(-1),
        details: JSON.stringify({
          medicationId: XA.id,
          status: "given",
          amount: "2 tablets",
          scheduledFor: R1,
          passId: ROUNDS.id,
          passLogId: refused!.passLogId,
        }),
      }),
    );
    await device.settle();
    expect(slotState(XA.id, R1)).toBe("given");
    expect(slot(XA.id, R1)?.querySelector("[data-logged-by]")?.textContent).toBe("by Sam Okafor");
    const summary = card(ROUNDS.id)!.querySelector("[data-pass-summary]")!.textContent;
    expect(summary).toContain("Sam Okafor");
    expect(summary).toContain("logged 2 of 3");
    expect(card(ROUNDS.id)?.querySelector("[data-pass-badge]")?.textContent).toBe("Due · 1 left");

    await userEvent.click(await found(() => card(ROUNDS.id)?.querySelector("[data-given-all]")));
    await expect.poll(() => cardState(ROUNDS.id)).toBe("done");
    const after = await doses(device);
    expect(after.map((d) => [d.medicationId, d.status])).toEqual(
      expect.arrayContaining([
        [XA.id, "given"],
        [YB.id, "refused"],
        [ZC.id, "given"],
      ]),
    );
    expect(after).toHaveLength(3);
    expect(new Set(after.map((d) => d.passLogId)).size).toBe(1);
    // Only Zc's is this device's new write (Sam's came by sync).
    const queued = (await device.queued()).filter((w) => w.type === "timeline_entry");
    expect(queued).toHaveLength(2);
  });

  test("two single Given taps in one pass share one round", async () => {
    const device = await open([ROUNDS, XA, YB]);
    await expand(ROUNDS.id);
    await userEvent.click(await found(() => slot(XA.id, R1)?.querySelector("[data-give]")));
    await expect.poll(() => slotState(XA.id, R1)).toBe("given");
    await userEvent.click(await found(() => slot(YB.id, R1)?.querySelector("[data-give]")));
    await expect.poll(() => slotState(YB.id, R1)).toBe("given");
    const logged = await doses(device);
    expect(logged).toHaveLength(2);
    expect(logged[0]?.passLogId).toBeTruthy();
    expect(new Set(logged.map((d) => d.passLogId)).size).toBe(1);
  });

  test("Given all, Undo, then Given on one slot shows that slot given once", async () => {
    const device = await open([ROUNDS, XA, YB]);
    await userEvent.click(await found(() => card(ROUNDS.id)?.querySelector("[data-given-all]")));
    await expect.poll(() => cardState(ROUNDS.id)).toBe("done");
    await expect.poll(UNDO).toBe("Rounds logged");
    await userEvent.click(getByCss("[data-pass-undo-button]"));
    await expect.poll(() => cardState(ROUNDS.id)).toBe("due");
    await expand(ROUNDS.id);
    await userEvent.click(await found(() => slot(XA.id, R1)?.querySelector("[data-give]")));
    await expect.poll(() => slotState(XA.id, R1)).toBe("given");
    expect(slotState(YB.id, R1)).toBe("due");
    expect((await doses(device)).map((d) => d.medicationId)).toEqual([XA.id]);
  });

  test("two Given doses on yesterday's slot leave today's due, not given", async () => {
    const DAY = 24 * 60;
    const added = clockMoment(-3 * DAY);
    const med = fx.medication({
      name: "Xa",
      strength: "5 mg",
      dose: "1 tablet",
      startedOn: added.slice(0, 10),
      createdAt: added,
      updatedAt: added,
      schedule: { type: "scheduled", slots: [{ passId: ROUNDS.id }] },
    });
    const yesterdays = [-DAY - 5, -DAY + 10].map((minutes) =>
      fx.dose({
        medicationId: med.id,
        occurredAt: clockMoment(minutes),
        details: JSON.stringify({
          medicationId: med.id,
          status: "given",
          amount: "1 tablet",
          scheduledFor: R1,
          passId: ROUNDS.id,
        }),
      }),
    );
    await open([ROUNDS, med, ...yesterdays]);
    await expect.poll(() => cardState(ROUNDS.id)).toBe("due");
    await expand(ROUNDS.id);
    expect(slotState(med.id, R1)).toBe("due");
  });

  test("a viewer sees each pass's state, with no Given all, Given or ⋯", async () => {
    await open(passWorld, "viewer");
    expect(cardState(ROUND_2.id)).toBe("due");
    for (const id of [ROUNDS.id, ROUND_2.id])
      expect(
        card(id)?.querySelectorAll("[data-given-all], [data-give], [aria-label^='More for']"),
      ).toHaveLength(0);
    expect(document.querySelector<HTMLElement>("[data-pass-undo]")).toBeNull();
  });
});
