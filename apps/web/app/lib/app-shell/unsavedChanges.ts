// "Changes not saved" (Settings): the records the uploader keeps for changes
// the server refused or set aside (`unsaved_change`, lib/sync/uploader.ts),
// as lines a caretaker can read. A set-aside line (`outcome` `set_aside`) has
// "Try again". Pure: the page's queries are ./unsavedChanges.sync.ts.

/** One `unsaved_change` row, as the device stores it (JSON columns as text). */
export type UnsavedRecord = {
  id: string;
  recordedAt: string;
  tableName: string;
  rowId: string;
  op: string;
  data: string | null;
  code: string;
  issues: string | null;
  outcome: string;
  label: string | null;
  lineKey: string;
};

export type Issue = { path: string; message: string };

/** One line on the page: every record for one row (a note's document and its updates together), newest first. */
export type UnsavedLine = {
  key: string;
  /** The records' ids, to dismiss them together. */
  ids: string[];
  /** How many records the line stands for. */
  count: number;
  /** The newest record's time. */
  recordedAt: string;
  /** The newest record's table (a note's update reads as its note). */
  table: string;
  op: string;
  code: string;
  issues: Issue[];
  outcome: string;
  /** The newest label any of its records has. */
  label: string | null;
};

/** What a table's rows are called. */
const KINDS: Record<string, string> = {
  timeline_entry: "entry",
  note_document: "note",
  note_update: "note",
  provider: "provider",
  timeline_entry_provider: "entry's provider",
  medication: "medication",
  medication_pass: "medication time",
  medication_condition: "medication's condition",
  recipient_allergy: "allergy",
  recipient_condition: "condition",
  condition_manager: "condition's provider",
  care_period: "care period",
  care_recipient: "profile",
  todo: "to-do",
  appointment_series: "repeating event",
  timeline_entry_todo: "entry's to-do",
  tag: "tag",
  record_tag: "record's tag",
};

/** The kind of thing a table holds; an unknown table is a "change". */
export const kindOf = (table: string) => KINDS[table] ?? null;

const parseIssues = (issues: string | null): Issue[] => {
  if (!issues) return [];
  try {
    const parsed: unknown = JSON.parse(issues);
    return Array.isArray(parsed)
      ? parsed.filter(
          (i): i is Issue => typeof i === "object" && i !== null && typeof (i as Issue).message === "string",
        )
      : [];
  } catch {
    return [];
  }
};

/** Why the server said no, for an ordinary cause; null for a code this page doesn't know. */
const reasonFor = (code: string, issues: Issue[]): string | null => {
  if (code === "sync:failed") return "the server couldn't save this";
  if (code === "permissions:unauthorized") return "you can't edit in this group any more";
  if (code === "todoService:completionOnly") return "you can only tick or reopen to-dos assigned to you";
  // Subtasks (todo-subtasks).
  if (code === "todoService:badParent")
    return "the to-do it goes under is gone, repeats, or is already three levels deep";
  if (code === "todoService:openSubtasks") return "it's done once its subtasks are; tick those first";
  if (code === "todoService:repeatWithSubtasks") return "a subtask, or a to-do with subtasks, can't repeat";
  if (code === "sync:readOnlyTable") return "it can't be changed from this device";
  if (code.endsWith(":notFound")) return "it isn't there any more";
  if (code.endsWith(":immutable")) return "it can't move to another group or person";
  if (code.endsWith(":invalid"))
    return issues.length ? `it wasn't valid (${messages(issues)})` : "it wasn't valid";
  return null;
};

const messages = (issues: Issue[]) => issues.map((i) => i.message.replace(/\.$/, "")).join("; ");

/** "the medication “Lisinopril”", or "the medication" without a label. */
const subject = (table: string, label: string | null) =>
  label ? `the ${kindOf(table)} “${label}”` : `the ${kindOf(table)}`;

const lead = (table: string, op: string, label: string | null) => {
  const kind = kindOf(table);
  if (!kind) return "A change";
  if (op === "PUT") return `Your new ${kind}${label ? ` “${label}”` : ""}`;
  if (op === "DELETE") return `Your deletion of ${subject(table, label)}`;
  return `Your change to ${subject(table, label)}`;
};

/**
 * The sentence for a refused change: "Your change to the medication
 * “Lisinopril” wasn't saved: you can't edit in this group any more". A code
 * the page doesn't know names only the kind of thing and shows the server's
 * issue messages, if any.
 */
export const unsavedSentence = (r: {
  table: string;
  op: string;
  code: string;
  issues: Issue[];
  label: string | null;
}): string => {
  const reason = reasonFor(r.code, r.issues);
  const head = `${lead(r.table, r.op, r.label)} wasn't saved`;
  if (reason) return `${head}: ${reason}`;
  return r.issues.length ? `${head}: ${messages(r.issues)}` : `${head}: the server refused it`;
};

/** Whether a line can be sent again: its newest record was set aside (a server fault), not refused. */
export const canTryAgain = (line: Pick<UnsavedLine, "outcome">) => line.outcome === "set_aside";

/** The records as the page's lines, newest first: one line per `lineKey`, with a count. */
export const unsavedLines = (records: readonly UnsavedRecord[]): UnsavedLine[] => {
  const byKey = new Map<string, UnsavedRecord[]>();
  const newestFirst = [...records].sort((a, b) =>
    a.recordedAt === b.recordedAt ? 0 : a.recordedAt < b.recordedAt ? 1 : -1,
  );
  for (const record of newestFirst) {
    const list = byKey.get(record.lineKey);
    if (list) list.push(record);
    else byKey.set(record.lineKey, [record]);
  }
  return [...byKey.entries()].map(([key, list]) => {
    const newest = list[0]!;
    const table = newest.tableName === "note_update" ? "note_document" : newest.tableName;
    return {
      key,
      ids: list.map((r) => r.id),
      count: list.length,
      recordedAt: newest.recordedAt,
      table,
      op: list.length > 1 ? "PATCH" : newest.op,
      code: newest.code,
      issues: parseIssues(newest.issues),
      outcome: newest.outcome,
      label: list.find((r) => r.label)?.label ?? null,
    };
  });
};
