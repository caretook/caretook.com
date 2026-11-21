import type { DeviceRoute } from "../../../../../test/device";
import type { Fixture } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { allergy, at, fx, medicationPass, TEST_GROUP } from "../../../../../test/fixtures";
import { medicationChangeId } from "@caretook/data/schema";
import { clearAddedNotice } from "~/lib/medications/addedNotice";
import { clearUndo } from "~/lib/medications/passUndo";
import { updatePass } from "~/lib/medications/medicationPasses.sync";
import { updateMedication } from "~/lib/medications/medications.sync";
import {
  AMOXICILLIN,
  clockAt,
  clockMoment,
  daysAgo,
  DOSES_SQL,
  EVENING,
  fixClock,
  LISINOPRIL,
  MEDICATION_ROUTES,
  METFORMIN,
  MORNING,
  OXYBUTYNIN,
  RECIPIENT,
  world as medicationWorld,
} from "../medications/medicationWorld";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as newDose from "./new-dose/route";
import * as timeline from "./route";
import {
  chip,
  chips,
  closeFilters,
  openFilters,
  rowKinds,
  rows,
  rowWith,
  setView,
  tapAt,
  TIMELINE_URL,
} from "./timelineWorld";

// Doses and medication changes on the timeline, and the Dose sheet
// (medications.mjs's timeline steps, its Dose sheet warnings and pass, and
// the change rows of its pass steps): rows and cards name the medication and
// what happened; the kind chips and icons filter them; a writer logs a dose
// (the amount follows the medication), edits it (the medication fixed) and
// deletes it; an earlier time lands on its day; a change opens nothing and
// deletes from its ⋯; a slot already given warns before a second dose; a
// due pass leads the sheet with Given all; a viewer has no Dose button and
// rows that open nothing. The device never connects, so every write is the
// offline one too (queued). Wording is medicationDisplay.test.ts's; the +
// menu's order is timelineHeader.browser.test.tsx's.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [
      { path: "/app/groups/:groupId/timeline/new/dose", module: newDose },
      { path: "/app/groups/:groupId/timeline/new/:kind", module: newSheet },
      { path: "/app/groups/:groupId/timeline/:entryId/edit", module: editSheet },
    ],
  },
];

/** The medications' world, plus a skipped and a refused dose and Amoxicillin's completion. */
const doseWorld = (): Fixture[] => [
  ...medicationWorld(),
  fx.dose({ medicationId: METFORMIN.id, status: "skipped", amount: null, occurredAt: at(daysAgo(1, 20, 5)) }),
  fx.dose({ medicationId: METFORMIN.id, status: "refused", amount: null, occurredAt: at(daysAgo(2, 20, 5)) }),
  fx.medicationChange({
    medicationId: AMOXICILLIN.id,
    occurredAt: at(daysAgo(14, 10)),
    details: JSON.stringify({ medicationId: AMOXICILLIN.id, change: "stopped", stopStatus: "completed" }),
  }),
];

/** The timeline (or a sheet over it), once its first rows are in. */
const open = async (
  options: Partial<Parameters<typeof renderWithDevice>[0]> & { query?: string; empty?: boolean } = {},
) => {
  const { query = "", empty = false, ...rest } = options;
  const device = await renderWithDevice({
    route: ROUTES,
    url: `${TIMELINE_URL}${query}`,
    role: "caretaker",
    fixtures: doseWorld(),
    ...rest,
  });
  if (empty) return device;
  await expect.poll(() => rows().length).toBeGreaterThan(0);
  // A row says "Medication" for a moment, until the window's medications answer.
  await expect.poll(() => texts().some((t) => t.startsWith("Medication:"))).toBe(false);
  return device;
};

const texts = () =>
  rows().map((li) => li.querySelector("[data-medication-entry]")?.textContent?.trim() ?? "");
const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
const radio = (name: string, label: string) =>
  SHEET()?.querySelector<HTMLInputElement>(`input[name="${name}"][aria-label="${label}"]`) ?? null;
const status = (value: string) =>
  SHEET()!.querySelector<HTMLInputElement>(`input[name="status"][value="${value}"]`)!;
const AMOUNT = () => SHEET()!.querySelector<HTMLInputElement>('input[name="amount"]')!;
const NOTE = () => SHEET()!.querySelector<HTMLTextAreaElement>('textarea[name="note"]')!;
const SUBMIT = () => SHEET()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const confirmDelete = async () => {
  await expect.poll(() => document.querySelector("dialog[open]")).toBeTruthy();
  await userEvent.click(
    [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")].find(
      (b) => b.textContent?.trim() === "Delete",
    )!,
  );
};
const dayOf = (text: string) => rowWith(text)?.closest("section")?.querySelector("h3")?.textContent?.trim();
const doses = (device: { query: <T>(sql: string) => Promise<T[]> }) =>
  device.query<{
    id: string;
    medicationId: string;
    status: string;
    amount: string | null;
    note: string | null;
  }>(DOSES_SQL);

/** Open the Dose sheet from the + menu. */
const openDoseSheet = async () => {
  await userEvent.click(page.getByRole("button", { name: "Add to Today" }));
  await userEvent.click(page.getByRole("menuitem", { name: "Dose", exact: true }));
  await expect.poll(() => SHEET()?.querySelector('input[name="medicationId"]')).toBeTruthy();
};

afterEach(() => {
  clearUndo();
  clearAddedNotice();
  vi.useRealTimers();
});

describe("on the timeline", () => {
  test("?kind=dose lists only doses, each named by its medication and strength (a link to its page): Given, Skipped, Refused", async () => {
    await open({ query: "?kind=dose" });
    expect(rowKinds()).toBe("Dose: ");
    // A row can say "Medication" for a moment, until the window's medications answer.
    await expect
      .poll(texts)
      .toEqual([
        "Metformin 500 mg: Skipped",
        "Lisinopril 10 mg: Given 1 tablet",
        "Metformin 500 mg: Refused",
        "Lisinopril 10 mg: Given 1 tablet",
      ]);
    expect(rows()[1]!.querySelector("[data-medication]")?.getAttribute("href")).toBe(
      `/app/groups/${TEST_GROUP.id}/medications/${LISINOPRIL.id}`,
    );
    await openFilters();
    expect(chips().map((a) => a.textContent?.trim())).toEqual(
      expect.arrayContaining(["Doses", "Medication changes"]),
    );
    expect(chip("Doses").getAttribute("aria-current")).toBe("true");
  });

  test("Medication changes lists only changes (Started, a strength change, stops with their reason); cards say the same", async () => {
    const device = await open({ query: "?kind=dose" });
    await openFilters();
    await userEvent.click(chip("Medication changes"));
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=medicationChange`);
    await closeFilters();
    await device.settle();
    expect(rowKinds()).toBe("Medication change: ");
    await expect
      .poll(texts)
      .toEqual(
        expect.arrayContaining([
          "Lisinopril 10 mg: Changed strength 5 mg → 10 mg",
          "Lisinopril 10 mg: Started",
          "Oxybutynin 5 mg: Discontinued: side effects",
          "Amoxicillin 500 mg: Completed",
        ]),
      );
    await setView("Cards");
    expect(
      rowWith("Changed strength 5 mg → 10 mg")?.querySelector("[data-medication-entry]")?.textContent,
    ).toBe("Lisinopril 10 mg: Changed strength 5 mg → 10 mg");
  });

  test("a dose's kind icon is Show only doses, and filters", async () => {
    const device = await open();
    const dose = rows().find((li) => li.querySelector(".sr-only")?.textContent === "Dose: ")!;
    const icon = dose.querySelector<HTMLAnchorElement>('a[aria-label="Show only doses"]')!;
    await userEvent.click(icon);
    await expect.poll(() => device.location()).toBe(`${TIMELINE_URL}?kind=dose`);
  });

  test("a change opens nothing and its ⋯ is Delete only; Delete removes it and the medication stays; its edit URL is the timeline, filters kept", async () => {
    const device = await open({ query: "?kind=medicationChange" });
    const row = () => rowWith("Changed strength 5 mg → 10 mg");
    await expect
      .poll(() => row()?.querySelector('a[aria-label^="Edit "], a[aria-label^="Open "]'))
      .toBeNull();
    await userEvent.click(row()!.querySelector('button[aria-label^="Actions for"]')!);
    await expect.poll(menuItems).toEqual(["Delete"]);
    await userEvent.click(menuItem("Delete")!);
    await confirmDelete();
    await expect.poll(row).toBeUndefined();
    const [med] = await device.query<{ deleted_at: string | null }>(
      "SELECT deleted_at FROM medication WHERE id = ?",
      [LISINOPRIL.id],
    );
    expect(med!.deleted_at).toBeNull();
    await device.screen.unmount();

    const [started] = await device.query<{ id: string }>(
      "SELECT id FROM timeline_entry WHERE kind = 'medicationChange' AND deleted_at IS NULL AND json_extract(details, '$.medicationId') = ?",
      [OXYBUTYNIN.id],
    );
    const again = await open({ url: `${TIMELINE_URL}/${started!.id}/edit?kind=medicationChange` });
    await expect.poll(() => again.location()).toBe(`${TIMELINE_URL}?kind=medicationChange`);
    expect(SHEET()).toBeNull();
  });

  test("a pass's retime is one line naming no medication; a schedule edit's row names the pass and the amount", async () => {
    const device = await open({
      query: "?kind=medicationChange",
      fixtures: [doseWorld(), MORNING, EVENING],
    });
    expect((await updatePass(device.db, MORNING.id, { time: "08:30" })).ok).toBe(true);
    const metoprolol = fx.medication({
      name: "Metoprolol",
      strength: null,
      dose: "25 mg",
      schedule: {
        type: "scheduled",
        slots: [{ passId: MORNING.id, amount: "50 mg" }, { passId: EVENING.id }],
      },
    });
    await device.sync(metoprolol);
    const edited = await updateMedication(device.db, metoprolol.id, {
      schedule: { type: "scheduled", slots: [{ passId: MORNING.id, amount: "75 mg" }] },
    });
    expect(edited.ok).toBe(true);
    await device.settle();
    expect([...document.querySelectorAll("main [data-pass-moved]")].map((el) => el.textContent)).toEqual([
      "Morning moved 8:00 → 8:30",
    ]);
    expect(texts()).toContain("Metoprolol: Removed from Evening; Morning amount 50 mg → 75 mg");
  });

  test("a viewer sees doses with no + button, no row that opens a sheet and no ⋯; /new/dose is the timeline, filters kept", async () => {
    const device = await open({ role: "viewer", query: "?kind=dose" });
    expect(rows().length).toBeGreaterThan(0);
    expect(document.querySelector('main header button[aria-label="Add to timeline"]')).toBeNull();
    expect(
      document.querySelector('main ol a[aria-label^="Edit "], main ol a[aria-label^="Open "]'),
    ).toBeNull();
    expect(document.querySelector('main ol button[aria-label^="Actions"]')).toBeNull();
    await device.screen.unmount();
    const sheet = await open({ role: "viewer", url: `${TIMELINE_URL}/new/dose?kind=dose` });
    await expect.poll(() => sheet.location()).toBe(`${TIMELINE_URL}?kind=dose`);
    expect(SHEET()).toBeNull();
  });
});

describe("the Dose sheet", () => {
  // Never given; as needed, so it has no due slot.
  const IBUPROFEN = fx.medication({
    name: "Ibuprofen",
    strength: "200 mg",
    dose: "2 tablets",
    schedule: { type: "asNeeded", maxPerDay: 3 },
  });
  const LABEL = "Ibuprofen 200 mg";
  const withIbuprofen = () => [doseWorld(), IBUPROFEN];

  test("offers current medications only, the most recently given first; the amount follows the choice; a dose with a note shows at once, queued", async () => {
    const device = await open({ query: "?kind=dose", fixtures: withIbuprofen() });
    await openDoseSheet();
    // Due slots come first ("… · 20:00 dose"); the medications follow.
    const options = [...SHEET()!.querySelectorAll('input[name="medicationId"]')]
      .map((r) => r.getAttribute("aria-label")!)
      .filter((l) => !l.includes(" · "));
    expect(options[0]).toBe("Lisinopril 10 mg");
    expect(options).toContain(LABEL);
    expect(options.some((o) => /Oxybutynin|Amoxicillin/.test(o))).toBe(false);
    const first = AMOUNT().value;
    expect(first).not.toBe("");
    await userEvent.click(radio("medicationId", LABEL)!);
    await expect.poll(() => AMOUNT().value).toBe("2 tablets");
    await userEvent.fill(NOTE(), "With lunch");
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith(`${LABEL}: Given 2 tablets`)).toBeTruthy();
    expect(rowWith(LABEL)!.querySelector("[data-medication-note]")?.textContent).toBe("With lunch");
    const logged = (await doses(device)).filter((d) => d.medicationId === IBUPROFEN.id);
    expect(logged).toMatchObject([{ status: "given", amount: "2 tablets", note: "With lunch" }]);
    expect((await device.queued()).some((w) => w.type === "timeline_entry" && w.id === logged[0]!.id)).toBe(
      true,
    );
  });

  test("a dose opens its edit sheet with the medication fixed; Skipped saves; its ⋯ has Edit and Delete, and Delete removes it", async () => {
    const dose = fx.dose({
      medicationId: IBUPROFEN.id,
      amount: "2 tablets",
      occurredAt: at(new Date(Date.now() - 600_000)),
    });
    const device = await open({ query: "?kind=dose", fixtures: [withIbuprofen(), dose] });
    await tapAt(rowWith(LABEL)!.querySelector('a[aria-label^="Edit "]')!);
    await expect
      .poll(() => SHEET()?.querySelector("[data-dose-medication]")?.textContent?.trim())
      .toBe(LABEL);
    await expect.poll(() => SHEET()?.querySelector('input[name="medicationId"]')).toBeNull();
    await userEvent.click(status("skipped"));
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => rowWith(`${LABEL}: Skipped`)).toBeTruthy();

    await userEvent.click(rowWith(LABEL)!.querySelector('button[aria-label^="Actions for"]')!);
    await expect.poll(menuItems).toEqual(["Edit", "Delete"]);
    await userEvent.click(menuItem("Delete")!);
    await confirmDelete();
    await expect.poll(() => rowWith(LABEL)).toBeUndefined();
    expect((await doses(device)).some((d) => d.id === dose.id)).toBe(false);
  });

  test("a dose logged for yesterday (the calendar, one day back) is under Yesterday", async () => {
    await open({ query: "?kind=dose", fixtures: withIbuprofen() });
    await openDoseSheet();
    await userEvent.click(radio("medicationId", LABEL)!);
    SHEET()!.querySelector<HTMLElement>('[aria-label="Pick a date"]')!.focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => document.activeElement?.closest("[role=grid]")).toBeTruthy();
    await userEvent.keyboard("{ArrowLeft}{Enter}");
    await expect.poll(() => document.querySelector("[role=grid]")).toBeNull();
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => dayOf(LABEL)).toBe("Yesterday");
  });
});

describe("the Dose sheet on a fixed clock", () => {
  // 10:00 in Los Angeles: Donepezil's 9:54 slot given 5 minutes ago; a pass at 9:56 with Wd open.
  const T1 = clockAt(-6);
  const R2 = clockAt(-4);
  const DONEPEZIL = fx.medication({
    name: "Donepezil",
    strength: "5 mg",
    schedule: { type: "scheduled", slots: [{ time: T1 }] },
  });
  const ROUND_2 = medicationPass({ name: "Round 2", time: R2, sortOrder: 1 });
  const WD = fx.medication({
    name: "Wd",
    strength: "5 mg",
    schedule: { type: "scheduled", slots: [{ passId: ROUND_2.id }] },
  });

  test("a second dose for a slot already given warns before saving, and saves on Log anyway", async () => {
    fixClock();
    const given = fx.dose({ medicationId: DONEPEZIL.id, scheduledFor: T1, occurredAt: clockMoment(-5) });
    const device = await open({
      url: `${TIMELINE_URL}/new/dose?medication=${DONEPEZIL.id}&slot=${T1}`,
      fixtures: [DONEPEZIL, given],
    });
    await expect.poll(() => SHEET()?.querySelector('button[type="submit"]')).toBeTruthy();
    await userEvent.click(SUBMIT());
    await expect
      .poll(() => SHEET()?.querySelector("[data-dose-warning]")?.textContent ?? "")
      .toContain("already given");
    expect(await doses(device)).toHaveLength(1);
    expect(SUBMIT().textContent?.trim()).toBe("Log anyway");
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET, { timeout: 5000 }).toBeNull();
    expect((await doses(device)).filter((d) => d.medicationId === DONEPEZIL.id)).toHaveLength(2);
  });

  test("?pass= puts that pass first with Given all, its slots not repeated below; Given all logs it and offers Undo in the sheet", async () => {
    fixClock();
    const device = await open({
      url: `${TIMELINE_URL}/new/dose?pass=${ROUND_2.id}`,
      empty: true,
      fixtures: [ROUND_2, WD],
    });
    const card = () => SHEET()?.querySelector<HTMLElement>(`[data-pass="pass:${ROUND_2.id}"]`) ?? null;
    await expect.poll(card).toBeTruthy();
    await expect.poll(() => card()?.querySelector("[data-given-all]")).toBeTruthy();
    await expect
      .poll(() => SHEET()?.querySelector(`input[name="medicationId"][value="${WD.id}@${R2}"]`))
      .toBeNull();
    // Through the sheet: Today's card behind it has a Given all with the same name.
    await userEvent.click(page.getByRole("dialog").getByRole("button", { name: /^Given all/ }));
    await expect.poll(() => card()?.dataset.passState, { timeout: 5000 }).toBe("done");
    await expect
      .poll(() => SHEET()?.querySelector("[data-pass-undo-label]")?.textContent?.trim())
      .toBe("Round 2 logged");
    expect(await doses(device)).toMatchObject([{ medicationId: WD.id, status: "given" }]);
  });
});

describe("the Dose sheet's + New medication", () => {
  const NEW = "new";
  const NAME = () => SHEET()!.querySelector<HTMLInputElement>('input[name="name"]');
  const NEW_DOSE = () => SHEET()!.querySelector<HTMLInputElement>('input[name="dose"]');
  const typeChecked = () =>
    SHEET()!.querySelector<HTMLInputElement>('input[name="type"]:checked')?.getAttribute("aria-label") ??
    null;
  const TOAST = () => document.querySelector<HTMLElement>("[data-added-medication]");
  const added = (device: { query: <T>(sql: string) => Promise<T[]> }) =>
    device.query<{
      id: string;
      name: string;
      dose: string | null;
      type: string | null;
      status: string;
      schedule: string;
      createdAt: string;
    }>(
      "SELECT id, name, dose, type, status, schedule, created_at AS createdAt FROM medication WHERE name = 'Ibuprofen'",
    );
  const pickNew = async () => {
    await openDoseSheet();
    await userEvent.click(radio("medicationId", "+ New medication")!);
    await expect.poll(NAME).toBeTruthy();
  };

  test("is the last choice; it shows the name, the dose and the type (Prescription); the amount follows the dose until typed", async () => {
    await open({ query: "?kind=dose" });
    await openDoseSheet();
    const choices = [...SHEET()!.querySelectorAll('input[name="medicationId"]')];
    expect(choices.at(-1)?.getAttribute("aria-label")).toBe("+ New medication");
    expect(NAME()).toBeNull();
    await userEvent.click(radio("medicationId", "+ New medication")!);
    await expect.poll(NAME).toBeTruthy();
    await expect.poll(() => NAME()?.value).toBe("");
    expect(typeChecked()).toBe("Prescription");
    // The amount starts empty (nothing typed for the new one), then follows its dose.
    await expect.poll(() => AMOUNT().value).toBe("");
    await userEvent.fill(NEW_DOSE()!, "2 tablets");
    await expect.poll(() => AMOUNT().value).toBe("2 tablets");
    await userEvent.fill(AMOUNT(), "1 tablet");
    await userEvent.fill(NEW_DOSE()!, "3 tablets");
    expect(AMOUNT().value).toBe("1 tablet");
    // Back to a medication on the list: its fields go.
    await userEvent.click(radio("medicationId", "Lisinopril 10 mg")!);
    await expect.poll(NAME).toBeNull();
  });

  test("switching to a medication and back leaves the amount empty, with the dose field, not the discarded dose", async () => {
    await open({ query: "?kind=dose" });
    await pickNew();
    await userEvent.fill(NEW_DOSE()!, "2 tablets");
    await expect.poll(() => AMOUNT().value).toBe("2 tablets");
    await userEvent.click(radio("medicationId", "Lisinopril 10 mg")!);
    await expect.poll(NAME).toBeNull();
    await userEvent.click(radio("medicationId", "+ New medication")!);
    await expect.poll(NAME).toBeTruthy();
    await expect.poll(() => NEW_DOSE()!.value).toBe("");
    await expect.poll(() => AMOUNT().value).toBe("");
  });

  test("a name matching an allergy warns, without blocking", async () => {
    await open({
      query: "?kind=dose",
      fixtures: [doseWorld(), allergy({ substance: "Ibuprofen", severity: "severe" })],
    });
    await pickNew();
    await userEvent.fill(NAME()!, "Ibuprofen");
    await expect.poll(() => SHEET()!.textContent).toContain("Matches an allergy on file: Ibuprofen (severe)");
    await expect.poll(() => NAME()?.getAttribute("aria-invalid")).not.toBe("true");
  });

  test("an empty name is refused on its field, and nothing is written", async () => {
    const device = await open({ query: "?kind=dose" });
    await pickNew();
    const before = (await device.queued()).length;
    await userEvent.click(SUBMIT());
    await expect.poll(() => NAME()!.getAttribute("aria-invalid")).toBe("true");
    const describedBy = NAME()!.getAttribute("aria-describedby")!.split(" ");
    expect(describedBy.map((id) => document.getElementById(id)?.textContent).join(" ")).toContain(
      "Enter a name",
    );
    expect(SHEET()).not.toBeNull();
    expect((await device.queued()).length).toBe(before);
  });

  test("Log dose adds the medication (as needed, current) with its Started entry and the dose, in that order, queued; no dose warning asks first", async () => {
    const device = await open({ query: "?kind=dose" });
    await pickNew();
    await userEvent.fill(NAME()!, "Ibuprofen");
    await userEvent.fill(NEW_DOSE()!, "2 tablets");
    await userEvent.click(radio("type", "Over the counter")!);
    await userEvent.fill(NOTE(), "For a headache");
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET).toBeNull();

    const [medication] = await added(device);
    expect(medication).toMatchObject({
      name: "Ibuprofen",
      dose: "2 tablets",
      type: "otc",
      status: "current",
    });
    expect(JSON.parse(medication!.schedule)).toEqual({ type: "asNeeded" });
    const logged = (await doses(device)).filter((d) => d.medicationId === medication!.id);
    expect(logged).toMatchObject([{ status: "given", amount: "2 tablets", note: "For a headache" }]);
    const changeId = medicationChangeId(medication!.id, medication!.createdAt);
    const queued = (await device.queued()).map((w) => w.id);
    expect(queued.slice(-3)).toEqual([medication!.id, changeId, logged[0]!.id]);

    await expect.poll(() => rowWith("Ibuprofen: Given 2 tablets")).toBeTruthy();
  });

  test("the notice reads Added <name> once the sheet closes; Add details opens its edit sheet, over the list it's now on", async () => {
    const device = await open({ query: "?kind=medicationChange", route: [...ROUTES, ...MEDICATION_ROUTES] });
    await pickNew();
    await userEvent.fill(NAME()!, " Ibuprofen ");
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET).toBeNull();
    await expect.poll(() => TOAST()?.textContent).toContain("Added Ibuprofen");
    await expect.poll(() => rowWith("Ibuprofen: Started")).toBeTruthy();
    const [medication] = await added(device);
    expect(medication!.type).toBe("prescription");

    await userEvent.click(page.getByRole("button", { name: "Add details" }));
    await expect
      .poll(() => device.location())
      .toBe(`/app/groups/${TEST_GROUP.id}/medications/list/${medication!.id}/edit`);
    await expect
      .poll(
        () => document.querySelector<HTMLInputElement>('[data-medication-form] input[name="name"]')?.value,
      )
      .toBe("Ibuprofen");
    expect(TOAST()).toBeNull();
    expect(
      [...document.querySelectorAll("main [data-medication-name]")].map((n) => n.textContent?.trim()),
    ).toContain("Ibuprofen");
  });

  test("with no medications, the sheet opens on the new medication's fields and logs the first dose", async () => {
    const device = await open({
      url: `${TIMELINE_URL}/new/dose`,
      fixtures: [RECIPIENT, MORNING, EVENING],
      empty: true,
    });
    await expect.poll(() => SHEET()?.querySelector<HTMLInputElement>('input[name="name"]')).toBeTruthy();
    await expect
      .poll(() => SHEET()?.querySelectorAll('input[name="medicationId"][type="radio"]').length)
      .toBe(0);
    await expect
      .poll(() => SHEET()?.querySelector<HTMLInputElement>('input[name="medicationId"]')?.value)
      .toBe(NEW);
    await expect
      .poll(() => SHEET()?.querySelector("[data-no-medications]")?.textContent)
      .toContain("no current medications");
    await userEvent.fill(NAME()!, "Ibuprofen");
    await userEvent.click(SUBMIT());
    await expect.poll(SHEET).toBeNull();
    const [medication] = await added(device);
    expect((await doses(device)).map((d) => d.medicationId)).toEqual([medication!.id]);
    await expect.poll(() => TOAST()?.textContent).toContain("Added Ibuprofen");
  });
});
