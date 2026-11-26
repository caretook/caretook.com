import type { MedicationChangeDetails } from "@caretook/data/schema";
import type { DeviceRoute } from "../../../../../test/device";

import { zonedInstant } from "@caretook/data/schema";
import { userEvent } from "vitest/browser";
import { at, fx, medicationPass, TEST_GROUP, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import * as medicationPage from "../medication/route";
import * as doseSheet from "../timeline/new-dose/route";
import * as allergiesSheet from "./allergies/route";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as newPassSheet from "./passes/new/route";
import * as passesTab from "./passes/route";
import * as weekSheet from "./print/week/route";
import * as printSheet from "./print/route";
import * as listTab from "./list/route";
import * as medications from "./route";
import * as scheduleTab from "./schedule/route";

// The medications' component tests share one fictional world, like the
// seeds' (medications.mjs used them): Grandma June's six medications on the
// group's Morning and Evening passes (four current, a completed antibiotic, a
// discontinued one with its reason and note; prescriptions but for an
// over-the-counter painkiller and the discontinued one, whose type isn't set), a prescriber and a pharmacy
// with phones, Metformin's notes, and a history of doses and change entries.
// Times are in the recipient's zone (America/Los_Angeles, the test
// browser's too). Only `*.browser.test.tsx` files import it.

/** `hour`:`minute` local time, `d` days back (midnight with no hour). */
export const daysAgo = (d: number, hour = 0, minute = 0) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, minute, 0, 0);
  return t;
};
/** The local day `d` days back, as `YYYY-MM-DD`. */
export const dayAgo = (d: number) => {
  const t = daysAgo(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

export const GROUP = TEST_GROUP.id;

/** The recipient, with a date of birth (the print sheets show it). */
export const RECIPIENT = fx.recipient({ dateOfBirth: "1941-03-14" });

export const MORNING = medicationPass({ name: "Morning", time: "08:00", sortOrder: 0 });
export const EVENING = medicationPass({ name: "Evening", time: "20:00", sortOrder: 1 });

export const LARK = fx.provider({
  name: "Dr. Mira Lark",
  type: "clinician",
  specialty: "Family medicine",
  phones: [
    { label: "Office", number: "(555) 010-2200 x214" },
    { label: "After hours", number: "(555) 010-2299" },
  ],
});
export const ELM = fx.provider({
  name: "Elm Street Pharmacy",
  type: "pharmacy",
  specialty: null,
  phones: [
    { label: "Pharmacy", number: "(555) 010-4400" },
    { label: "Refills", number: "(555) 010-4401" },
  ],
});
/** A clinician no medication names. */
export const OKAFOR = fx.provider({ name: "Dr. Sam Okafor", specialty: "Cardiology" });

const since = (d: number) => ({ createdAt: at(daysAgo(d, 10)), updatedAt: at(daysAgo(d, 10)) });

export const LISINOPRIL = fx.medication({
  name: "Lisinopril",
  strength: "10 mg",
  dose: "1 tablet",
  directions: "Once every morning, with or without food.",
  reason: "Blood pressure",
  schedule: { type: "scheduled", slots: [{ passId: MORNING.id }] },
  prescriberId: LARK.id,
  pharmacyId: ELM.id,
  startedOn: dayAgo(120),
  ...since(120),
});
export const METFORMIN = fx.medication({
  name: "Metformin",
  strength: "500 mg",
  dose: "1 tablet",
  directions: "Twice a day with meals.",
  reason: "Type 2 diabetes",
  schedule: { type: "scheduled", slots: [{ passId: MORNING.id }, { passId: EVENING.id }] },
  prescriberId: LARK.id,
  pharmacyId: ELM.id,
  startedOn: dayAgo(300),
  ...since(300),
});
export const ACETAMINOPHEN = fx.medication({
  name: "Acetaminophen",
  strength: "500 mg",
  dose: "2 tablets",
  directions: "For knee pain. At least 6 hours between doses.",
  reason: "Knee pain",
  schedule: { type: "asNeeded", maxPerDay: 4 },
  type: "otc",
  startedOn: dayAgo(90),
  ...since(90),
});
export const LATANOPROST = fx.medication({
  name: "Latanoprost",
  strength: "0.005%",
  form: "drops",
  dose: "1 drop in each eye",
  directions: "At bedtime. Wait 5 minutes before any other eye drops.",
  reason: "Eye pressure",
  schedule: { type: "scheduled", slots: [{ time: "21:00" }] },
  pharmacyId: ELM.id,
  quantity: "1 bottle (2.5 mL)",
  refillsLeft: 3,
  rxNumber: "RX 0104-2277",
  lastFilledOn: dayAgo(4),
  startedOn: dayAgo(200),
  ...since(200),
});
export const AMOXICILLIN = fx.medication({
  name: "Amoxicillin",
  strength: "500 mg",
  form: "capsule",
  dose: "1 capsule",
  reason: "Chest infection",
  schedule: { type: "scheduled", slots: [{ passId: MORNING.id }, { time: "14:00" }, { passId: EVENING.id }] },
  prescriberId: LARK.id,
  status: "completed",
  startedOn: dayAgo(24),
  stoppedOn: dayAgo(14),
  ...since(24),
});
export const OXYBUTYNIN = fx.medication({
  name: "Oxybutynin",
  strength: "5 mg",
  dose: "1 tablet",
  reason: "Bladder",
  schedule: { type: "scheduled", slots: [{ passId: EVENING.id }] },
  status: "discontinued",
  stopReason: "sideEffects",
  stopNote: "Dry mouth and some confusion at night.",
  // Added before medications had types.
  type: null,
  startedOn: dayAgo(60),
  stoppedOn: dayAgo(30),
  ...since(60),
});

export const SEEDED_CURRENT = [
  "Acetaminophen 500 mg",
  "Latanoprost 0.005%",
  "Lisinopril 10 mg",
  "Metformin 500 mg",
];
export const SEEDED_STOPPED = ["Amoxicillin 500 mg", "Oxybutynin 5 mg"];

/** A change entry with its details (`change` and the rest), `d` days back at `hour`. */
const change = (
  medicationId: string,
  d: number,
  hour: number,
  details: Omit<MedicationChangeDetails, "medicationId">,
) =>
  fx.medicationChange({
    medicationId,
    occurredAt: at(daysAgo(d, hour)),
    details: JSON.stringify({ medicationId, ...details }),
  });

export const HISTORY = [
  change(LISINOPRIL.id, 120, 10, { change: "started", after: { name: "Lisinopril", strength: "5 mg" } }),
  change(LISINOPRIL.id, 5, 16, {
    change: "changed",
    fields: ["strength"],
    before: { strength: "5 mg" },
    after: { strength: "10 mg" },
  }),
  fx.dose({ medicationId: LISINOPRIL.id, occurredAt: at(daysAgo(2, 8, 5)), scheduledFor: "08:00" }),
  fx.dose({ medicationId: LISINOPRIL.id, occurredAt: at(daysAgo(1, 8, 10)), scheduledFor: "08:00" }),
  change(METFORMIN.id, 300, 10, { change: "started", after: { name: "Metformin" } }),
  change(LATANOPROST.id, 200, 10, { change: "started", after: { name: "Latanoprost" } }),
  change(OXYBUTYNIN.id, 60, 10, { change: "started", after: { name: "Oxybutynin" } }),
  change(OXYBUTYNIN.id, 30, 10, {
    change: "stopped",
    stopStatus: "discontinued",
    stopReason: "sideEffects",
    stopNote: "Dry mouth and some confusion at night.",
  }),
];

export const METFORMIN_NOTES = fx.document({
  ownerId: METFORMIN.id,
  subject: "medication",
  text: "Always with food. Crush into applesauce if she has trouble swallowing.",
});

/** The whole world: the recipient, passes, providers, the six medications, their history and Metformin's notes. */
export const world = () => [
  RECIPIENT,
  MORNING,
  EVENING,
  LARK,
  ELM,
  OKAFOR,
  LISINOPRIL,
  METFORMIN,
  ACETAMINOPHEN,
  LATANOPROST,
  AMOXICILLIN,
  OXYBUTYNIN,
  ...HISTORY,
  METFORMIN_NOTES,
];

/** The group's medications paths: the tabs, a medication's page and print sit below it. */
export const MEDS = `/app/groups/${GROUP}/medications`;
/** The Schedule tab (Today), where the section opens. */
export const SCHEDULE = `${MEDS}/schedule`;
/** The list tab (allergies, search, chips and the list). */
export const LIST = `${MEDS}/list`;
/** The Passes tab (the group's rounds). */
export const PASSES = `${MEDS}/passes`;
export const medicationUrl = (id: string) => `${MEDS}/${id}`;

const sheetsOver = (tab: "schedule" | "list"): DeviceRoute[] => [
  { path: `/app/groups/:groupId/medications/${tab}/new`, module: newSheet },
  { path: `/app/groups/:groupId/medications/${tab}/:medicationId/edit`, module: editSheet },
  { path: `/app/groups/:groupId/medications/${tab}/allergies`, module: allergiesSheet },
];

/** The page with its three tabs and their sheets, a medication's page and the print sheets (as routes.ts nests them). */
export const MEDICATION_ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/medications",
    module: medications,
    children: [
      {
        path: "/app/groups/:groupId/medications/schedule",
        module: scheduleTab,
        children: sheetsOver("schedule"),
      },
      {
        path: "/app/groups/:groupId/medications/list",
        module: listTab,
        // The list's Log: the timeline's Dose sheet, over the list.
        children: [
          ...sheetsOver("list"),
          { path: "/app/groups/:groupId/medications/list/dose", module: doseSheet },
        ],
      },
      {
        path: "/app/groups/:groupId/medications/passes",
        module: passesTab,
        children: [{ path: "/app/groups/:groupId/medications/passes/new", module: newPassSheet }],
      },
    ],
  },
  { path: "/app/groups/:groupId/medications/:medicationId", module: medicationPage },
  { path: "/app/groups/:groupId/medications/print", module: printSheet },
  { path: "/app/groups/:groupId/medications/print/week", module: weekSheet },
];

// --- DOM helpers (medications.mjs's selectors) -------------------------------

/** The names in one of the list's lists. */
export const listNames = (label: string) =>
  [...document.querySelectorAll<HTMLElement>(`main ul[aria-label="${label}"] [data-medication-name]`)].map(
    (n) => n.textContent?.trim(),
  );

/** One field of a list row (`summary`, `reason`, `stopped`), by the start of its name. */
export const rowText = (name: string, field: string) =>
  [...document.querySelectorAll<HTMLElement>("main li[data-medication-id]")]
    .find((li) => li.querySelector("[data-medication-name]")?.textContent?.trim().startsWith(name))
    ?.querySelector(`[data-medication-${field}]`)
    ?.textContent?.trim() ?? null;

export const NOTES = () => document.querySelector<HTMLElement>("main .ProseMirror");

/** A medication's page as the DOM has it. */
export const medPage = () => ({
  h1: document.querySelector<HTMLElement>("main h1")?.textContent?.trim(),
  badge:
    document.querySelector<HTMLElement>('main header [data-region="title"] .badge')?.textContent?.trim() ??
    null,
  details:
    document.querySelector<HTMLElement>('main header [data-region="details"]')?.textContent?.trim() ?? null,
  stopped: document.querySelector<HTMLElement>("main [data-medication-stopped]")?.textContent?.trim() ?? null,
  rows: Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>("main [data-detail]")].map((r) => [
      r.dataset.detail ?? "",
      r.querySelector("dd")?.textContent?.trim(),
    ]),
  ) as Record<string, string | undefined>,
  providers: [...document.querySelectorAll<HTMLElement>("main li[data-medication-provider]")].map((li) => [
    li.dataset.medicationProvider,
    li.querySelector("[data-provider-name]")?.textContent?.trim(),
    li.querySelector("a[data-provider-name]")?.getAttribute("href") ?? null,
    !!li.querySelector("[data-contact-actions] a"),
  ]),
  history: [
    ...document.querySelectorAll<HTMLElement>("main [data-medication-history] li[data-entry-id]"),
  ].map((li) => ({
    id: li.dataset.entryId,
    kind: li.dataset.kind,
    text: li.querySelector("[data-entry-text]")?.textContent?.trim(),
  })),
  notes: NOTES()?.textContent ?? null,
  editable: NOTES()?.getAttribute("contenteditable") ?? null,
  readonly: NOTES()?.getAttribute("aria-readonly") ?? null,
  actions: !!document.querySelector<HTMLElement>('main header [data-region="actions"]'),
});
export const historyTexts = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      "main [data-medication-history] li[data-entry-id] [data-entry-text]",
    ),
  ].map((t) => t.textContent?.trim());

export const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
export const FORM = () => document.querySelector<HTMLFormElement>("[role=dialog] [data-medication-form]");
export const field = <T extends HTMLElement = HTMLInputElement>(name: string) =>
  FORM()?.querySelector<T>(`[name="${name}"]`) ?? null;
/** The form's section tabs (Essentials, Details, Refills). */
export const formTab = (label: "Essentials" | "Details" | "Refills") =>
  [...(FORM()?.querySelectorAll<HTMLElement>('[role="tablist"] [role="tab"]') ?? [])].find(
    (t) => t.textContent?.trim() === label,
  ) ?? null;
/** The form tab that's open. */
export const openFormTab = () =>
  FORM()?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null;
/** A form tab's marker: "content" (saved values on it), "error", or null. */
export const formTabMarker = (label: "Essentials" | "Details" | "Refills") =>
  formTab(label)?.querySelector("[data-tab-marker]")?.getAttribute("data-tab-marker") ?? null;
/** Open a form tab (its fields are hidden until then). */
export const showFormTab = async (label: "Essentials" | "Details" | "Refills") => {
  await userEvent.click(await found(() => formTab(label), { message: `the ${label} tab` }));
  await waitUntil(() => openFormTab() === label, `the ${label} tab open`);
};
/** The sheet's Save, as a locator. */
export const submit = () => getByCss('[role=dialog] [data-medication-form] button[type="submit"]');
export const times = () => [...(FORM()?.querySelectorAll<HTMLInputElement>('input[name="time"]') ?? [])];
/** A field's message, through its `aria-describedby`. */
export const errorOf = (name: string) => {
  const id = field(name)
    ?.getAttribute("aria-describedby")
    ?.split(" ")
    .find((x) => x.endsWith("-error"));
  return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
};
export const pickerInput = (kind: "prescriber" | "pharmacy") =>
  FORM()?.querySelector<HTMLInputElement>(`[data-provider-picker="${kind}"] input[role="combobox"]`) ?? null;
export const pickerChip = (kind: "prescriber" | "pharmacy") =>
  FORM()?.querySelector(`[data-provider-picker="${kind}"] li[data-chip]`)?.textContent?.trim() ?? null;
export const option = (text: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.firstElementChild?.textContent === text,
  );
export const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
export const OPEN_DIALOG = () => document.querySelector<HTMLDialogElement>("dialog[open]");
export const dialogButton = (text: string) =>
  [...(OPEN_DIALOG()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === text);

/** Type `text` in a provider picker and take `optionText` from its list. */
export const pickProvider = async (kind: "prescriber" | "pharmacy", text: string, optionText: string) => {
  await userEvent.click(await found(() => pickerInput(kind)));
  await userEvent.keyboard(text);
  await userEvent.click(await found(() => option(optionText), { message: `the option ${optionText}` }));
};

/** Open a medication page's ⋯ menu and choose `item`. */
export const pageAction = async (title: string, item: string) => {
  const button = () =>
    document.querySelector<HTMLElement>(
      `main header [data-region="actions"] button[aria-label="Actions for ${title}"]`,
    );
  await userEvent.click(await found(button, { message: "the page's ⋯" }));
  await userEvent.click(await found(() => menuItem(item), { message: `the menu item ${item}` }));
};

/** The device's medication row, for what a screen wrote. */
export const MEDICATION_SQL =
  "SELECT name, strength, dose, status, stop_reason, stop_note, stopped_on, refills_left, quantity, prescriber_id, schedule, deleted_at FROM medication WHERE id = ?";
/** A medication's change entries on the device, oldest first: their `change`, and before → after. */
export const CHANGES_SQL =
  "SELECT json_extract(details, '$.change') AS change, details FROM timeline_entry WHERE kind = 'medicationChange' AND deleted_at IS NULL AND json_extract(details, '$.medicationId') = ? ORDER BY occurred_at, created_at";

// --- A fixed clock (Today, the Dose sheet, the strip, Upcoming's passes) ------

/**
 * Wednesday Jun 9 2027, 10:00 in Los Angeles, the recipient's zone, where her passes' times are: the
 * test clock's day (`TEST_NOW`), which the module-level fixtures are relative to. In the recipient's
 * zone, not the device's, so her day reads the same with the device in New York (13:00 there).
 */
export const CLOCK = zonedInstant("2027-06-09", "10:00", TEST_TIME_ZONE);
/** `HH:MM` on the fixed clock's day, `minutes` from 10:00 (negative is earlier). */
export const clockAt = (minutes: number) => {
  const m = 10 * 60 + minutes;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
/** A moment on the fixed clock's day, `minutes` from 10:00, as a stored timestamp. */
export const clockMoment = (minutes: number) => at(new Date(CLOCK.getTime() + minutes * 60_000));
/** The doses on the device, oldest first, with their details' fields. */
export const DOSES_SQL =
  "SELECT id, json_extract(details, '$.medicationId') AS medicationId, json_extract(details, '$.status') AS status, json_extract(details, '$.amount') AS amount, json_extract(details, '$.scheduledFor') AS scheduledFor, json_extract(details, '$.passId') AS passId, json_extract(details, '$.passLogId') AS passLogId, json_extract(details, '$.note') AS note, occurred_at AS occurredAt FROM timeline_entry WHERE kind = 'dose' AND deleted_at IS NULL ORDER BY occurred_at, created_at";
export type DoseRow = {
  id: string;
  medicationId: string;
  status: string;
  amount: string | null;
  scheduledFor: string | null;
  passId: string | null;
  passLogId: string | null;
  note: string | null;
  occurredAt: string;
};

/** The header's `+` (writers), then Medication: the add sheet over the tab, once it's open. */
export const openAddMedication = async () => {
  await userEvent.click(getByCss("main header [data-add-medication]"));
  await userEvent.click(await found(() => menuItem("Medication")));
  await found(FORM);
};
