import type {
  ActionPreview,
  AppError,
  AssistantAction,
  ConditionAction,
  PreviewContext,
  RecipientCondition,
  TimelineEntry,
} from "@caretook/data";
import type { ToolContext, ToolOutput } from "../registry";

import {
  actionPreview,
  addConditionActionZSchema,
  addEventActionZSchema,
  addNoteActionZSchema,
  addTaskActionZSchema,
  appendLineZSchema,
  CONDITION_STATUSES,
  conditionSinceWords,
  assistantActionService,
  DOSE_STATUSES,
  ENTRY_APPEND_LIMITS,
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
  recipientConditionService,
  resolveConditionActionZSchema,
  resolveUnits,
  SYSTEM_USER,
  timelineEntryService,
  updateConditionActionZSchema,
  updateEntryActionZSchema,
  userModel,
  whenText,
} from "@caretook/data";
import { z } from "zod";
import { entryPath, linkTo, passLogPath, profilePath, todoPath } from "../links";
import { defineTool, WRITE_ANNOTATIONS } from "../registry";
import { loadGroup, loadMembers } from "./shared";

// The write tools (connectors PRD): one per assistant action, each a batch
// of one through the server's runner (`assistantActionService.run`) with
// `via` set to the connection's client name. Inputs are the actions' own
// shapes minus `type` (a time defaults to now; an event's zone, and a task's
// assignee by name, are filled in here). Each answers with quick entry's
// preview wording and a link to what it made. Nothing deletes or completes:
// people do that in the app. The edits (connectors-2) only add to a note's
// or event's text, or change its title or time, and don't set `via`.

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
      ? todoPath(ctx.groupId, first.id)
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

// ---------------------------------------------------------------------------
// Edits (connectors-2)
// ---------------------------------------------------------------------------

const entryIdInput = z.uuid().describe("The note's or event's id, from list_timeline, search or upcoming.");

/** What an entry is called in an answer: its title, else its first line, else its kind. */
const entryName = (entry: Pick<TimelineEntry, "kind" | "title" | "body">) => {
  const first = entry.body
    ?.split("\n")
    .find((line) => line.trim())
    ?.trim();
  const fallback = entry.kind === "event" ? "Event" : "Note";
  const name = entry.title?.trim() || first || fallback;
  return name.length > 80 ? `${name.slice(0, 79)}…` : name;
};

type Loaded = Exclude<Awaited<ReturnType<typeof loadGroup>>, AppError>;
const entryWhen = (entry: Pick<TimelineEntry, "occurredAt" | "allDay">, ctx: ToolContext, loaded: Loaded) =>
  whenText(new Date(entry.occurredAt).toISOString(), {
    now: ctx.now,
    locale: "en-US",
    timeZone: loaded.timeZone,
    allDay: !!entry.allDay,
  });

/** Run one edit, then answer with what changed (`detail`) and a link to the entry. */
const carryOutEdit = async (
  ctx: ToolContext,
  action: { type: "appendToEntry" | "updateEntry"; entryId: string } & Record<string, unknown>,
  what: string,
  detail: (before: TimelineEntry | null, after: TimelineEntry, loaded: Loaded) => string | null,
): Promise<ToolOutput | AppError> => {
  const loaded = await loadGroup(ctx);
  if (isError(loaded)) return loaded;
  const before = await timelineEntryService.getById({ authUser: ctx.authUser }, action.entryId);
  const res = await assistantActionService.run({ authUser: ctx.authUser }, ctx.groupId, [action], {
    via: ctx.clientName,
    now: ctx.now,
  });
  if (isError(res)) return res;
  const after = await timelineEntryService.getById({ authUser: ctx.authUser }, action.entryId);
  if (isError(after)) return after;
  if (!after) return newError({ code: "assistantActionService:entryNotFound" });

  const preview: ActionPreview = {
    title: entryName(after),
    detail: detail(isError(before) ? null : before, after, loaded),
    when: entryWhen(after, ctx, loaded),
  };
  const url = linkTo(ctx.origin, entryPath(ctx.groupId, after));
  const line = [preview.title, preview.detail, preview.when].filter(Boolean).join(" · ");
  return {
    text: [`${what}: ${line}`, url].join("\n"),
    structured: { preview, entryIds: [after.id], url },
  };
};

export const appendToEntry = defineTool({
  name: "append_to_entry",
  title: "Add to a note or event",
  description: `Add lines at the end of an existing note's or event's text (say, questions for an upcoming visit), leaving what's there as it is. Each line is a paragraph or a bullet; runs of bullets make one list. At most ${ENTRY_APPEND_LIMITS.lines} lines and ${ENTRY_APPEND_LIMITS.characters.toLocaleString("en-US")} characters. Anyone with the note open sees the lines arrive. Ask the member before calling.`,
  scope: "readWrite",
  input: z.object({
    entryId: entryIdInput,
    lines: appendLineZSchema
      .array()
      .min(1)
      .max(ENTRY_APPEND_LIMITS.lines)
      .describe("The lines to add, in order."),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: ({ entryId, lines }, ctx) =>
    carryOutEdit(ctx, { type: "appendToEntry", entryId, lines }, "Added to", () =>
      lines.length === 1 ? "1 line" : `${lines.length} lines`,
    ),
});

export const updateEntry = defineTool({
  name: "update_entry",
  title: "Change a note's or event's title or time",
  description:
    "Change an existing note's or event's title, its time, or both (an event's end moves with its start). Its text is left alone: use append_to_entry to add to it. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    entryId: entryIdInput,
    title: updateEntryActionZSchema.shape.title.describe("The new title."),
    occurredAt: updateEntryActionZSchema.shape.occurredAt.describe(
      "The new time (ISO 8601 with an offset, best in the recipient's time zone). All day: the start of that day.",
    ),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOutEdit(ctx, { type: "updateEntry", ...input }, "Updated", (before, after, loaded) => {
      if (!before) return null;
      const changes = [
        before.title !== after.title ? `renamed from ${entryName(before)}` : null,
        new Date(before.occurredAt).getTime() !== new Date(after.occurredAt).getTime()
          ? `moved from ${entryWhen(before, ctx, loaded)}`
          : null,
      ].filter(Boolean);
      const text = changes.join(", ");
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
    }),
});

// ---------------------------------------------------------------------------
// Conditions (connectors-2)
// ---------------------------------------------------------------------------

const conditionIdInput = z.uuid().describe("The condition's id, from recipient_profile.");

/** A condition as an answer says it: its name, and what else it has (resolved, since, note, diagnosed by). */
const conditionPreview = async (ctx: ToolContext, c: RecipientCondition): Promise<ActionPreview> => {
  let diagnosedBy: string | null = null;
  if (c.diagnosedById) {
    const provider = await providerService.getById({ authUser: ctx.authUser }, c.diagnosedById);
    if (!isError(provider)) diagnosedBy = provider?.name ?? null;
  }
  const bits = [
    c.status === "resolved" ? "Resolved" : "Active",
    conditionSinceWords(c.sinceYear, c.sinceMonth) &&
      `since ${conditionSinceWords(c.sinceYear, c.sinceMonth)}`,
    c.note?.trim() || null,
    diagnosedBy && `diagnosed by ${diagnosedBy}`,
  ].filter(Boolean);
  return { title: c.name, detail: bits.join(", "), when: "Now" };
};

/** Run one condition action, then answer with the condition as it now stands and a link to the profile. */
const carryOutCondition = async (
  ctx: ToolContext,
  action: ConditionAction,
  what: string,
): Promise<ToolOutput | AppError> => {
  const res = await assistantActionService.run({ authUser: ctx.authUser }, ctx.groupId, [action], {
    via: ctx.clientName,
    now: ctx.now,
  });
  if (isError(res)) return res;
  const id = res.byAction[0]?.[0];
  const condition = id ? await recipientConditionService.getById({ authUser: ctx.authUser }, id) : null;
  if (isError(condition)) return condition;
  if (!condition) return newError({ code: "assistantActionService:conditionNotFound" });

  const preview = await conditionPreview(ctx, condition);
  const url = linkTo(ctx.origin, profilePath(ctx.groupId));
  const line = [preview.title, preview.detail].filter(Boolean).join(" · ");
  return {
    text: [`${what}: ${line}`, url, `Its change shows on the timeline as "via ${ctx.clientName}".`].join(
      "\n",
    ),
    structured: { preview, conditionId: condition.id, url, via: ctx.clientName },
  };
};

export const addCondition = defineTool({
  name: "add_condition",
  title: "Add a condition",
  description:
    'Add an active condition to the care recipient\'s profile: a name ("Type 2 diabetes"), optionally since which year (and month), a short note and the provider who diagnosed it (an id from the provider directory). It also clears "no known conditions" and adds a line to the timeline. Check recipient_profile first so you don\'t add one that\'s already there. Ask the member before calling.',
  scope: "readWrite",
  input: z.object({
    ...shapeOf(addConditionActionZSchema),
    name: addConditionActionZSchema.shape.name.describe("The condition, in plain words."),
    sinceYear: addConditionActionZSchema.shape.sinceYear.describe("The year it started, such as 2015."),
    sinceMonth: addConditionActionZSchema.shape.sinceMonth.describe(
      "The month it started (1-12); needs a year.",
    ),
    diagnosedById: addConditionActionZSchema.shape.diagnosedById.describe("The diagnosing provider's id."),
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) => carryOutCondition(ctx, { type: "addCondition", ...input }, "Added condition"),
});

export const updateCondition = defineTool({
  name: "update_condition",
  title: "Change a condition",
  description: `Change an existing condition's name, status (${CONDITION_STATUSES.join(" or ")}: "active" brings a resolved one back), since, note or diagnosing provider. What you leave out stays; null clears an optional one. Use a condition's id from recipient_profile. To mark one over, resolve_condition is simpler. Ask the member before calling.`,
  scope: "readWrite",
  input: z.object({
    ...shapeOf(updateConditionActionZSchema),
    conditionId: conditionIdInput,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) => carryOutCondition(ctx, { type: "updateCondition", ...input }, "Updated condition"),
});

export const resolveCondition = defineTool({
  name: "resolve_condition",
  title: "Resolve a condition",
  description:
    "Mark a condition resolved: it moves to Past on the profile, with a line on the timeline. Use a condition's id from recipient_profile. Ask the member before calling.",
  scope: "readWrite",
  input: z.object({
    ...shapeOf(resolveConditionActionZSchema),
    conditionId: conditionIdInput,
  }),
  annotations: WRITE_ANNOTATIONS,
  handler: (input, ctx) =>
    carryOutCondition(ctx, { type: "resolveCondition", ...input }, "Resolved condition"),
});
