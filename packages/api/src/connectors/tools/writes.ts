import type { AppError, AssistantAction, PreviewContext } from "@caretook/data";
import type { ToolContext, ToolOutput } from "../registry";

import {
  actionPreview,
  addEventActionZSchema,
  addNoteActionZSchema,
  addTaskActionZSchema,
  assistantActionService,
  DOSE_STATUSES,
  givePassActionZSchema,
  isDoseDetails,
  isError,
  logDoseActionZSchema,
  logSymptomActionZSchema,
  logVitalActionZSchema,
  medicationPassService,
  medicationService,
  newError,
  providerService,
  resolveUnits,
  SYSTEM_USER,
  timelineEntryService,
  userModel,
} from "@caretook/data";
import { z } from "zod";
import { entryPath, linkTo, passLogPath, taskPath } from "../links";
import { defineTool, WRITE_ANNOTATIONS } from "../registry";
import { loadGroup, loadMembers } from "./shared";

// The write tools (connectors PRD): one per assistant action, each a batch
// of one through the server's runner (`assistantActionService.run`) with
// `via` set to the connection's client name. Inputs are the actions' own
// shapes minus `type` (a time defaults to now; an event's zone, and a task's
// assignee by name, are filled in here). Each answers with quick entry's
// preview wording and a link to what it made. Nothing edits, deletes or
// completes: people do that in the app.

const when = z.iso
  .datetime({ offset: true })
  .optional()
  .describe("When it happened (ISO 8601 with an offset, best in the recipient's time zone). Default: now.");

const shapeOf = <S extends z.ZodRawShape & { type: unknown }>(schema: { shape: S }) => {
  const { type: _type, ...rest } = schema.shape;
  return rest;
};

/** The member's units, for the preview's wording (the readings themselves are canonical). */
const unitsOf = async (ctx: ToolContext) => {
  const me = await userModel.getWholeById(ctx.authUser.id, { authUser: SYSTEM_USER });
  return isError(me) ? me : resolveUnits(me?.preferences);
};

type Made =
  { kind: "entry"; id: string; entryKind: string; passLogId?: string | null } | { kind: "task"; id: string };

/**
 * Run one action, then answer in quick entry's words with a link. `names`
 * fills the preview's names (a medication, a pass, providers, members).
 */
const carryOut = async (
  ctx: ToolContext,
  action: AssistantAction,
  names: (ids: string[]) => Promise<Partial<PreviewContext> | AppError> = () => Promise.resolve({}),
): Promise<ToolOutput | AppError> => {
  const loaded = await loadGroup(ctx);
  if (isError(loaded)) return loaded;
  const res = await assistantActionService.run({ authUser: ctx.authUser }, ctx.groupId, [action], {
    via: ctx.clientName,
    now: ctx.now,
  });
  if (isError(res)) return res;
  const ids = res.byAction[0] ?? [];

  const units = await unitsOf(ctx);
  if (isError(units)) return units;
  const named = await names(ids);
  if (isError(named)) return named;
  const preview = actionPreview(action, {
    units,
    now: ctx.now,
    medications: new Map(),
    providers: new Map(),
    timeZone: loaded.timeZone,
    recipientTimeZone: loaded.timeZone,
    locale: "en-US",
    ...named,
  });

  const made: Made[] = [];
  for (const id of ids) {
    if (action.type === "addTask") {
      made.push({ kind: "task", id });
      continue;
    }
    const entry = await timelineEntryService.getById({ authUser: ctx.authUser }, id);
    if (isError(entry)) return entry;
    made.push({
      kind: "entry",
      id,
      entryKind: entry?.kind ?? "note",
      passLogId: isDoseDetails(entry?.details) ? entry.details.passLogId : null,
    });
  }
  const first = made[0];
  const path = !first
    ? null
    : first.kind === "task"
      ? taskPath(ctx.groupId, first.id)
      : action.type === "givePass" && first.passLogId
        ? passLogPath(ctx.groupId, first.passLogId)
        : entryPath(ctx.groupId, { id: first.id, kind: first.entryKind });
  const url = path ? linkTo(ctx.origin, path) : null;
  const line = [preview.title, preview.detail, preview.when].filter(Boolean).join(" · ");
  const what =
    action.type === "addTask" ? "Added task" : made.length > 1 ? `Logged ${made.length} entries` : "Logged";
  return {
    text: [`${what}: ${line}`, ...(url ? [url] : []), `Shown as "via ${ctx.clientName}".`].join("\n"),
    structured: {
      preview,
      ...(action.type === "addTask" ? { taskId: first?.id ?? null } : { entryIds: ids }),
      url,
      via: ctx.clientName,
    },
  };
};

// ---------------------------------------------------------------------------
// The tools
// ---------------------------------------------------------------------------

export const logVitals = defineTool({
  name: "log_vitals",
  title: "Log vital signs",
  description:
    "Record one sitting's vital signs as a timeline entry (at most one reading of each type). Values are in fixed units, whatever the member's display units: blood pressure and heart rate as usual (mmHg, bpm), temperature in °C, oxygen saturation in %, breathing rate per minute, weight in kg, blood sugar in mg/dL, urine output in mL, sleep in hours, a bowel movement's Bristol type 1–7. Convert first (98.6 °F is 37 °C; 150 lb is 68 kg). Blood pressure's bottom number must be lower than the top. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...shapeOf(logVitalActionZSchema),
    readings: logVitalActionZSchema.shape.readings.describe(
      'Each reading has a `type` and its numbers, e.g. {"type":"bloodPressure","systolic":130,"diastolic":85}, {"type":"heartRate","value":72}, {"type":"temperature","value":37.2}.',
    ),
    note: logVitalActionZSchema.shape.note.describe("A short note with the readings."),
    occurredAt: when,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOut(ctx, { type: "logVital", ...input, occurredAt: input.occurredAt ?? ctx.now.toISOString() }),
});

export const logSymptom = defineTool({
  name: "log_symptom",
  title: "Log a symptom",
  description:
    "Record a symptom the care recipient has or reports, with an optional severity from 0 (none) to 10 (worst) and a note. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...shapeOf(logSymptomActionZSchema),
    name: logSymptomActionZSchema.shape.name.describe('What it is, in a few words: "Headache", "Dizzy".'),
    occurredAt: when,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOut(ctx, { type: "logSymptom", ...input, occurredAt: input.occurredAt ?? ctx.now.toISOString() }),
});

const medicationNames = (ctx: ToolContext, medicationId: string) => async () => {
  const medication = await medicationService.getById({ authUser: ctx.authUser }, medicationId, {
    includeDeleted: true,
  });
  if (isError(medication)) return medication;
  return { medications: new Map(medication ? [[medication.id, medication]] : []) };
};

export const logDose = defineTool({
  name: "log_dose",
  title: "Log a medication dose",
  description: `Record one dose of a current medication as ${DOSE_STATUSES.join(", ")}, with an optional amount ("1 tablet") and note. Use a medication's id from the medication list. To mark a whole medication round given, use give_pass instead. Ask the member before calling.`,
  scope: "readWrite",
  input: z.object({
    ...shapeOf(logDoseActionZSchema),
    medicationId: logDoseActionZSchema.shape.medicationId.describe("The medication's id."),
    occurredAt: when,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOut(
      ctx,
      { type: "logDose", ...input, occurredAt: input.occurredAt ?? ctx.now.toISOString() },
      medicationNames(ctx, input.medicationId),
    ),
});

export const givePass = defineTool({
  name: "give_pass",
  title: "Give a medication round",
  description:
    "Mark a medication round (a pass, such as Morning or Evening) given: one dose for each medication in it that nothing has answered yet that day, as the app's Given all does. Doses already logged are left alone. Use a pass's id from today's doses. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...shapeOf(givePassActionZSchema),
    passId: givePassActionZSchema.shape.passId.describe("The pass's id."),
    occurredAt: when,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOut(
      ctx,
      { type: "givePass", ...input, occurredAt: input.occurredAt ?? ctx.now.toISOString() },
      async (ids) => {
        const pass = await medicationPassService.getById({ authUser: ctx.authUser }, input.passId);
        if (isError(pass)) return pass;
        return { passes: new Map(pass ? [[pass.id, { name: pass.name, open: ids.length }]] : []) };
      },
    ),
});

export const addNote = defineTool({
  name: "add_note",
  title: "Add a note",
  description:
    "Add a note to the timeline: plain text (new lines for paragraphs), with an optional short title. Members can go on editing it in the app. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...shapeOf(addNoteActionZSchema),
    occurredAt: when,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOut(ctx, { type: "addNote", ...input, occurredAt: input.occurredAt ?? ctx.now.toISOString() }),
});

export const addEvent = defineTool({
  name: "add_event",
  title: "Add an event or appointment",
  description:
    "Add an event to the timeline: something that happened, or an appointment ahead (a future time is fine). Optionally all day, an end time, a place and providers (ids from the provider directory). Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...shapeOf(addEventActionZSchema),
    occurredAt: z.iso
      .datetime({ offset: true })
      .describe("When it starts (ISO 8601 with an offset). All day: the start of that day."),
    timeZone: addEventActionZSchema.shape.timeZone
      .optional()
      .describe("The IANA zone it's in. Default: the recipient's."),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: async (input, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const providerIds = input.providerIds ?? [];
    return carryOut(
      ctx,
      { type: "addEvent", ...input, providerIds, timeZone: input.timeZone ?? loaded.timeZone },
      async () => {
        const providers = new Map<string, { name: string }>();
        for (const id of providerIds) {
          const provider = await providerService.getById({ authUser: ctx.authUser }, id);
          if (isError(provider)) return provider;
          if (provider) providers.set(id, { name: provider.name });
        }
        return { providers };
      },
    );
  },
});

const ASSIGNEE_ISSUE = (message: string) =>
  newError({ code: "assistantActionService:invalid", meta: { issues: [{ path: "assignee", message }] } });

export const addTask = defineTool({
  name: "add_task",
  title: "Add a task",
  description:
    "Add a task to the group's list: a title, optionally a member to do it (by name, as the group overview lists them), a due day (YYYY-MM-DD) with an optional time (HH:MM, the recipient's time zone), and links to a provider, a medication or an event by id. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...(({ assigneeId: _assigneeId, ...rest }) => rest)(shapeOf(addTaskActionZSchema)),
    assignee: z.string().trim().min(1).max(120).optional().describe("The member to do it, by name."),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: async ({ assignee, ...input }, ctx) => {
    const members = await loadMembers(ctx);
    if (isError(members)) return members;
    let assigneeId: string | null = null;
    if (assignee) {
      const fold = (name: string | null) => (name ?? "").trim().toLocaleLowerCase("en-US");
      const exact = members.filter((m) => fold(m.name) === fold(assignee));
      const matches = exact.length
        ? exact
        : members.filter((m) => fold(m.name).split(/\s+/).includes(fold(assignee)));
      if (matches.length !== 1)
        return ASSIGNEE_ISSUE(
          matches.length
            ? `More than one member is called ${assignee}: use their full name.`
            : `No member is called ${assignee}. Members: ${members.map((m) => m.name ?? "Someone").join(", ")}.`,
        );
      assigneeId = matches[0]!.id;
    }
    return carryOut(ctx, { type: "addTask", ...input, assigneeId }, () =>
      Promise.resolve({
        members: new Map(members.map((m) => [m.id, { name: m.name ?? "Someone" }])),
      }),
    );
  },
});
