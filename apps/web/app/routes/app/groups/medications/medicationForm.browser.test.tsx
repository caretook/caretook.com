import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx } from "../../../../../test/fixtures";
import {
  CHANGES_SQL,
  daysAgo,
  dialogButton,
  errorOf,
  field,
  FORM,
  historyTexts,
  LARK,
  LISINOPRIL,
  LIST,
  MEDS,
  listNames,
  MEDICATION_ROUTES,
  MEDICATION_SQL,
  medicationUrl,
  OPEN_DIALOG,
  pageAction,
  pickerChip,
  pickProvider,
  SEEDED_CURRENT,
  SHEET,
  submit,
  times,
  world,
  openAddMedication,
} from "./medicationWorld";

// Adding, editing, stopping, restarting and deleting a medication
// (medications.mjs's add, edit, status, offline form and viewer form steps):
// the add sheet over the list with name suggestions, the passes and
// validation on the fields, a new prescriber added inline and written with
// the medication in one transaction, the edit sheet from the page and back,
// a refill edit writing no change entry and a dose change writing one, the
// status actions on the page and in the edit sheet with their entries, Delete
// behind its confirm, and a viewer with no controls whose sheet URLs show the
// list. The device is offline throughout: every save here is an offline save
// queued for upload. The server writing the same change entry on upload is
// syncMedications.int.test.ts's and medication.int.test.ts's; a medication
// reaching another device is roundtrip.mjs's sync matrix (6b).

/** A medication with times of its own and a prescriber, as one added from the form would be. */
const LOSARTAN = fx.medication({
  name: "Losartan",
  strength: "25 mg",
  dose: "1 tablet",
  reason: "Blood pressure",
  schedule: { type: "scheduled", slots: [{ time: "08:00" }, { time: "20:00" }] },
  prescriberId: LARK.id,
  createdAt: at(daysAgo(3, 9)),
  updatedAt: at(daysAgo(3, 9)),
});
const LOSARTAN_STARTED = fx.medicationChange({
  medicationId: LOSARTAN.id,
  occurredAt: at(daysAgo(3, 9)),
  details: JSON.stringify({ medicationId: LOSARTAN.id, change: "started", after: { name: "Losartan" } }),
});
const TITLE = "Losartan 25 mg";

const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({
    route: MEDICATION_ROUTES,
    url,
    fixtures: [world(), LOSARTAN, LOSARTAN_STARTED],
    role: "caretaker",
    ...options,
  });

const suggestions = () =>
  [...(FORM()?.querySelectorAll("[data-name-suggestions] button") ?? [])].map((b) => b.textContent?.trim());
const suggestion = (text: string) =>
  [...(FORM()?.querySelectorAll<HTMLButtonElement>("[data-name-suggestions] button") ?? [])].find(
    (b) => b.textContent?.trim() === text,
  );
const scheduleType = (value: "scheduled" | "asNeeded") =>
  FORM()!.querySelector<HTMLInputElement>(`input[name="scheduleType"][value="${value}"]`)!;
const TIMES_ERROR = () =>
  FORM()?.querySelector("[data-schedule-times] > p.text-error")?.textContent?.trim() ?? null;
const medication = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<Record<string, unknown>>(MEDICATION_SQL, [id]))[0]!;
const changes = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<{ change: string; details: string }>(CHANGES_SQL, [id])).map((r) => ({
    change: r.change,
    ...(JSON.parse(r.details) as { before?: object; after?: object }),
  }));
/** The header's `+`, Medication, once the list is up (the first render can come before the loader's data). */
const openAddSheet = openAddMedication;
const badge = () =>
  document.querySelector<HTMLElement>('main header [data-region="title"] .badge')?.textContent ?? null;

describe("adding", () => {
  test("Add medication opens the sheet over the list; 'lis' suggests Lisinopril, which fills the name only; the passes are offered, none ticked, with no time yet", async () => {
    const device = await open(LIST);
    await openAddSheet();
    expect(device.location()).toBe(`${LIST}/new`);
    expect(listNames("Current medications")).toContain("Lisinopril 10 mg");

    await userEvent.fill(await found(() => field("name")), "lis");
    await waitUntil(() => !!suggestion("Lisinopril"), "the suggestion");
    await userEvent.click(await found(() => suggestion("Lisinopril")));
    await waitUntil(() => !FORM()?.querySelector("[data-name-suggestions]"), "the chips to go");
    expect(["name", "strength", "dose", "reason"].map((n) => field(n)!.value)).toEqual([
      "Lisinopril",
      "",
      "",
      "",
    ]);

    const passes = [...FORM()!.querySelectorAll("[data-pass-slot]")].map((li) =>
      li.querySelector("label")?.textContent?.trim(),
    );
    expect(passes).toEqual(["Morning 8:00", "Evening 20:00"]);
    await expect
      .poll(() => FORM()?.querySelectorAll('[data-pass-slot] input[type="checkbox"]:checked'))
      .toHaveLength(0);
    expect(times()).toHaveLength(0);
    await expect
      .poll(() => FORM()?.querySelector("[data-manage-passes]")?.getAttribute("href"))
      .toBe(`${MEDS}/passes`);
    expect(suggestions()).toEqual([]);
  });

  test("validation shows on the fields: a name, each time once (focus on the name), and an as-needed maximum in range", async () => {
    await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await waitUntil(() => times().length === 2, "two times");
    await userEvent.fill(await found(() => times()[0]), "08:00");
    await userEvent.fill(await found(() => times()[1]), "08:00");
    await userEvent.click(submit());
    await expect.poll(() => errorOf("name")).toBe("Enter a name");
    expect(TIMES_ERROR()).toBe("List each time once");
    await expect.poll(() => document.activeElement).toBe(field("name"));

    await userEvent.fill(await found(() => field("name")), "Albuterol");
    await userEvent.click(scheduleType("asNeeded"));
    await waitUntil(() => !!field("maxPerDay"), "the maximum");
    await userEvent.fill(await found(() => field("maxPerDay")), "30");
    await userEvent.click(submit());
    await expect.poll(() => errorOf("maxPerDay")).toBe("At most 24 a day");
  });

  test("saving with a new prescriber closes the sheet and lists it at once; the prescriber, the medication and its Started entry are one local write, queued in that order", async () => {
    const device = await open(LIST);
    await openAddSheet();
    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await waitUntil(() => times().length === 2, "two times");
    await userEvent.fill(await found(() => times()[0]), "20:00");
    await userEvent.fill(await found(() => times()[1]), "08:00");
    await userEvent.fill(await found(() => field("strength")), "25 mg");
    await userEvent.selectOptions(await found(() => field<HTMLSelectElement>("form")), "tablet");
    await userEvent.fill(await found(() => field("dose")), "1 tablet");
    await userEvent.fill(await found(() => field("reason")), "Mood");
    await pickProvider("prescriber", "Dr. Ada Moss", 'Add "Dr. Ada Moss" as a new prescriber');
    await expect.poll(() => pickerChip("prescriber")).toBe("Dr. Ada Moss (new)");
    const before = (await device.queued()).length;
    await userEvent.click(submit());

    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    await device.settle();
    expect(listNames("Current medications")).toContain("Sertraline 25 mg");
    const [made] = await device.query<{ id: string; schedule: string; prescriber: string; type: string }>(
      "SELECT m.id, m.schedule, p.name AS prescriber, p.type FROM medication m JOIN provider p ON p.id = m.prescriber_id WHERE m.name = 'Sertraline'",
    );
    expect(made).toMatchObject({ prescriber: "Dr. Ada Moss", type: "clinician" });
    expect(JSON.parse(made?.schedule ?? "null")).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }, { time: "20:00" }],
    });
    expect((await changes(device, made?.id ?? "")).map((c) => c.change)).toEqual(["started"]);
    const queued = (await device.queued()).slice(before).map((w) => `${w.op} ${w.type}`);
    expect(queued).toEqual(["PUT provider", "PUT medication", "PUT timeline_entry"]);
  });

  test("its page's history says Started", async () => {
    const device = await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(scheduleType("asNeeded"));
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    await device.settle();
    await userEvent.click(
      await found(() =>
        [...document.querySelectorAll<HTMLElement>("main [data-medication-name]")].find(
          (a) => a.textContent === "Sertraline",
        ),
      ),
    );
    await waitUntil(() => historyTexts().length > 0, "the history");
    expect(historyTexts()).toEqual(["Started"]);
  });
});

describe("editing", () => {
  const openEdit = async (device: Awaited<ReturnType<typeof open>>) => {
    await waitUntil(() => !!document.querySelector<HTMLElement>("main [data-edit-medication]"), "Edit");
    await userEvent.click(getByCss("main [data-edit-medication]"));
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(device.location()).toBe(`${LIST}/${LOSARTAN.id}/edit`);
  };

  test("Edit on the page opens the sheet filled in, with the status; a refill edit goes back to the page and writes no change entry", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await openEdit(device);
    expect(field("name")?.value).toBe("Losartan");
    expect(field("dose")?.value).toBe("1 tablet");
    expect(times().map((t) => t.value)).toEqual(["08:00", "20:00"]);
    expect(pickerChip("prescriber")).toBe("Dr. Mira Lark");
    expect(SHEET()?.querySelector("[data-status-now]")?.textContent?.trim()).toBe("Current: taken now");

    await userEvent.fill(await found(() => field("refillsLeft")), "3");
    await userEvent.fill(await found(() => field("quantity")), "30 tablets");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(LOSARTAN.id));
    await device.settle();
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ refills_left: 3, quantity: "30 tablets" });
    expect((await changes(device, LOSARTAN.id)).map((c) => c.change)).toEqual(["started"]);
  });

  test("changing the dose writes one Changed entry with before and after, newest first on the page", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await openEdit(device);
    await userEvent.fill(await found(() => field("dose")), "2 tablets");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(LOSARTAN.id));
    await device.settle();
    const entries = await changes(device, LOSARTAN.id);
    expect(entries.map((c) => c.change)).toEqual(["started", "changed"]);
    expect(entries[1]).toMatchObject({ before: { dose: "1 tablet" }, after: { dose: "2 tablets" } });
    await expect.poll(() => historyTexts()[0]).toBe("Changed dose 1 tablet → 2 tablets");
  });
});

describe("the type", () => {
  /** Added before types: its type isn't set. */
  const FOLIC = fx.medication({ name: "Folic acid", strength: "1 mg", type: null });
  /** Over the counter, with an Rx number kept from when it was a prescription. */
  const NAPROXEN = fx.medication({ name: "Naproxen", strength: "220 mg", type: "otc", rxNumber: "RX 5521" });
  const IBUPROFEN = fx.medication({ name: "Ibuprofen", strength: "200 mg", type: "otc" });

  const openWith = (url: string) => open(url, { fixtures: [world(), FOLIC, NAPROXEN, IBUPROFEN] });
  const typeRadio = (value: string) =>
    FORM()!.querySelector<HTMLInputElement>(`input[name="type"][value="${value}"]`)!;
  const checkedType = () =>
    FORM()?.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value ?? null;
  const typeGroup = () => FORM()!.querySelector<HTMLElement>('[role="radiogroup"]:has(input[name="type"])')!;
  const typeError = () => {
    const id = typeGroup().getAttribute("aria-describedby");
    return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
  };
  const details = () => FORM()!.querySelector<HTMLDetailsElement>("details[data-prescription-details]")!;
  const summaryShown = () => details().querySelector("summary")!.checkVisibility();
  const inDetails = (name: string) => !!details().querySelector(`[name="${name}"]`);
  const typeOf = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
    (await device.query<{ type: string | null }>("SELECT type FROM medication WHERE id = ?", [id]))[0]?.type;

  test("a new medication starts on Prescription, with the prescription fields in place, and saves it", async () => {
    const device = await openWith(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    expect(
      [...(FORM()?.querySelectorAll<HTMLInputElement>('input[name="type"]') ?? [])].map((r) => r.ariaLabel),
    ).toEqual(["Prescription", "Over the counter", "Supplement", "Other"]);
    expect(checkedType()).toBe("prescription");
    expect(details().open).toBe(true);
    expect(summaryShown()).toBe(false);

    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(
      await found(() =>
        FORM()?.querySelector<HTMLInputElement>('input[name="scheduleType"][value="asNeeded"]'),
      ),
    );
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    const [made] = await device.query<{ id: string; type: string }>(
      "SELECT id, type FROM medication WHERE name = 'Sertraline'",
    );
    expect(made?.type).toBe("prescription");
  });

  test("Over the counter folds Prescriber, Refills left and Rx number into Prescription details; pharmacy, last filled and quantity stay; what's typed is saved", async () => {
    const device = await openWith(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.fill(await found(() => field("name")), "Loratadine");
    await userEvent.click(
      await found(() =>
        FORM()?.querySelector<HTMLInputElement>('input[name="scheduleType"][value="asNeeded"]'),
      ),
    );
    await userEvent.click(typeRadio("otc"));

    await expect.poll(() => details().open).toBe(false);
    expect(summaryShown()).toBe(true);
    expect(details().querySelector("summary")?.textContent?.trim()).toBe("Prescription details");
    expect(["prescriberId", "refillsLeft", "rxNumber"].map(inDetails)).toEqual([true, true, true]);
    expect(["pharmacyId", "lastFilledOn", "quantity"].map(inDetails)).toEqual([false, false, false]);
    expect(field("quantity")?.checkVisibility()).toBe(true);
    expect(field("rxNumber")?.checkVisibility()).toBe(false);

    await userEvent.click(await found(() => details().querySelector("summary")));
    await expect.poll(() => field("rxNumber")!.checkVisibility()).toBe(true);
    await userEvent.fill(await found(() => field("rxNumber")), "RX 7781");
    // Back to Prescription and to Supplement: the section stays open, since it has a value now.
    await userEvent.click(typeRadio("prescription"));
    await expect.poll(() => summaryShown()).toBe(false);
    await userEvent.click(typeRadio("supplement"));
    await expect.poll(() => summaryShown()).toBe(true);
    expect(details().open).toBe(true);
    expect(field("rxNumber")?.value).toBe("RX 7781");
    await userEvent.click(typeRadio("otc"));
    await userEvent.click(submit());

    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    const [made] = await device.query<{ type: string; rx_number: string }>(
      "SELECT type, rx_number FROM medication WHERE name = 'Loratadine'",
    );
    expect(made).toEqual({ type: "otc", rx_number: "RX 7781" });
  });

  test("an over-the-counter one with an Rx number opens with the section open; one without, closed", async () => {
    await openWith(`${LIST}/${NAPROXEN.id}/edit`);
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(checkedType()).toBe("otc");
    expect(details().open).toBe(true);
    expect(field("rxNumber")?.value).toBe("RX 5521");
  });

  test("one without prescription details opens with the section closed", async () => {
    await openWith(`${LIST}/${IBUPROFEN.id}/edit`);
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(checkedType()).toBe("otc");
    expect(details().open).toBe(false);
  });

  test("an old one with no type starts on none and can't be saved until one is chosen; the type writes no change entry", async () => {
    const device = await openWith(`${LIST}/${FOLIC.id}/edit`);
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(checkedType()).toBeNull();
    // No type yet: nothing to fold.
    expect(details().open).toBe(true);
    expect(summaryShown()).toBe(false);

    await userEvent.click(submit());
    await expect.poll(() => typeError()).toBe("Choose a type");
    expect(typeGroup().getAttribute("aria-invalid")).toBe("true");
    await expect.poll(() => document.activeElement).toBe(typeGroup());
    expect(SHEET()).not.toBeNull();
    expect(await typeOf(device, FOLIC.id)).toBeNull();

    await userEvent.click(typeRadio("supplement"));
    await userEvent.click(submit());
    await expect.poll(() => !SHEET()).toBe(true);
    await device.settle();
    expect(await typeOf(device, FOLIC.id)).toBe("supplement");
    expect(await changes(device, FOLIC.id)).toEqual([]);
  });
});

describe("the status actions", () => {
  test("Discontinue needs a reason; with one and a note the page says so, its entry tops the history, and the list moves it down", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await pageAction(TITLE, "Discontinue…");
    await waitUntil(() => !!OPEN_DIALOG()?.querySelector("[data-discontinue-form]"), "the dialog");
    await userEvent.click(await found(() => dialogButton("Discontinue")));
    await expect
      .poll(() => OPEN_DIALOG()?.querySelector("[data-discontinue-form] .text-error")?.textContent?.trim())
      .toBe("Choose why it was stopped");
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ status: "current" });

    await userEvent.click(
      await found(() =>
        OPEN_DIALOG()?.querySelector<HTMLInputElement>('input[name="stopReason"][aria-label="Side effects"]'),
      ),
    );
    await userEvent.fill(await found(() => OPEN_DIALOG()?.querySelector("textarea[name=stopNote]")), "Dizzy");
    await userEvent.click(await found(() => dialogButton("Discontinue")));
    await waitUntil(() => !OPEN_DIALOG(), "the dialog to close");
    await device.settle();
    expect(await medication(device, LOSARTAN.id)).toMatchObject({
      status: "discontinued",
      stop_reason: "sideEffects",
      stop_note: "Dizzy",
    });
    await expect.poll(badge).toBe("Discontinued");
    expect(historyTexts()[0]).toBe("Discontinued: side effects");

    await userEvent.click(getByCss("main a[href$='/medications/list']"));
    await expect.poll(device.location).toBe(LIST);
    await device.settle();
    expect(listNames("Current medications")).toEqual(SEEDED_CURRENT);
    expect(listNames("Completed and discontinued medications")).toContain(TITLE);
  });

  test("Restart brings it back with a Resumed entry; Mark completed needs no reason and is dated today", async () => {
    const stopped = {
      ...LOSARTAN,
      row: { ...LOSARTAN.row, status: "discontinued", stop_reason: "ineffective", stopped_on: "2026-01-02" },
    };
    const device = await open(medicationUrl(LOSARTAN.id), {
      fixtures: [world(), stopped, LOSARTAN_STARTED],
    });
    await pageAction(TITLE, "Restart");
    await expect.poll(badge).toBe(null);
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ status: "current", stopped_on: null });
    await expect.poll(() => historyTexts()[0]).toBe("Resumed");

    await pageAction(TITLE, "Mark completed");
    await waitUntil(() => dialogButton("Mark completed")?.disabled === false, "the dialog");
    await userEvent.click(await found(() => dialogButton("Mark completed")));
    await expect.poll(badge).toBe("Completed");
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(await medication(device, LOSARTAN.id)).toMatchObject({
      status: "completed",
      stop_reason: null,
      stopped_on: day,
    });
    await expect.poll(() => historyTexts()[0]).toBe("Completed");
    expect((await changes(device, LOSARTAN.id)).map((c) => c.change)).toEqual([
      "started",
      "resumed",
      "stopped",
    ]);
  });

  test("Restart in the edit sheet works too, and closes back to the page", async () => {
    const completed = {
      ...LOSARTAN,
      row: { ...LOSARTAN.row, status: "completed", stopped_on: "2026-01-02" },
    };
    const device = await open(medicationUrl(LOSARTAN.id), {
      fixtures: [world(), completed, LOSARTAN_STARTED],
    });
    await waitUntil(() => !!document.querySelector<HTMLElement>("main [data-edit-medication]"), "Edit");
    await userEvent.click(getByCss("main [data-edit-medication]"));
    await waitUntil(() => !!SHEET()?.querySelector("[data-status-actions]"), "the sheet's status actions");
    const restart = [...SHEET()!.querySelectorAll<HTMLButtonElement>("[data-status-actions] button")].find(
      (b) => b.textContent?.trim() === "Restart",
    )!;
    await userEvent.click(restart);
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(LOSARTAN.id));
    await device.settle();
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ status: "current" });
  });

  test("Delete asks first, then goes to the list without it; the delete is soft", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await pageAction(TITLE, "Delete");
    await waitUntil(() => dialogButton("Delete")?.disabled === false, "the dialog");
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ deleted_at: null });
    await userEvent.click(await found(() => dialogButton("Delete")));
    await expect.poll(device.location).toBe(LIST);
    await device.settle();
    expect(listNames("Current medications")).toEqual(SEEDED_CURRENT);
    expect(listNames("Completed and discontinued medications")).not.toContain(TITLE);
    expect((await medication(device, LOSARTAN.id)).deleted_at).toBeTruthy();
  });
});

describe("a viewer", () => {
  test("gets no Add, Edit or status controls, and the sheet URLs show the list with no form", async () => {
    const device = await open(`${LIST}/new?q=lis`, { role: "viewer" });
    await expect.poll(device.location).toBe(`${LIST}?q=lis`);
    expect(FORM()).toBeNull();
    expect(document.querySelector<HTMLElement>("main [data-add-medication]")).toBeNull();
    await device.screen.unmount();

    const edit = await open(`${LIST}/${LISINOPRIL.id}/edit`, { role: "viewer" });
    await expect.poll(edit.location).toBe(LIST);
    expect(listNames("Current medications")).toContain("Lisinopril 10 mg");
    expect(document.querySelector<HTMLElement>("[data-medication-form]")).toBeNull();
    await edit.screen.unmount();

    await open(medicationUrl(LISINOPRIL.id), { role: "viewer" });
    await waitUntil(
      () => !!document.querySelector<HTMLElement>("main [data-medication-history]"),
      "the page",
    );
    expect(document.querySelector<HTMLElement>('main header [data-region="actions"]')).toBeNull();
    expect(document.querySelector<HTMLElement>("[data-edit-medication]")).toBeNull();
  });
});
