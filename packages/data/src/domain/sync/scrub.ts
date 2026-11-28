// What a soft delete clears (data-rights, slice 1): one spec per soft-delete
// table, the only place that decides what a deleted row keeps. The database
// applies it: migration 0051's hand-written `BEFORE` triggers clear these
// columns when `deleted_at` is set, empty the row's live document and strip
// the change entries that summarize it. The device mirrors it for its own
// todo deletes (`lib/todos/todos.sync.ts`). Tests tie it to the upload
// registry's content columns, the tables' constraints and the live triggers.
// Pure and client-safe.
//
// A deleted row keeps its id, group and recipient ids, kind or type, status,
// times, audits and the ids other rows point at; names and every other word
// go. Whatever brings a deleted row back supplies its content.

/**
 * What a column becomes:
 * - `keep`: stays as it is (an id, a kind, a status, a time, a schedule rule);
 * - `null`, `empty` (`''`) or `emptyList` (`[]`);
 * - `{ value }`: a constant that meets the column's NOT NULL and CHECKs;
 * - `details`: `timeline_entry.details`, by kind (`scrubEntryDetails`).
 */
export type ScrubRule = "keep" | "null" | "empty" | "emptyList" | { value: unknown } | "details";

export type ScrubSpec = {
  /** Every content column (the upload registry's), and any other one a delete clears. */
  columns: Readonly<Record<string, ScrubRule>>;
  /** The row owns a live document (`note_document` with its id): emptied, its updates deleted. */
  document: boolean;
  /** The timeline's change entries that summarize the row, by the id in their details: stripped too. */
  summaries?: { kind: "medicationChange" | "conditionChange"; idKey: "medicationId" | "conditionId" };
};

/** An asNeeded schedule with no maximum: the smallest one `medicationScheduleZSchema` accepts. */
const EMPTY_SCHEDULE = { type: "asNeeded" };

export const SCRUB_SPECS = {
  timeline_entry: {
    columns: {
      title: "null",
      body: "null",
      place: "null",
      cancel_reason: "null",
      details: "details",
      // A reference to the group's catalog type, not content: the catalog's
      // replace repoints deleted entries too (`symptomTypeService.replace`).
      symptom_type_id: "keep",
      time_zone: "keep",
      occurred_at: "keep",
      ends_at: "keep",
      cancelled_at: "keep",
      all_day: "keep",
      rescheduled_to: "keep",
      series_id: "keep",
      series_day: "keep",
      series_detached: "keep",
    },
    document: true,
  },
  provider: {
    columns: {
      name: "empty",
      specialty: "null",
      practice_id: "null",
      email: "null",
      address: "null",
      website: "null",
      phones: "emptyList",
      type: "keep",
      status: "keep",
      is_primary: "keep",
    },
    document: true,
  },
  medication: {
    columns: {
      name: "empty",
      strength: "null",
      form: "null",
      dose: "null",
      directions: "null",
      reason: "null",
      schedule: { value: EMPTY_SCHEDULE },
      stop_reason: "null",
      stop_note: "null",
      prescriber_id: "null",
      pharmacy_id: "null",
      quantity: "null",
      refills_left: "null",
      rx_number: "null",
      type: "null",
      status: "keep",
      started_on: "keep",
      stopped_on: "keep",
      last_filled_on: "keep",
    },
    document: true,
    summaries: { kind: "medicationChange", idKey: "medicationId" },
  },
  // The schedule history carve-out: a pass keeps its time (schedules and
  // missed doses read deleted passes at their times).
  medication_pass: {
    columns: { name: "empty", time: "keep", sort_order: "keep" },
    document: false,
  },
  recipient_allergy: {
    columns: { substance: "empty", reaction: "null", severity: { value: "unknown" } },
    document: false,
  },
  recipient_condition: {
    columns: {
      name: "empty",
      note: "null",
      diagnosed_by_id: "null",
      since_year: "null",
      since_month: "null",
      status: "keep",
    },
    document: false,
    summaries: { kind: "conditionChange", idKey: "conditionId" },
  },
  care_period: {
    columns: {
      label: "null",
      place_provider_id: "null",
      place_detail: "null",
      type: "keep",
      started_at: "keep",
      date_only: "keep",
    },
    document: true,
  },
  todo: {
    columns: {
      title: "empty",
      assignee_id: "null",
      assignee_name: "null",
      provider_id: "null",
      medication_id: "null",
      event_id: "null",
      // The chain (`repeat_id`, `repeat_starts_on`) needs its rule, and the rule its day.
      repeat_rule: "keep",
      due_on: "keep",
      due_time: "keep",
    },
    document: true,
  },
  // `appointment_series_time_check`: `start_time` stays with `all_day`.
  appointment_series: {
    columns: {
      title: "null",
      place: "null",
      provider_ids: "emptyList",
      rule: "keep",
      starts_on: "keep",
      start_time: "keep",
      all_day: "keep",
      time_zone: "keep",
      duration_minutes: "keep",
    },
    document: false,
  },
} as const satisfies Record<string, ScrubSpec>;

export type ScrubTable = keyof typeof SCRUB_SPECS;
export const SCRUB_TABLES = Object.keys(SCRUB_SPECS) as ScrubTable[];

/** What a cleared column holds once scrubbed, or undefined for `keep` and `details`. */
export const scrubValue = (rule: ScrubRule): unknown => {
  if (rule === "null") return null;
  if (rule === "empty") return "";
  if (rule === "emptyList") return [];
  if (typeof rule === "object") return rule.value;
  return undefined;
};

/** A table's cleared columns (snake_case) and what each becomes; `details` is left out. */
export const scrubbedColumns = (table: ScrubTable): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(SCRUB_SPECS[table].columns as Record<string, ScrubRule>).flatMap(([column, rule]) => {
      const value = scrubValue(rule);
      return value === undefined ? [] : [[column, value]];
    }),
  );

type Json = Record<string, unknown>;

const record = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;

/** The keys of `value` that are listed, as they are (nulls too). */
const pick = (value: Json, keys: readonly string[]): Json =>
  Object.fromEntries(Object.entries(value).filter(([key]) => keys.includes(key)));

/** What a dose keeps while its medication is live: its slot and outcome (the carve-out). */
const DOSE_KEPT = ["medicationId", "status", "scheduledFor", "passId", "passLogId"] as const;
/** What a medication change keeps while its medication is live: its schedule, in `before` and `after`. */
const CHANGE_KEPT = ["medicationId", "change"] as const;
const SUMMARY_KEPT = ["schedule", "dose"] as const;
/** A pass's move keeps its pass and times; its name goes (`passName`, required, becomes ""). */
const PASS_MOVE_KEPT = ["change", "passId", "beforeTime", "afterTime", "medicationIds"] as const;
/** A condition change keeps the condition and the change; its name goes (`conditionName` becomes ""). */
const CONDITION_CHANGE_KEPT = ["conditionId", "change"] as const;

/**
 * A timeline entry's `details` once scrubbed, by kind (`timeline_entry`'s
 * `details` rule; the database's `scrub_entry_details` is its twin):
 * - symptoms, vitals, notes, events: null;
 * - a dose: its slot and outcome while `medicationLive`, else only the medication and status;
 * - a medication change: its schedule and usual dose (`before`, `after`) while
 *   `medicationLive`, else only the medication and the change; a pass's move
 *   keeps its times and loses its name;
 * - a condition change: the condition and the change.
 *
 * `medicationLive` says whether the medication the details name is live (the
 * schedule history carve-out: `scheduleHistory`, `dueDoses` and visit prep
 * read deleted doses and change lines on purpose).
 */
export const scrubEntryDetails = (
  kind: string,
  details: unknown,
  { medicationLive }: { medicationLive: boolean },
): Json | null => {
  const d = record(details);
  if (!d) return null;
  if (kind === "dose") return pick(d, medicationLive ? DOSE_KEPT : ["medicationId", "status"]);
  if (kind === "medicationChange") {
    if (d.change === "passMoved") return { ...pick(d, PASS_MOVE_KEPT), passName: "" };
    const kept = pick(d, CHANGE_KEPT);
    if (!medicationLive) return kept;
    const summary = (key: "before" | "after") => {
      const s = record(d[key]);
      return s ? { [key]: pick(s, SUMMARY_KEPT) } : {};
    };
    return { ...kept, ...summary("before"), ...summary("after") };
  }
  if (kind === "conditionChange") return { ...pick(d, CONDITION_CHANGE_KEPT), conditionName: "" };
  return null;
};
