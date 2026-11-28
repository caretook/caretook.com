import type { DeviceRoute } from "../../../../../test/device";

import { useLayoutEffect } from "react";
import { useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import {
  CHANGES_SQL,
  closeSchedule,
  daysAgo,
  dialogButton,
  errorOf,
  field,
  FORM,
  formTab,
  formTabMarker,
  openFormTab,
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
  SCHEDULE,
  SEEDED_CURRENT,
  SHEET,
  showFormTab,
  submit,
  times,
  world,
  openAddMedication,
} from "./medicationWorld";
import { pickTime } from "../../../../../test/timeSelect";
import { requiredLabels, saysOptional } from "../../../../../test/required";
import { currentHourTime } from "~/lib/core/timeOfDay";
import { medicationNameSuggestions } from "~/lib/medications/medicationNames";
import { medicationNamesQuery } from "~/lib/medications/medications.sync";
import * as medicationPage from "../medication/route";

// Adding, editing, stopping, restarting and deleting a medication
// (medications.mjs's add, edit, status, offline form and viewer form steps):
// the add sheet over the list with name suggestions, the passes and
// validation on the fields, a new prescriber added inline and written with
// the medication in one transaction, a save opening the new medication's
// page with Back to the tab it opened over, Cancel and Escape closing onto
// that tab, the edit sheet from the page and back,
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

/** Back (history −1), as the browser's button does, from a medication's page. */
let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}
type PageProps = Parameters<typeof medicationPage.default>[0];
function PageWithBack(props: PageProps) {
  const Page = medicationPage.default;
  return (
    <>
      <BackProbe />
      <Page {...props} />
    </>
  );
}
const ROUTES: DeviceRoute[] = MEDICATION_ROUTES.map((r) =>
  r.module === medicationPage ? { ...r, module: { ...medicationPage, default: PageWithBack } } : r,
);

const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({
    route: ROUTES,
    url,
    fixtures: [world(), LOSARTAN, LOSARTAN_STARTED],
    role: "caretaker",
    ...options,
  });

/** The name's suggestions, as listed under it (a popover, outside the form). */
const suggestions = () =>
  [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((o) => o.textContent?.trim());
const suggestion = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')].find(
    (o) => o.textContent?.trim() === text,
  );
const scheduleType = (value: "scheduled" | "asNeeded") =>
  FORM()!.querySelector<HTMLInputElement>(`input[name="scheduleType"][value="${value}"]`)!;
const TIMES_ERROR = () => {
  const id = FORM()?.querySelector("[data-schedule-times]")?.getAttribute("aria-describedby");
  return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
};
const medication = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<Record<string, unknown>>(MEDICATION_SQL, [id]))[0]!;
const changes = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<{ change: string; details: string }>(CHANGES_SQL, [id])).map((r) => ({
    change: r.change,
    ...(JSON.parse(r.details) as { before?: object; after?: object }),
  }));
/** The header's `+`, Medication, once the list is up (the first render can come before the loader's data). */
const openAddSheet = openAddMedication;
/** A save from the add sheet: the row is local at once, and its page opens in the sheet's place. Its id. */
const savedOpens = async (device: Awaited<ReturnType<typeof open>>, name: string) => {
  const made = () =>
    device.query<{ id: string }>("SELECT id FROM medication WHERE name = ?", [name]).then((r) => r[0]?.id);
  await expect.poll(made).toBeDefined();
  const id = (await made())!;
  await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(id));
  return id;
};
/** The page's Back link (the first link on it): its label and where it goes. */
const pageBack = () => {
  const link = document.querySelector<HTMLAnchorElement>("main a");
  return link ? { label: link.textContent?.trim(), href: link.getAttribute("href") } : null;
};
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
    await waitUntil(() => !document.querySelector('[role="listbox"]'), "the list to close");
    expect(["name", "strength", "dose", "reason"].map((n) => field(n)!.value)).toEqual([
      "Lisinopril",
      "",
      "",
      "",
    ]);

    await userEvent.click(await found(() => scheduleType("scheduled")));
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

  test("the name suggests only once typed: nothing on focus; one letter lists the group's names, then common ones; a partial name never fills; a pick fills the full name only", async () => {
    const device = await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    const name = () => field("name");
    await userEvent.click(await found(name));
    await expect.poll(() => name()?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="listbox"]')).toBeNull();

    await userEvent.keyboard("l");
    const { sql, params } = medicationNamesQuery(TEST_GROUP.id);
    const used = await device.query<{ name: string }>(sql, params);
    const expected = medicationNameSuggestions("l", used);
    // The group's own (in the order they were last saved), then the curated list.
    expect(new Set(expected.slice(0, 3))).toEqual(new Set(["Latanoprost", "Lisinopril", "Losartan"]));
    expect(expected.indexOf("Labetalol")).toBeGreaterThan(2);
    await expect.poll(suggestions).toEqual(expected);

    // Look-alikes are listed in full; leaving a partial name keeps it as typed.
    await userEvent.fill(await found(name), "hydr");
    await expect
      .poll(suggestions)
      .toEqual(expect.arrayContaining(["Hydralazine", "Hydroxyzine (Vistaril, Atarax)"]));
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => document.querySelector('[role="listbox"]')).toBeNull();
    expect(name()?.value).toBe("hydr");

    await userEvent.click(await found(name));
    await userEvent.keyboard("ox");
    await userEvent.click(await found(() => suggestion("Hydroxyzine (Vistaril, Atarax)")));
    await expect.poll(() => name()?.value).toBe("Hydroxyzine (Vistaril, Atarax)");
    expect(["strength", "dose", "directions"].map((n) => field<HTMLInputElement>(n)?.value ?? "")).toEqual([
      "",
      "",
      "",
    ]);

    await userEvent.fill(await found(name), "");
    await expect.poll(() => document.querySelector('[role="listbox"]')).toBeNull();
  });

  test("validation shows on the fields: a name, each time once (focus on the name), and an as-needed maximum in range", async () => {
    await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.click(await found(() => scheduleType("scheduled")));
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await waitUntil(() => times().length === 2, "two times");
    await pickTime(() => times()[0], "08:00");
    await pickTime(() => times()[1], "08:00");
    await closeSchedule();
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

  test("a new medication starts on As needed, with the choice visible, and saves as needed without touching it", async () => {
    const device = await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    expect(scheduleType("asNeeded").checked).toBe(true);
    expect(scheduleType("scheduled").checked).toBe(false);
    expect(scheduleType("asNeeded").checkVisibility({ visibilityProperty: true })).toBe(true);
    expect(FORM()?.querySelector("[data-schedule-passes]")).toBeNull();
    expect(field("maxPerDay")).not.toBeNull();

    await userEvent.fill(await found(() => field("name")), "Albuterol");
    await userEvent.click(submit());
    const id = await savedOpens(device, "Albuterol");
    expect(JSON.parse(String((await medication(device, id)).schedule))).toEqual({ type: "asNeeded" });
  });

  test("switching a new medication to At set times offers the usual starting slots: the passes, none ticked, no time of its own", async () => {
    await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.click(await found(() => scheduleType("scheduled")));
    await waitUntil(() => !!FORM()?.querySelector("[data-schedule-passes]"), "the passes");
    const names = [...(FORM()?.querySelectorAll("[data-pass-slot]") ?? [])].map((li) =>
      li.querySelector("label")?.textContent?.trim(),
    );
    expect(names).toEqual(["Morning 8:00", "Evening 20:00"]);
    expect(FORM()?.querySelectorAll('[data-pass-slot] input[type="checkbox"]:checked')).toHaveLength(0);
    expect(times()).toHaveLength(0);
    expect(scheduleType("scheduled").checked).toBe(true);
  });

  test("a new time row starts at the current hour in the recipient's zone, not the device's", async () => {
    await open(`${LIST}/new`, { fixtures: [fx.recipient({ timeZone: "Asia/Tokyo" })] });
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.click(await found(() => scheduleType("scheduled")));
    await waitUntil(() => times().length === 1, "the first row");
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await waitUntil(() => times().length === 2, "the new row");
    expect(times()[0]?.value).toBe("08:00");
    expect(times()[1]?.value).toBe(currentHourTime("Asia/Tokyo"));
  });

  test("saving with a new prescriber opens the new medication's page; the prescriber, the medication and its Started entry are one local write, queued in that order; Back goes to the list, where it is, not the form", async () => {
    const device = await open(LIST);
    await openAddSheet();
    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(await found(() => scheduleType("scheduled")));
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
    await waitUntil(() => times().length === 2, "two times");
    await pickTime(() => times()[0], "20:00");
    await pickTime(() => times()[1], "08:00");
    await closeSchedule();
    await userEvent.fill(await found(() => field("strength")), "25 mg");
    await userEvent.fill(await found(() => field("dose")), "1 tablet");
    await showFormTab("Details");
    await userEvent.selectOptions(await found(() => field<HTMLSelectElement>("form")), "tablet");
    await userEvent.fill(await found(() => field("reason")), "Mood");
    await showFormTab("Essentials");
    await pickProvider("prescriber", "Dr. Ada Moss", 'Add "Dr. Ada Moss" as a new prescriber');
    await expect.poll(() => pickerChip("prescriber")).toBe("Dr. Ada Moss (new)");
    const before = (await device.queued()).length;
    await userEvent.click(submit());

    const id = await savedOpens(device, "Sertraline");
    await expect.poll(() => document.querySelector("main h1")?.textContent).toBe("Sertraline 25 mg");
    expect(pageBack()).toEqual({ label: "Medications", href: LIST });
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
    expect(made?.id).toBe(id);

    // The page replaced the sheet's entry: Back is the list, with no form.
    back();
    await expect.poll(() => device.location()).toBe(LIST);
    await expect.poll(() => listNames("Current medications")).toContain("Sertraline 25 mg");
    expect(FORM()).toBeNull();
  });

  test("over Schedule, a save opens the page, whose history says Started; its Back names Schedule, and Back goes there", async () => {
    const device = await open(SCHEDULE);
    await openAddSheet();
    expect(device.location()).toBe(`${SCHEDULE}/new`);
    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(submit());

    await savedOpens(device, "Sertraline");
    await waitUntil(() => historyTexts().length > 0, "the history");
    expect(historyTexts()).toEqual(["Started"]);
    expect(pageBack()).toEqual({ label: "Schedule", href: SCHEDULE });
    back();
    await expect.poll(() => !SHEET() && device.location()).toBe(SCHEDULE);
    expect(FORM()).toBeNull();
  });

  test("Cancel and Escape close onto the list it opened over, adding nothing", async () => {
    const device = await open(LIST);
    await openAddSheet();
    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(
      await found(() =>
        [...FORM()!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel"),
      ),
    );
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);

    await openAddSheet();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    expect(await device.query("SELECT id FROM medication WHERE name = 'Sertraline'")).toEqual([]);
    expect(await device.queued()).toEqual([]);
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
    expect(scheduleType("scheduled").checked).toBe(true);
    expect(times().map((t) => t.value)).toEqual(["08:00", "20:00"]);
    expect(pickerChip("prescriber")).toBe("Dr. Mira Lark");
    expect(SHEET()?.querySelector("[data-status-now]")?.textContent?.trim()).toBe("Current: taken now");

    await showFormTab("Refills");
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

  const openWith = (url: string) => open(url, { fixtures: [world(), FOLIC] });
  const typeRadio = (value: string) =>
    FORM()!.querySelector<HTMLInputElement>(`input[name="type"][value="${value}"]`)!;
  const checkedType = () =>
    FORM()?.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value ?? null;
  const typeGroup = () => FORM()!.querySelector<HTMLElement>('[role="radiogroup"]:has(input[name="type"])')!;
  const typeError = () => {
    const id = typeGroup().getAttribute("aria-describedby");
    return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
  };
  const typeOf = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
    (await device.query<{ type: string | null }>("SELECT type FROM medication WHERE id = ?", [id]))[0]?.type;

  test("a new medication starts on Prescription and saves it", async () => {
    const device = await openWith(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    expect(
      [...(FORM()?.querySelectorAll<HTMLInputElement>('input[name="type"]') ?? [])].map((r) => r.ariaLabel),
    ).toEqual(["Prescription", "Over the counter", "Supplement", "Other"]);
    expect(checkedType()).toBe("prescription");

    await userEvent.fill(await found(() => field("name")), "Sertraline");
    await userEvent.click(submit());
    const id = await savedOpens(device, "Sertraline");
    expect(await typeOf(device, id)).toBe("prescription");
  });

  test("an old one with no type starts on none and can't be saved until one is chosen; the type writes no change entry", async () => {
    const device = await openWith(`${LIST}/${FOLIC.id}/edit`);
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(checkedType()).toBeNull();

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

describe("the tabs (B-694)", () => {
  const panelOf = (name: string) =>
    field(name)?.closest("[data-form-tab-panel]")?.getAttribute("data-form-tab-panel") ?? null;
  const shown = (name: string) => field(name)?.checkVisibility({ visibilityProperty: true }) ?? false;
  /** Over the counter, with an Rx number kept from when it was a prescription. */
  const NAPROXEN = fx.medication({ name: "Naproxen", strength: "220 mg", type: "otc", rxNumber: "RX 5521" });
  const typeRadio = (value: string) =>
    FORM()!.querySelector<HTMLInputElement>(`input[name="type"][value="${value}"]`)!;

  test("a new medication opens on Essentials, Strength and Dose on one row, and saves from it alone; Save shows on every tab", async () => {
    const device = await open(`${LIST}/new`, { width: 320 });
    await waitUntil(() => !!FORM(), "the add sheet");
    expect(openFormTab()).toBe("Essentials");
    expect([...(FORM()?.querySelectorAll('[role="tab"]') ?? [])].map((t) => t.textContent?.trim())).toEqual([
      "Essentials",
      "Details",
      "Refills",
    ]);
    expect(
      ["name", "type", "strength", "dose", "scheduleType", "prescriberId", "pharmacyId"].map(panelOf),
    ).toEqual(Array(7).fill("essentials"));
    expect(["form", "directions", "reason", "startedOn"].map(panelOf)).toEqual(Array(4).fill("details"));
    expect(["refillsLeft", "rxNumber", "lastFilledOn", "quantity"].map(panelOf)).toEqual(
      Array(4).fill("refills"),
    );
    const [strength, dose] = [
      field("strength")!.getBoundingClientRect(),
      field("dose")!.getBoundingClientRect(),
    ];
    expect(strength.top).toBe(dose.top);
    expect(strength.right).toBeLessThanOrEqual(dose.left);
    // No sideways scroll at 320px.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);

    for (const tab of ["Details", "Refills"] as const) {
      await showFormTab(tab);
      expect(submit().element().checkVisibility()).toBe(true);
    }
    await showFormTab("Essentials");
    await userEvent.fill(await found(() => field("name")), "Cetirizine");
    await userEvent.click(submit());
    await savedOpens(device, "Cetirizine");
  });

  test("what's typed on Details and Refills survives switching tabs and is saved", async () => {
    const device = await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.fill(await found(() => field("name")), "Famotidine");
    await showFormTab("Details");
    await userEvent.fill(await found(() => field("directions")), "Before bed");
    await userEvent.fill(await found(() => field("reason")), "Heartburn");
    await showFormTab("Refills");
    await userEvent.fill(await found(() => field("rxNumber")), "RX 3301");
    await userEvent.fill(await found(() => field("quantity")), "60 tablets");
    await showFormTab("Essentials");
    expect(shown("rxNumber")).toBe(false);
    await showFormTab("Details");
    expect(field<HTMLTextAreaElement>("directions")?.value).toBe("Before bed");
    await showFormTab("Refills");
    expect(field("rxNumber")?.value).toBe("RX 3301");
    await userEvent.click(submit());

    await savedOpens(device, "Famotidine");
    const [made] = await device.query<Record<string, string>>(
      "SELECT directions, reason, rx_number, quantity FROM medication WHERE name = 'Famotidine'",
    );
    expect(made).toEqual({
      directions: "Before bed",
      reason: "Heartburn",
      rx_number: "RX 3301",
      quantity: "60 tablets",
    });
  });

  test("editing one with an Rx number opens on Essentials with Refills marked", async () => {
    await open(`${LIST}/${NAPROXEN.id}/edit`, { fixtures: [world(), NAPROXEN] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(openFormTab()).toBe("Essentials");
    expect(formTabMarker("Refills")).toBe("content");
    expect(formTab("Refills")?.getAttribute("aria-label")).toBe("Refills, filled in");
    expect(field("rxNumber")?.value).toBe("RX 5521");
  });

  test("one with a reason and nothing on Refills marks only Details", async () => {
    await open(`${LIST}/${LOSARTAN.id}/edit`);
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(openFormTab()).toBe("Essentials");
    expect(formTabMarker("Details")).toBe("content");
    expect(formTabMarker("Refills")).toBeNull();
  });

  test("a refused field on Refills switches there, marks the tab and takes focus", async () => {
    await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.fill(await found(() => field("name")), "Loratadine");
    await showFormTab("Refills");
    await userEvent.fill(await found(() => field("refillsLeft")), "-1");
    await showFormTab("Essentials");

    await userEvent.click(submit());
    await expect.poll(openFormTab).toBe("Refills");
    await expect.poll(() => document.activeElement).toBe(field("refillsLeft"));
    expect(formTabMarker("Refills")).toBe("error");
    expect(SHEET()).not.toBeNull();
  });

  test("the Prescription details fold is gone: every type shows every field on its tab", async () => {
    await open(`${LIST}/new`);
    await waitUntil(() => !!FORM(), "the add sheet");
    for (const type of ["prescription", "otc", "supplement", "other"]) {
      await userEvent.click(typeRadio(type));
      await expect.poll(() => typeRadio(type).checked).toBe(true);
      expect(FORM()?.querySelector("[data-prescription-details], [data-prescription-toggle]")).toBeNull();
      await showFormTab("Refills");
      expect(["refillsLeft", "rxNumber", "lastFilledOn", "quantity"].map(shown)).toEqual([
        true,
        true,
        true,
        true,
      ]);
      await showFormTab("Essentials");
      expect(
        FORM()?.querySelector<HTMLElement>('[data-provider-picker="prescriber"]')?.checkVisibility(),
      ).toBe(true);
    }
  });

  test("the discard prompt counts a change on another tab", async () => {
    const device = await open(LIST);
    await openAddSheet();
    await showFormTab("Refills");
    await userEvent.fill(await found(() => field("quantity")), "30 tablets");
    await showFormTab("Essentials");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(await found(() => dialogButton("Discard"), { message: "Discard changes?" }));
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
  });
});

describe("required fields (B-801)", () => {
  test("the add sheet marks exactly the name, the type and the schedule, as needed or at set times, and no label says optional", async () => {
    await open(LIST);
    await openAddSheet();
    await found(() => FORM());
    const expected = ["Name", "Type", "Schedule"];
    expect(requiredLabels(FORM())).toEqual(expected);
    expect(saysOptional(FORM())).toBe(false);
    await expect.poll(() => field("name")?.getAttribute("aria-required")).toBe("true");
    await expect.poll(() => field("strength")?.hasAttribute("aria-required")).toBe(false);

    await userEvent.click(await found(() => scheduleType("scheduled")));
    await waitUntil(() => !!FORM()?.querySelector("[data-schedule-times]"), "the times");
    expect(requiredLabels(FORM())).toEqual(expected);
    expect(saysOptional(FORM())).toBe(false);
  });

  test("Discontinue marks the reason and the day; Mark completed only the day", async () => {
    await open(medicationUrl(LOSARTAN.id));
    await pageAction(TITLE, "Discontinue…");
    await waitUntil(() => !!OPEN_DIALOG()?.querySelector("[data-discontinue-form]"), "the dialog");
    expect(requiredLabels(OPEN_DIALOG())).toEqual(["Why was it stopped?", "Stopped on"]);
    expect(saysOptional(OPEN_DIALOG())).toBe(false);
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !OPEN_DIALOG(), "the dialog to close");

    await pageAction(TITLE, "Mark completed");
    await waitUntil(() => !!dialogButton("Mark completed"), "the dialog");
    expect(requiredLabels(OPEN_DIALOG())).toEqual(["Stopped on"]);
  });
});

describe("the status actions", () => {
  test("Discontinue needs a reason; with one and a note the page says so, its entry tops the history, and the list moves it down", async () => {
    const device = await open(medicationUrl(LOSARTAN.id));
    await pageAction(TITLE, "Discontinue…");
    await waitUntil(() => !!OPEN_DIALOG()?.querySelector("[data-discontinue-form]"), "the dialog");
    await userEvent.click(await found(() => dialogButton("Discontinue")));
    await expect
      .poll(() =>
        [...(OPEN_DIALOG()?.querySelectorAll("[data-discontinue-form] p") ?? [])].some(
          (p) => p.textContent?.trim() === "Choose why it was stopped",
        ),
      )
      .toBe(true);
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
