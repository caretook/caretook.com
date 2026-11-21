import { z } from "zod";
import {
  recipientConditionContentZSchema,
  recipientConditionUpdateZSchema,
} from "../profiles/recipientCondition";
import { doseDetailsZSchema, scheduleTimeZSchema } from "../medications/medication";
import { TASK_LIMITS, TIME_NEEDS_DAY_ISSUE } from "../tasks/task";
import { symptomDetailsZSchema, TIMELINE_LIMITS } from "../timeline/timelineEntry";
import { timeZoneZSchema } from "../core/timeZone";
import { vitalDetailsZSchema } from "../timeline/vitals";

// Assistant actions: what quick entry (and later a user's own AI, through
// `connectors`) asks Caretook to do, one small validated shape per thing.
// Client-safe and pure. Each schema is built from the content schemas the
// forms and the server already use, so an action that passes here makes an
// entry those rules accept (apart from the time, which is checked against
// "now" where it's carried out). Actions carry no ids of their own and
// nothing device-only: whoever carries them out makes the rows.

const occurredAt = z.iso.datetime({ offset: true });
const optionalText = (max: number) => z.string().trim().max(max).nullish();

/** One sitting's readings, as the vitals form makes one entry: at most one of each type. */
export const logVitalActionZSchema = z
  .strictObject({
    type: z.literal("logVital"),
    readings: vitalDetailsZSchema.shape.readings,
    note: optionalText(TIMELINE_LIMITS.body),
    occurredAt,
  })
  .refine((a) => new Set(a.readings.map((r) => r.type)).size === a.readings.length, {
    path: ["readings"],
    message: "Each vital can appear once per entry",
  });

/** Something the recipient feels or reports, with an optional 0–10 severity and a note. */
export const logSymptomActionZSchema = z.strictObject({
  type: z.literal("logSymptom"),
  name: symptomDetailsZSchema.shape.name,
  severity: symptomDetailsZSchema.shape.severity,
  note: optionalText(TIMELINE_LIMITS.body),
  occurredAt,
});

/** One medication given, skipped or refused. */
export const logDoseActionZSchema = z.strictObject({
  type: z.literal("logDose"),
  medicationId: doseDetailsZSchema.shape.medicationId,
  status: doseDetailsZSchema.shape.status,
  amount: doseDetailsZSchema.shape.amount,
  note: doseDetailsZSchema.shape.note,
  occurredAt,
});

/**
 * A pass's Given all: every medication in the pass still open on its day,
 * given at `occurredAt`, as one round (what the medication strip's Given all
 * writes). Whoever carries it out works out which medications those are.
 */
export const givePassActionZSchema = z.strictObject({
  type: z.literal("givePass"),
  passId: z.uuid(),
  occurredAt,
});

/** A note: its text becomes the note's live document. */
export const addNoteActionZSchema = z.strictObject({
  type: z.literal("addNote"),
  title: optionalText(TIMELINE_LIMITS.title),
  text: z.string().trim().min(1).max(TIMELINE_LIMITS.body),
  occurredAt,
});

/**
 * An event: something that happened, or (in the future) an appointment, with
 * its providers. An all-day event starts at the start of its day in
 * `timeZone`, as the content rules require.
 */
export const addEventActionZSchema = z.strictObject({
  type: z.literal("addEvent"),
  title: z.string().trim().min(1).max(TIMELINE_LIMITS.title),
  occurredAt,
  endsAt: occurredAt.nullish(),
  allDay: z.boolean().optional(),
  place: optionalText(TIMELINE_LIMITS.place),
  providerIds: z.array(z.uuid()).max(20).default([]),
  timeZone: timeZoneZSchema,
});

/**
 * A task: a title, at most one member to do it, and an optional due day
 * with an optional time (wall-clock in the recipient's zone), plus optional
 * links. Not a timeline entry, so it has no `occurredAt`. Whoever carries it
 * out checks the assignee is a member and the links are live in the group.
 */
export const addTaskActionZSchema = z
  .strictObject({
    type: z.literal("addTask"),
    title: z.string().trim().min(1).max(TASK_LIMITS.title),
    assigneeId: z.uuid().nullish(),
    dueOn: z.iso.date().nullish(),
    dueTime: scheduleTimeZSchema.nullish(),
    providerId: z.uuid().nullish(),
    medicationId: z.uuid().nullish(),
    eventId: z.uuid().nullish(),
  })
  .refine((a) => !a.dueTime || !!a.dueOn, {
    path: [TIME_NEEDS_DAY_ISSUE.path],
    message: TIME_NEEDS_DAY_ISSUE.message,
  });

/** Every action. */
export const assistantActionZSchema = z.discriminatedUnion("type", [
  logVitalActionZSchema,
  logSymptomActionZSchema,
  logDoseActionZSchema,
  addNoteActionZSchema,
  addEventActionZSchema,
  givePassActionZSchema,
  addTaskActionZSchema,
]);
export type AssistantAction = z.output<typeof assistantActionZSchema>;
export type AssistantActionInput = z.input<typeof assistantActionZSchema>;
export type AssistantActionType = AssistantAction["type"];
export type ActionOf<T extends AssistantActionType> = Extract<AssistantAction, { type: T }>;

/** The kind each action writes: a timeline kind, or `task` (not an entry). */
export const ACTION_KINDS = {
  logVital: "vital",
  logSymptom: "symptom",
  logDose: "dose",
  addNote: "note",
  addEvent: "event",
  givePass: "dose",
  addTask: "task",
} as const satisfies Record<AssistantActionType, string>;
export type ActionKind = (typeof ACTION_KINDS)[AssistantActionType];

// ---------------------------------------------------------------------------
// Edits (connectors-2): a connected assistant adding to, or retitling or
// moving, a note or event that already exists. Carried out only on the
// server (`assistantActionService.run`), so they aren't quick entry's
// actions (`assistantActionZSchema`). Each names its entry; whoever carries
// it out checks the entry is a live note or event in the group.
// ---------------------------------------------------------------------------

/** How much one append may add. */
export const ENTRY_APPEND_LIMITS = { lines: 50, characters: 5_000 } as const;

/** One line an append adds: a paragraph (the default) or a bullet (runs of them make one list). */
export const appendLineZSchema = z.strictObject({
  text: z.string().trim().min(1).max(ENTRY_APPEND_LIMITS.characters),
  style: z.enum(["paragraph", "bullet"]).optional(),
});

/** Lines added at the end of a note's or event's live document, leaving what's there alone. */
export const appendToEntryActionZSchema = z
  .strictObject({
    type: z.literal("appendToEntry"),
    entryId: z.uuid(),
    lines: z.array(appendLineZSchema).min(1).max(ENTRY_APPEND_LIMITS.lines),
  })
  .refine((a) => a.lines.reduce((sum, line) => sum + line.text.length, 0) <= ENTRY_APPEND_LIMITS.characters, {
    path: ["lines"],
    message: `At most ${ENTRY_APPEND_LIMITS.characters.toLocaleString("en-US")} characters at a time`,
  });

/** A note's or event's new title or time (at least one). */
export const updateEntryActionZSchema = z
  .strictObject({
    type: z.literal("updateEntry"),
    entryId: z.uuid(),
    title: z.string().trim().min(1).max(TIMELINE_LIMITS.title).optional(),
    occurredAt: occurredAt.optional(),
  })
  .refine((a) => a.title !== undefined || a.occurredAt !== undefined, {
    message: "Give a new title, a new time or both",
  });

/** Every edit. */
export const entryEditActionZSchema = z.discriminatedUnion("type", [
  appendToEntryActionZSchema,
  updateEntryActionZSchema,
]);
export type EntryEditAction = z.output<typeof entryEditActionZSchema>;

// ---------------------------------------------------------------------------
// Conditions (connectors-2): adding, updating and resolving one of the care
// recipient's conditions, through `recipientConditionService` (its rules and
// change entries apply). Server only, like the edits. Who manages a
// condition (provider links) isn't an assistant's to change.
// ---------------------------------------------------------------------------

const conditionContent = recipientConditionContentZSchema.shape;

/** A new, active condition: a name, optionally since when, a note and who diagnosed it. */
export const addConditionActionZSchema = z.strictObject({
  type: z.literal("addCondition"),
  name: conditionContent.name,
  sinceYear: conditionContent.sinceYear,
  sinceMonth: conditionContent.sinceMonth,
  note: conditionContent.note,
  diagnosedById: conditionContent.diagnosedById,
});

/** A condition's new name, status, since, note or diagnosing provider (at least one; null clears an optional one). */
export const updateConditionActionZSchema = z
  .strictObject({
    type: z.literal("updateCondition"),
    conditionId: z.uuid(),
    ...recipientConditionUpdateZSchema.shape,
  })
  .refine(
    (a) => Object.entries(a).some(([key, v]) => key !== "type" && key !== "conditionId" && v !== undefined),
    {
      message: "Give at least one thing to change",
    },
  );

/** A condition no longer active: it moves to Past. */
export const resolveConditionActionZSchema = z.strictObject({
  type: z.literal("resolveCondition"),
  conditionId: z.uuid(),
});

/** Every condition action. */
export const conditionActionZSchema = z.discriminatedUnion("type", [
  addConditionActionZSchema,
  updateConditionActionZSchema,
  resolveConditionActionZSchema,
]);
export type ConditionAction = z.output<typeof conditionActionZSchema>;
