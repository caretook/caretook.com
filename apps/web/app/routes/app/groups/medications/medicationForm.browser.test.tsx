import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx } from "../../../../../test/fixtures";
import {
  $,
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
  waitUntil,
  world,
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
/** The list's Add medication, once the list is up (the first render can come before the loader's data). */
const openAddSheet = async () => {
  await waitUntil(() => !!$("main [data-add-medication]"), 4000, "Add medication");
  await userEvent.click($("main [data-add-medication]")!);
  await waitUntil(() => !!FORM(), 4000, "the add sheet");
};
const badge = () => $('main header [data-region="title"] .badge')?.textContent ?? null;

describe("adding", () => {
  test("Add medication opens the sheet over the list; 'lis' suggests Lisinopril, which fills the name only; the passes are offered, none ticked, with no time yet", async () => {
    const device = await open(LIST);
    await openAddSheet();
    expect(device.location()).toBe(`${LIST}/new`);
    expect(listNames("Current medications")).toContain("Lisinopril 10 mg");

    await userEvent.fill(field("name")!, "lis");
    await waitUntil(() => !!suggestion("Lisinopril"), 4000, "the suggestion");
    await userEvent.click(suggestion("Lisinopril")!);
    await waitUntil(() => !FORM()?.querySelector("[data-name-suggestions]"), 4000, "the chips to go");
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
    expect(FORM()!.querySelectorAll('[data-pass-slot] input[type="checkbox"]:checked')).toHaveLength(0);
    expect(times()).toHaveLength(0);
    expect(FORM()!.querySelector("[data-manage-passes]")?.getAttribute("href")).toBe(`${LIST}/passes`);
    expect(suggestions()).toEqual([]);
  });

  test("validation shows on the fields: a name, each time once (focus on the name), and an as-needed maximum in range", async () => {
    await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    await userEvent.click(FORM()!.querySelector("[data-add-time]")!);
    await userEvent.click(FORM()!.querySelector("[data-add-time]")!);
    await waitUntil(() => times().length === 2, 4000, "two times");
    await userEvent.fill(times()[0]!, "08:00");
    await userEvent.fill(times()[1]!, "08:00");
    await userEvent.click(submit());
    await expect.poll(() => errorOf("name")).toBe("Enter a name");
    expect(TIMES_ERROR()).toBe("List each time once");
    await expect.poll(() => document.activeElement).toBe(field("name"));

    await userEvent.fill(field("name")!, "Albuterol");
    await userEvent.click(scheduleType("asNeeded"));
    await waitUntil(() => !!field("maxPerDay"), 4000, "the maximum");
    await userEvent.fill(field("maxPerDay")!, "30");
    await userEvent.click(submit());
    await expect.poll(() => errorOf("maxPerDay")).toBe("At most 24 a day");
  });

  test("saving with a new prescriber closes the sheet and lists it at once; the prescriber, the medication and its Started entry are one local write, queued in that order", async () => {
    const device = await open(LIST);
    await openAddSheet();
    await userEvent.fill(field("name")!, "Sertraline");
    await userEvent.click(FORM()!.querySelector("[data-add-time]")!);
    await userEvent.click(FORM()!.querySelector("[data-add-time]")!);
    await waitUntil(() => times().length === 2, 4000, "two times");
    await userEvent.fill(times()[0]!, "20:00");
    await userEvent.fill(times()[1]!, "08:00");
    await userEvent.fill(field("strength")!, "25 mg");
    await userEvent.selectOptions(field<HTMLSelectElement>("form")!, "tablet");
    await userEvent.fill(field("dose")!, "1 tablet");
    await userEvent.fill(field("reason")!, "Mood");
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
    expect(JSON.parse(made!.schedule)).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00" }, { time: "20:00" }],
    });
    expect((await changes(device, made!.id)).map((c) => c.change)).toEqual(["started"]);
    const queued = (await device.queued()).slice(before).map((w) => `${w.op} ${w.type}`);
    expect(queued).toEqual(["PUT provider", "PUT medication", "PUT timeline_entry"]);
  });

  test("its page's history says Started", async () => {
    const device = await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), 4000, "the add sheet");
    await userEvent.fill(field("name")!, "Sertraline");
    await userEvent.click(scheduleType("asNeeded"));
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    await device.settle();
    await userEvent.click(
      [...document.querySelectorAll<HTMLElement>("main [data-medication-name]")].find(
        (a) => a.textContent === "Sertraline",
      )!,
    );
    await waitUntil(() => historyTexts().length > 0, 4000, "the history");
    expect(historyTexts()).toEqual(["Started"]);
  });
});

describe("editing", () => {
  const openEdit = async (device: Awaited<ReturnType<typeof open>>) => {
    await waitUntil(() => !!$("main [data-edit-medication]"), 4000, "Edit");
    await userEvent.click($("main [data-edit-medication]")!);
    await waitUntil(() => !!FORM(), 4000, "the edit sheet");
    expect(device.location()).toBe(`${medicationUrl(LOSARTAN.id)}/edit`);
  };

  test("Edit on the page opens the sheet filled in, with the status; a refill edit goes back to the page and writes no change entry", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await openEdit(device);
    expect(field("name")!.value).toBe("Losartan");
    expect(field("dose")!.value).toBe("1 tablet");
    expect(times().map((t) => t.value)).toEqual(["08:00", "20:00"]);
    expect(pickerChip("prescriber")).toBe("Dr. Mira Lark");
    expect(SHEET()?.querySelector("[data-status-now]")?.textContent?.trim()).toBe("Current: taken now");

    await userEvent.fill(field("refillsLeft")!, "3");
    await userEvent.fill(field("quantity")!, "30 tablets");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(LOSARTAN.id));
    await device.settle();
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ refills_left: 3, quantity: "30 tablets" });
    expect((await changes(device, LOSARTAN.id)).map((c) => c.change)).toEqual(["started"]);
  });

  test("changing the dose writes one Changed entry with before and after, newest first on the page", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await openEdit(device);
    await userEvent.fill(field("dose")!, "2 tablets");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(LOSARTAN.id));
    await device.settle();
    const entries = await changes(device, LOSARTAN.id);
    expect(entries.map((c) => c.change)).toEqual(["started", "changed"]);
    expect(entries[1]).toMatchObject({ before: { dose: "1 tablet" }, after: { dose: "2 tablets" } });
    await expect.poll(() => historyTexts()[0]).toBe("Changed dose 1 tablet → 2 tablets");
  });
});

describe("the status actions", () => {
  test("Discontinue needs a reason; with one and a note the page says so, its entry tops the history, and the list moves it down", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await pageAction(TITLE, "Discontinue…");
    await waitUntil(() => !!OPEN_DIALOG()?.querySelector("[data-discontinue-form]"), 4000, "the dialog");
    await userEvent.click(dialogButton("Discontinue")!);
    await expect
      .poll(() => OPEN_DIALOG()?.querySelector("[data-discontinue-form] .text-error")?.textContent?.trim())
      .toBe("Choose why it was stopped");
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ status: "current" });

    await userEvent.click(
      OPEN_DIALOG()!.querySelector<HTMLInputElement>('input[name="stopReason"][aria-label="Side effects"]')!,
    );
    await userEvent.fill(OPEN_DIALOG()!.querySelector("textarea[name=stopNote]")!, "Dizzy");
    await userEvent.click(dialogButton("Discontinue")!);
    await waitUntil(() => !OPEN_DIALOG(), 4000, "the dialog to close");
    await device.settle();
    expect(await medication(device, LOSARTAN.id)).toMatchObject({
      status: "discontinued",
      stop_reason: "sideEffects",
      stop_note: "Dizzy",
    });
    await expect.poll(badge).toBe("Discontinued");
    expect(historyTexts()[0]).toBe("Discontinued: side effects");

    await userEvent.click($("main a[href$='/medications']")!);
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
    await waitUntil(() => dialogButton("Mark completed")?.disabled === false, 4000, "the dialog");
    await userEvent.click(dialogButton("Mark completed")!);
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
    await waitUntil(() => !!$("main [data-edit-medication]"), 4000, "Edit");
    await userEvent.click($("main [data-edit-medication]")!);
    await waitUntil(
      () => !!SHEET()?.querySelector("[data-status-actions]"),
      4000,
      "the sheet's status actions",
    );
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
    await waitUntil(() => dialogButton("Delete")?.disabled === false, 4000, "the dialog");
    expect(await medication(device, LOSARTAN.id)).toMatchObject({ deleted_at: null });
    await userEvent.click(dialogButton("Delete")!);
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
    expect($("main [data-add-medication]")).toBeNull();
    await device.screen.unmount();

    const edit = await open(`${LIST}/${LISINOPRIL.id}/edit`, { role: "viewer" });
    await expect.poll(edit.location).toBe(LIST);
    expect(listNames("Current medications")).toContain("Lisinopril 10 mg");
    expect($("[data-medication-form]")).toBeNull();
    await edit.screen.unmount();

    await open(medicationUrl(LISINOPRIL.id), { role: "viewer" });
    await waitUntil(() => !!$("main [data-medication-history]"), 4000, "the page");
    expect($('main header [data-region="actions"]')).toBeNull();
    expect($("[data-edit-medication]")).toBeNull();
  });
});
