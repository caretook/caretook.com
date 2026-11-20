import { z } from "zod";
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
