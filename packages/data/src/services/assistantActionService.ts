import type { z } from "zod";
import type { AssistantAction, DueDose, DueMedication, TimelineEntryCreateInput, Tx } from "../db";
import type { AppError } from "../errors";
import type { ServiceContext } from "./types";

import { withTransaction } from "../db";
import {
  assistantActionZSchema,
  DEVICE_FUTURE_SKEW_MS,
  dueDoses,
  duePasses,
  encodeNoteDoc,
  FALLBACK_TIME_ZONE,
  FUTURE_DATE_MESSAGE,
  givenAllWrites,
  isDoseDetails,
  isTooFarAhead,
  noteDocFromText,
  addDays,
  dayInZone,
  startOfDay,
  timelineEntryContentZSchema,
} from "../db/schema";
import { isError, newError } from "../errors";
import {
  careGroupMemberModel,
  careRecipientModel,
  medicationModel,
  medicationPassModel,
  providerModel,
  timelineEntryModel,
} from "../models";
import { rejectError } from "../permissions";
import * as entryProviderService from "./entryProviderService";
import * as noteDocumentService from "./noteDocumentService";
import * as taskService from "./taskService";
import * as timelineEntryService from "./timelineEntryService";

// Carrying out assistant actions on the server (connectors PRD): the twin of
// the device's `runActions` (lib/assistant/quickEntry.sync.ts), for a
// member's own AI assistant through /mcp. The whole batch is checked first
// (the action schemas, no future time on a past-only kind against the
// server's clock, the writer role, live and current medications, live
// providers, a pass's open slots planned with `duePasses`/`givenAllWrites`),
// then written in ONE transaction through the services, which check
// everything again. A refusal anywhere writes nothing and names the action
// (`meta.index`; null when it's the whole batch). Entries and tasks are the
// member's own (author, permissions, filters), carrying `via`: the
// assistant's name.

export const serviceName = "assistantAction";

const WRITER_ROLES = ["owner", "admin", "caretaker"] as const;

export type RunOptions = {
  /** The assistant the batch came through ("Claude"): stored on every entry and task. */
  via: string;
  /** The server's clock (tests pin it). */
  now?: Date;
};

export type RunResult = {
  /** Every entry (and task) written, in order (a pass writes one per medication). */
  ids: string[];
  /** Each action's entries (an `addTask`'s task), in the actions' order. */
  byAction: string[][];
};

type Issue = { path: string; message: string };

const issuesOf = (error: z.ZodError): Issue[] =>
  error.issues.map(({ path, message }) => ({ path: path.join("."), message }));

/** `error`, naming the action it refused (null: the whole batch). */
const at = (error: AppError, index: number | null): AppError => {
  error.meta = { ...error.meta, index };
  return error;
};

const invalid = (issues: Issue[]) => newError({ code: "assistantActionService:invalid", meta: { issues } });

type EntryPlan = {
  type: "entry";
  input: TimelineEntryCreateInput;
  /** A note's or event's live document, with a note's text. */
  document?: { text: string | null };
  providerIds: string[];
};
type Plan =
  { index: number; rows: EntryPlan[] } | { index: number; task: Parameters<typeof taskService.create>[1] };

type Setting = { groupId: string; recipientId: string; timeZone: string; now: Date };

/** The content an action writes (a pass's doses and a task are planned apart). */
const contentOf = (action: Exclude<AssistantAction, { type: "givePass" | "addTask" }>, timeZone: string) => {
  switch (action.type) {
    case "logVital":
      return {
        kind: "vital",
        occurredAt: action.occurredAt,
        timeZone,
        body: action.note ?? null,
        details: { readings: action.readings },
      };
    case "logSymptom":
      return {
        kind: "symptom",
        occurredAt: action.occurredAt,
        timeZone,
        body: action.note ?? null,
        details: { name: action.name, severity: action.severity ?? null },
      };
    case "logDose":
      return {
        kind: "dose",
        occurredAt: action.occurredAt,
        timeZone,
        details: {
          medicationId: action.medicationId,
          status: action.status,
          ...(action.amount && { amount: action.amount }),
          ...(action.note && { note: action.note }),
        },
      };
    case "addNote":
      return {
        kind: "note",
        title: action.title ?? null,
        occurredAt: action.occurredAt,
        timeZone,
        details: null,
      };
    case "addEvent":
      return {
        kind: "event",
        title: action.title,
        occurredAt: action.occurredAt,
        timeZone: action.timeZone,
        details: null,
        ...(action.allDay && { allDay: true }),
        ...(action.endsAt && { endsAt: action.endsAt }),
        ...(action.place && { place: action.place }),
      };
  }
};

const future = (kind: string, occurredAt: string, now: Date) =>
  isTooFarAhead(kind, occurredAt, now, DEVICE_FUTURE_SKEW_MS)
    ? invalid([{ path: "occurredAt", message: FUTURE_DATE_MESSAGE }])
    : null;

/** Postgres timestamptz text → ISO 8601, so the due-doses core compares like with like. */
const toIso = (value: string) => new Date(value).toISOString();

/** A medication the member can see in the group, live and current, or why not. */
const currentMedication = async (ctx: ServiceContext, tx: Tx, groupId: string, id: string) => {
  const medication = await medicationModel.getById(id, { ...ctx, tx });
  if (isError(medication)) return medication;
  if (!medication || medication.groupId !== groupId)
    return newError({ code: "assistantActionService:medicationGone" });
  if (medication.status !== "current")
    return newError({
      code: "assistantActionService:medicationStopped",
      message: `${medication.name} isn't current. Restart it in the app to log doses of it.`,
    });
  return medication;
};

/**
 * A pass's Given all on the day `occurredAt` falls on (in the recipient's
 * zone): one dose per slot nothing has answered yet, given then, as one round
 * (joining one already started), as the device plans it.
 */
const passDoses = async (
  ctx: ServiceContext,
  tx: Tx,
  setting: Setting,
  action: Extract<AssistantAction, { type: "givePass" }>,
): Promise<EntryPlan[] | AppError> => {
  const { groupId, timeZone } = setting;
  const when = new Date(action.occurredAt);
  const refused = future("dose", action.occurredAt, setting.now);
  if (refused) return refused;

  const filter = { groupId: { type: "eq" as const, value: groupId } };
  const pass = await medicationPassModel.getById(action.passId, { ...ctx, tx });
  if (isError(pass)) return pass;
  if (!pass || pass.groupId !== groupId) return newError({ code: "assistantActionService:passGone" });

  const [medications, passes] = await Promise.all([
    medicationModel.list({ ...ctx, tx, filter, paginate: { page: 1, limit: 500 } }),
    medicationPassModel.list({ ...ctx, tx, filter, includeDeleted: true, paginate: { page: 1, limit: 100 } }),
  ]);
  if (isError(medications)) return medications;
  if (isError(passes)) return passes;
  // From the start of the day before (yesterday's slots answer as today's do).
  const from = startOfDay(addDays(dayInZone(when, timeZone), -1), timeZone).toISOString();
  const doses = await dosesSince(ctx, tx, groupId, from);
  if (isError(doses)) return doses;

  const due = dueDoses({
    medications: medications.data.map((m): DueMedication => ({
      ...m,
      createdAt: m.createdAt ? toIso(m.createdAt) : null,
    })),
    passes: passes.data,
    doses,
    now: when,
    timeZone,
  });
  const planned = duePasses(due, passes.data).find((p) => p.passId === action.passId);
  if (!planned?.slots.length)
    return newError({
      code: "assistantActionService:passEmpty",
      message: `${pass.name} has no medications.`,
    });
  const writes = givenAllWrites(planned, when);
  if (!writes.length)
    return newError({
      code: "assistantActionService:nothingLeft",
      message: `Nothing is left to give in ${pass.name} today.`,
    });
  return writes.map(({ occurredAt, ...details }) => ({
    type: "entry",
    input: { groupId, recipientId: setting.recipientId, kind: "dose", occurredAt, timeZone, details },
    providerIds: [],
  }));
};

/** The group's live doses from `from` on, as the due-doses core reads them. */
const dosesSince = async (ctx: ServiceContext, tx: Tx, groupId: string, from: string) => {
  const doses: DueDose[] = [];
  let cursor: string | null = null;
  do {
    const page = await timelineEntryModel.listPage({
      ...ctx,
      tx,
      filter: {
        groupId: { type: "eq", value: groupId },
        kind: { type: "eq", value: "dose" },
        occurredAt: { type: "gte", value: from },
      },
      cursor,
      limit: 500,
    });
    if (isError(page)) return page;
    for (const entry of page.data)
      if (isDoseDetails(entry.details))
        doses.push({
          id: entry.id,
          occurredAt: toIso(entry.occurredAt),
          details: entry.details,
          createdBy: entry.createdBy,
        });
    cursor = page.nextCursor;
  } while (cursor);
  return doses;
};

/** One action's rows, checked; or why it's refused. */
const planAction = async (
  ctx: ServiceContext,
  tx: Tx,
  setting: Setting,
  input: unknown,
): Promise<EntryPlan[] | Parameters<typeof taskService.create>[1] | AppError> => {
  const parsed = assistantActionZSchema.safeParse(input);
  if (!parsed.success) return invalid(issuesOf(parsed.error));
  const action = parsed.data;
  const { groupId, recipientId, timeZone } = setting;

  if (action.type === "givePass") return passDoses(ctx, tx, setting, action);
  // Checked by taskService as it writes (the assignee, the links).
  if (action.type === "addTask") {
    const { type: _type, ...task } = action;
    return { groupId, recipientId, ...task };
  }

  const content = timelineEntryContentZSchema.safeParse(contentOf(action, timeZone));
  if (!content.success) return invalid(issuesOf(content.error));
  const refused = future(content.data.kind, content.data.occurredAt, setting.now);
  if (refused) return refused;

  if (action.type === "logDose") {
    const medication = await currentMedication(ctx, tx, groupId, action.medicationId);
    if (isError(medication)) return medication;
  }
  const providerIds = action.type === "addEvent" ? [...new Set(action.providerIds)] : [];
  for (const providerId of providerIds) {
    const provider = await providerModel.getById(providerId, { ...ctx, tx });
    if (isError(provider)) return provider;
    if (!provider || provider.groupId !== groupId)
      return newError({ code: "assistantActionService:providerGone" });
  }
  return [
    {
      type: "entry",
      input: { groupId, recipientId, ...content.data },
      // A note's or event's text is its live document, written with it.
      ...((action.type === "addNote" || action.type === "addEvent") && {
        document: { text: action.type === "addNote" ? action.text : null },
      }),
      providerIds,
    },
  ];
};

/** Write one entry with its document and provider links. */
const writeEntry = async (ctx: ServiceContext, plan: EntryPlan, via: string) => {
  const entry = await timelineEntryService.create(ctx, plan.input, { via });
  if (isError(entry)) return entry;
  if (!entry) return rejectError(ctx.authUser);
  const { groupId } = plan.input;
  if (plan.document) {
    const doc = await noteDocumentService.create(ctx, { id: entry.id, groupId });
    if (isError(doc)) return doc;
    if (plan.document.text?.trim()) {
      const ydoc = noteDocFromText(plan.document.text);
      const update = await noteDocumentService.appendUpdate(ctx, {
        id: crypto.randomUUID(),
        groupId,
        documentId: entry.id,
        data: encodeNoteDoc(ydoc),
      });
      ydoc.destroy();
      if (isError(update)) return update;
      // Compacted at once, so reads (and the assistant's next list) have its text.
      const compacted = await noteDocumentService.compact(entry.id, { tx: ctx.tx });
      if (isError(compacted)) return compacted;
    }
  }
  for (const providerId of plan.providerIds) {
    const link = await entryProviderService.link(ctx, { groupId, entryId: entry.id, providerId });
    if (isError(link)) return link;
  }
  return entry.id;
};

/**
 * Carry out `actions` in the group as the member in `ctx`, in order, in one
 * transaction, each entry and task carrying `via`. Returns the ids written,
 * or the first refusal (an AppError whose `meta.index` is the action
 * refused, null for the whole batch: a viewer, a non-member, a group with no
 * recipient) with nothing written. Entries are dated in the recipient's
 * zone; an event carries its own.
 */
export const run = (
  ctx: ServiceContext,
  groupId: string,
  actions: readonly unknown[],
  { via, now = new Date() }: RunOptions,
): Promise<RunResult | AppError> =>
  withTransaction(async (tx): Promise<RunResult | AppError> => {
    const inTx = { ...ctx, tx };
    if (!ctx.authUser) return at(rejectError(ctx.authUser), null);
    const role = await careGroupMemberModel.getRole(groupId, ctx.authUser.id, { tx });
    if (isError(role)) return role;
    if (!role || !(WRITER_ROLES as readonly string[]).includes(role))
      return at(rejectError(ctx.authUser), null);
    const recipient = await careRecipientModel.get({
      ...inTx,
      filter: { groupId: { type: "eq", value: groupId } },
    });
    if (isError(recipient)) return recipient;
    if (!recipient) return at(newError({ code: "timelineEntryService:noRecipient" }), null);
    if (!actions.length) return { ids: [], byAction: [] };

    const setting: Setting = {
      groupId,
      recipientId: recipient.id,
      timeZone: recipient.timeZone || FALLBACK_TIME_ZONE,
      now,
    };
    const plans: Plan[] = [];
    for (const [index, input] of actions.entries()) {
      const planned = await planAction(inTx, tx, setting, input);
      if (isError(planned)) return at(planned, index);
      plans.push(Array.isArray(planned) ? { index, rows: planned } : { index, task: planned });
    }

    const byAction: string[][] = [];
    for (const plan of plans) {
      if ("task" in plan) {
        const task = await taskService.create(inTx, plan.task, { via });
        if (isError(task)) return at(task, plan.index);
        if (!task) return at(rejectError(ctx.authUser), plan.index);
        byAction.push([task.id]);
        continue;
      }
      const ids: string[] = [];
      for (const row of plan.rows) {
        const id = await writeEntry(inTx, row, via);
        if (isError(id)) return at(id, plan.index);
        ids.push(id);
      }
      byAction.push(ids);
    }
    return { ids: byAction.flat(), byAction };
  }, ctx);
