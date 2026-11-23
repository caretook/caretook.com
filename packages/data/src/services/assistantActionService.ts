import type {
  AssistantAction,
  ConditionAction,
  DueDose,
  DueMedication,
  EntryEditAction,
  NoteMention,
  NoteSectionLine,
  TimelineEntryCreateInput,
  TimelineEntryUpdateInput,
  Tx,
} from "../db";
import type { AppError } from "../errors";
import type { ServiceContext } from "./types";

import { z } from "zod";
import { withTransaction } from "../db";
import {
  appendNoteSection,
  assistantActionZSchema,
  conditionActionZSchema,
  canHaveNoteDocument,
  entryEditActionZSchema,
  DEVICE_FUTURE_SKEW_MS,
  doseSlotIdFor,
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
  toBase64,
} from "../db/schema";
import { SYSTEM_USER, isWriterRole } from "../constants";
import { isError, newError } from "../errors";
import {
  careGroupMemberModel,
  careRecipientModel,
  medicationModel,
  medicationPassModel,
  providerModel,
  recipientConditionModel,
  timelineEntryModel,
} from "../models";
import { rejectError } from "../permissions";
import * as entryProviderService from "./entryProviderService";
import * as noteDocumentService from "./noteDocumentService";
import * as recipientConditionService from "./recipientConditionService";
import * as todoService from "./todoService";
import * as timelineEntryService from "./timelineEntryService";

// Carrying out assistant actions on the server (connectors PRD): the twin of
// the device's `runActions` (lib/assistant/quickEntry.sync.ts), for a
// member's own AI assistant through /mcp. The whole batch is checked first
// (the action schemas, no future time on a past-only kind against the
// server's clock, the writer role, live and current medications, live
// providers, a pass's open slots planned with `duePasses`/`givenAllWrites`),
// then written in ONE transaction through the services, which check
// everything again. A refusal anywhere writes nothing and names the action
// (`meta.index`; null when it's the whole batch). Entries and todos are the
// member's own (author, permissions, filters), carrying `via`: the
// assistant's name.
//
// Edits (connectors-2) ride the same batch: `appendToEntry` adds lines at
// the end of a live note's or event's document (one `note_update`, the
// member its author), and `updateEntry` changes its title or time through
// the entry service. Either works on any live note or event in the group, as
// the member can in the app; another group's id reads as not found. Edits
// don't set `via`: it says who created a row.
//
// Conditions (connectors-2) ride it too: `addCondition`, `updateCondition`
// and `resolveCondition` go through `recipientConditionService` (its rules,
// refusals and condition change entries; the change entry carries `via`).
// Another group's condition id reads as not found.

export const serviceName = "assistantAction";

export type RunOptions = {
  /** The assistant the batch came through ("Claude"): stored on every entry and todo. */
  via: string;
  /** The server's clock (tests pin it). */
  now?: Date;
};

export type RunResult = {
  /** Every entry (and todo) written, in order (a pass writes one per medication). */
  ids: string[];
  /** Each action's entries (an `addTodo`'s todo), in the actions' order. */
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
  /** A note's or event's live document: a note's text, with its providers mentioned. */
  document?: { text: string | null; mentions: NoteMention[] };
  providerIds: string[];
};
type EditPlan =
  | { type: "append"; entryId: string; lines: NoteSectionLine[] }
  | { type: "update"; entryId: string; patch: TimelineEntryUpdateInput };
type ConditionPlan =
  | { type: "addCondition"; input: Parameters<typeof recipientConditionService.create>[1] }
  | { type: "updateCondition"; id: string; patch: Parameters<typeof recipientConditionService.update>[2] }
  | { type: "resolveCondition"; id: string };
type TodoPlan = Parameters<typeof todoService.create>[1];
type Plan =
  | { index: number; rows: EntryPlan[] }
  | { index: number; todo: TodoPlan }
  | { index: number; edit: EditPlan }
  | { index: number; condition: ConditionPlan };

const isEditPlan = (plan: TodoPlan | EditPlan | ConditionPlan): plan is EditPlan =>
  "type" in plan && (plan.type === "append" || plan.type === "update");
const isConditionPlan = (plan: TodoPlan | EditPlan | ConditionPlan): plan is ConditionPlan =>
  "type" in plan &&
  (plan.type === "addCondition" || plan.type === "updateCondition" || plan.type === "resolveCondition");

/** What `run` carries out: quick entry's actions, and the edits only the server makes. */
const runnableActionZSchema = z.discriminatedUnion("type", [
  ...assistantActionZSchema.options,
  ...entryEditActionZSchema.options,
  ...conditionActionZSchema.options,
]);

type Setting = {
  groupId: string;
  recipientId: string;
  timeZone: string;
  now: Date;
  /** Slot ids this batch has planned: its rows aren't in Postgres yet. */
  usedDoseIds: Set<string>;
};

/** The content an action writes (a pass's doses and a todo are planned apart). */
const contentOf = (action: Exclude<AssistantAction, { type: "givePass" | "addTodo" }>, timeZone: string) => {
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
  const rows: EntryPlan[] = [];
  for (const { occurredAt, ...details } of writes) {
    const id = await slotDoseId(tx, setting, { ...details, occurredAt }, pass.time);
    if (isError(id)) return id;
    rows.push({
      type: "entry",
      input: { id, groupId, recipientId: setting.recipientId, kind: "dose", occurredAt, timeZone, details },
      providerIds: [],
    });
  }
  return rows;
};

/**
 * The id a planned dose takes: its slot's (`doseSlotIdFor`), unless a row in
 * Postgres has it, live or deleted, or this batch already used it; then a
 * random one, so a dose logged again after an Undo is a new row.
 */
const slotDoseId = async (
  tx: Tx,
  { timeZone, usedDoseIds }: Setting,
  dose: Parameters<typeof doseSlotIdFor>[0],
  passTime: string,
) => {
  const slotId = doseSlotIdFor(dose, { timeZone, passTime });
  if (!slotId || usedDoseIds.has(slotId)) return crypto.randomUUID();
  const taken = await timelineEntryModel.getById(slotId, {
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
  });
  if (isError(taken)) return taken;
  if (taken) return crypto.randomUUID();
  usedDoseIds.add(slotId);
  return slotId;
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

/**
 * An edit's entry: a live note or event in the group, as the member sees
 * it. One in another group (or none) is `entryNotFound`, never saying it
 * exists; a deleted one, or a symptom, vital or dose, is refused by name.
 */
const editableEntry = async (ctx: ServiceContext, tx: Tx, groupId: string, entryId: string) => {
  const entry = await timelineEntryModel.getById(entryId, { ...ctx, tx, includeDeleted: true });
  if (isError(entry)) return entry;
  if (!entry || entry.groupId !== groupId) return newError({ code: "assistantActionService:entryNotFound" });
  if (entry.deletedAt) return newError({ code: "assistantActionService:entryDeleted" });
  if (!canHaveNoteDocument(entry.kind)) return newError({ code: "assistantActionService:notEditable" });
  return entry;
};

/** A live condition in the group (read as the system, so another group's reads the same as none), or why not. */
const editableCondition = async (tx: Tx, groupId: string, id: string) => {
  const condition = await recipientConditionModel.getById(id, {
    authUser: SYSTEM_USER,
    tx,
    includeDeleted: true,
  });
  if (isError(condition)) return condition;
  if (!condition || condition.groupId !== groupId)
    return newError({ code: "assistantActionService:conditionNotFound" });
  if (condition.deletedAt) return newError({ code: "assistantActionService:conditionDeleted" });
  return condition;
};

/** A condition action, checked; or why it's refused. The service checks the content and providers as it writes. */
const planCondition = async (
  tx: Tx,
  setting: Setting,
  action: ConditionAction,
): Promise<ConditionPlan | AppError> => {
  const { groupId, recipientId } = setting;
  if (action.type === "addCondition") {
    const { type: _type, ...content } = action;
    return { type: "addCondition", input: { groupId, recipientId, ...content } };
  }
  const condition = await editableCondition(tx, groupId, action.conditionId);
  if (isError(condition)) return condition;
  if (action.type === "resolveCondition") return { type: "resolveCondition", id: condition.id };
  const { type: _type, conditionId: _id, ...patch } = action;
  return { type: "updateCondition", id: condition.id, patch };
};

/** Carry out a condition action; the condition's id. */
const writeCondition = async (ctx: ServiceContext, plan: ConditionPlan, via: string) => {
  const opts = { via };
  const written =
    plan.type === "addCondition"
      ? await recipientConditionService.create(ctx, plan.input, opts)
      : plan.type === "updateCondition"
        ? await recipientConditionService.update(ctx, plan.id, plan.patch, opts)
        : await recipientConditionService.resolve(ctx, plan.id, opts);
  if (isError(written)) return written;
  return written ? written.id : rejectError(ctx.authUser);
};

/** An edit, checked; or why it's refused. */
const planEdit = async (
  ctx: ServiceContext,
  tx: Tx,
  setting: Setting,
  action: EntryEditAction,
): Promise<EditPlan | AppError> => {
  const entry = await editableEntry(ctx, tx, setting.groupId, action.entryId);
  if (isError(entry)) return entry;
  if (action.type === "appendToEntry")
    return {
      type: "append",
      entryId: entry.id,
      lines: action.lines.map(({ text, style }) => (style === "bullet" ? { text, style } : { text })),
    };

  const patch: TimelineEntryUpdateInput = {};
  if (action.title !== undefined) patch.title = action.title;
  if (action.occurredAt !== undefined) {
    const refused = future(entry.kind, action.occurredAt, setting.now);
    if (refused) return refused;
    const from = new Date(entry.occurredAt).getTime();
    const to = new Date(action.occurredAt).getTime();
    patch.occurredAt = new Date(to).toISOString();
    // An end moves with the start, keeping the length.
    if (entry.endsAt) patch.endsAt = new Date(new Date(entry.endsAt).getTime() + to - from).toISOString();
    // A series visit changed on its own ("Only this visit"), as the app does.
    if (entry.seriesId && to !== from) patch.seriesDetached = true;
  }
  if (patch.title !== undefined && entry.seriesId) patch.seriesDetached = true;
  return { type: "update", entryId: entry.id, patch };
};

/** Carry out an edit; its entry's id. */
const writeEdit = async (ctx: ServiceContext, setting: Setting, plan: EditPlan) => {
  const { groupId, now } = setting;
  if (plan.type === "update") {
    const updated = await timelineEntryService.update(ctx, plan.entryId, plan.patch, { now });
    if (isError(updated)) return updated;
    return updated ? plan.entryId : rejectError(ctx.authUser);
  }
  // A document is made first if the entry has none yet (idempotent).
  const doc = await noteDocumentService.create(ctx, { id: plan.entryId, groupId });
  if (isError(doc)) return doc;
  const ydoc = await noteDocumentService.currentDoc(ctx, plan.entryId);
  if (isError(ydoc)) return ydoc;
  const update = appendNoteSection(ydoc, plan.lines);
  ydoc.destroy();
  const stored = await noteDocumentService.appendUpdate(ctx, {
    id: crypto.randomUUID(),
    groupId,
    documentId: plan.entryId,
    data: toBase64(update),
  });
  if (isError(stored)) return stored;
  // Compacted at once (folding in anyone's pending updates), so reads have the text.
  const compacted = await noteDocumentService.compact(plan.entryId, { tx: ctx.tx });
  if (isError(compacted)) return compacted;
  return plan.entryId;
};

/** One action's rows, checked; or why it's refused. */
const planAction = async (
  ctx: ServiceContext,
  tx: Tx,
  setting: Setting,
  input: unknown,
): Promise<EntryPlan[] | TodoPlan | EditPlan | ConditionPlan | AppError> => {
  const parsed = runnableActionZSchema.safeParse(input);
  if (!parsed.success) return invalid(issuesOf(parsed.error));
  const action = parsed.data;
  const { groupId, recipientId, timeZone } = setting;

  if (action.type === "appendToEntry" || action.type === "updateEntry")
    return planEdit(ctx, tx, setting, action);
  if (
    action.type === "addCondition" ||
    action.type === "updateCondition" ||
    action.type === "resolveCondition"
  )
    return planCondition(tx, setting, action);
  if (action.type === "givePass") return passDoses(ctx, tx, setting, action);
  // Checked by todoService as it writes (the assignee, the links).
  if (action.type === "addTodo") {
    const { type: _type, ...todo } = action;
    return { groupId, recipientId, ...todo };
  }

  const content = timelineEntryContentZSchema.safeParse(contentOf(action, timeZone));
  if (!content.success) return invalid(issuesOf(content.error));
  const refused = future(content.data.kind, content.data.occurredAt, setting.now);
  if (refused) return refused;

  if (action.type === "logDose") {
    const medication = await currentMedication(ctx, tx, groupId, action.medicationId);
    if (isError(medication)) return medication;
  }
  const providerIds =
    action.type === "addEvent" || action.type === "addNote" ? [...new Set(action.providerIds)] : [];
  const mentions: NoteMention[] = [];
  for (const providerId of providerIds) {
    const provider = await providerModel.getById(providerId, { ...ctx, tx });
    if (isError(provider)) return provider;
    if (!provider || provider.groupId !== groupId)
      return newError({ code: "assistantActionService:providerGone" });
    mentions.push({ id: provider.id, label: provider.name });
  }
  return [
    {
      type: "entry",
      input: { groupId, recipientId, ...content.data },
      // A note's or event's text is its live document, written with it.
      // A note mentions its providers in it; both link them.
      ...(action.type === "addNote" && { document: { text: action.text, mentions } }),
      ...(action.type === "addEvent" && { document: { text: null, mentions: [] } }),
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
      const ydoc = noteDocFromText(plan.document.text, plan.document.mentions);
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
 * transaction, each entry and todo carrying `via`. Returns the ids written,
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
    if (!isWriterRole(role)) return at(rejectError(ctx.authUser), null);
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
      usedDoseIds: new Set(),
    };
    const plans: Plan[] = [];
    for (const [index, input] of actions.entries()) {
      const planned = await planAction(inTx, tx, setting, input);
      if (isError(planned)) return at(planned, index);
      plans.push(
        Array.isArray(planned)
          ? { index, rows: planned }
          : isEditPlan(planned)
            ? { index, edit: planned }
            : isConditionPlan(planned)
              ? { index, condition: planned }
              : { index, todo: planned },
      );
    }

    const byAction: string[][] = [];
    for (const plan of plans) {
      if ("edit" in plan) {
        const id = await writeEdit(inTx, setting, plan.edit);
        if (isError(id)) return at(id, plan.index);
        byAction.push([id]);
        continue;
      }
      if ("condition" in plan) {
        const id = await writeCondition(inTx, plan.condition, via);
        if (isError(id)) return at(id, plan.index);
        byAction.push([id]);
        continue;
      }
      if ("todo" in plan) {
        const todo = await todoService.create(inTx, plan.todo, { via });
        if (isError(todo)) return at(todo, plan.index);
        if (!todo) return at(rejectError(ctx.authUser), plan.index);
        byAction.push([todo.id]);
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
