import type {
  ConditionChangeDetails,
  DoseDetails,
  MedicationChangeEntryDetails,
  SchedulePass,
  TimelineEntryModel,
} from "@caretook/data";
import type { ToolContext } from "../registry";

import {
  changeText,
  conditionChangeText,
  doseText,
  isError,
  medicationPassService,
  medicationService,
  medicationTitle,
  passMovedText,
  TIMELINE_ENTRY_KINDS,
  timelineEntryService,
} from "@caretook/data";
import { z } from "zod";
import { defineTool, READ_ANNOTATIONS } from "../registry";
import { zonedIso, zonedIsoOrNull } from "../time";
import { asMember, loadGroup, loadMembers } from "./shared";

/** At most this many entries a page. */
export const TIMELINE_PAGE_MAX = 50;
/** With no `from` (and no cursor), entries from this many days back. */
export const TIMELINE_DEFAULT_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const instant = z.iso.datetime({ offset: true });

const input = z.object({
  from: instant
    .optional()
    .describe(
      `Earliest time to include (ISO 8601 with an offset). Default: ${TIMELINE_DEFAULT_DAYS} days ago.`,
    ),
  to: instant
    .optional()
    .describe("Include entries before this time (ISO 8601 with an offset). Default: no limit."),
  kinds: z
    .array(z.enum(TIMELINE_ENTRY_KINDS))
    .optional()
    .describe("Only these kinds of entry. Default: every kind."),
  authorId: z
    .uuid()
    .optional()
    .describe("Only entries written by this member (an id from the entries' `author`)."),
  cursor: z
    .string()
    .max(512)
    .optional()
    .describe("`nextCursor` from the previous page, for the next one (with the same filters)."),
  limit: z
    .int()
    .min(1)
    .max(TIMELINE_PAGE_MAX)
    .optional()
    .describe(`How many entries, newest first (at most ${TIMELINE_PAGE_MAX}; the default).`),
});

type Author = { id: string; name: string | null };

/** One entry as the assistant sees it: what happened, when, who wrote it, and a note's or event's text. */
const toEntry = (entry: TimelineEntryModel, timeZone: string, authors: Map<string, Author>) => ({
  id: entry.id,
  kind: entry.kind,
  occurredAt: zonedIso(entry.occurredAt, timeZone),
  allDay: entry.allDay,
  endsAt: zonedIsoOrNull(entry.endsAt, timeZone),
  title: entry.title,
  text: entry.body,
  details: entry.details,
  place: entry.place,
  cancelled: entry.cancelledAt
    ? { at: zonedIso(entry.cancelledAt, timeZone), reason: entry.cancelReason }
    : null,
  author: authors.get(entry.createdBy) ?? { id: entry.createdBy, name: null },
  via: entry.via,
});

type Passes = readonly SchedulePass[];

/**
 * What a medication change says, in the medications area's own words: what
 * changed with before → after values, a stop's reason and note, a pass's
 * move. Null for an entry whose details aren't one.
 */
const changeLine = (
  details: MedicationChangeEntryDetails,
  medications: Map<string, string>,
  passes: Passes,
) => {
  if (details.change === "passMoved") return passMovedText(details);
  const name = medications.get(details.medicationId) ?? details.after?.name ?? details.before?.name;
  const what = changeText(details, passes);
  const note =
    details.change === "stopped" && details.stopNote?.trim() ? `; note: ${details.stopNote.trim()}` : "";
  return `${name ? `${name}: ` : ""}${what}${note}`;
};

/** A condition change in full: the heading and each before → after line ("Changed Asthma: Since: 2015 → 2014; Note: none → Inhaler"). */
const conditionLine = (details: ConditionChangeDetails) => {
  const { heading, lines } = conditionChangeText(details);
  return lines.length ? `${heading}: ${lines.join("; ")}` : heading;
};

/** A dose's line: the medication, what was logged ("Given 1 tablet") and the dose note, whole. */
const doseLine = (details: DoseDetails, medications: Map<string, string>) => {
  const name = medications.get(details.medicationId);
  const note = details.note?.trim() ? `; note: ${details.note.trim()}` : "";
  return `${name ? `${name}: ` : ""}${doseText(details)}${note}`;
};

const line = (entry: ReturnType<typeof toEntry>, medications: Map<string, string>, passes: Passes) => {
  const change =
    entry.kind === "medicationChange" && entry.details
      ? changeLine(entry.details as MedicationChangeEntryDetails, medications, passes)
      : null;
  const condition =
    entry.kind === "conditionChange" && entry.details
      ? conditionLine(entry.details as ConditionChangeDetails)
      : null;
  const dose =
    entry.kind === "dose" && entry.details ? doseLine(entry.details as DoseDetails, medications) : null;
  const what = [entry.title, change ?? dose ?? condition, entry.text].filter(Boolean).join(": ");
  const by = entry.author.name ? ` (${entry.author.name})` : "";
  return `- ${entry.occurredAt} ${entry.kind}${what ? ` ${what}` : ""}${by}`;
};

const authorsOf = async (ctx: ToolContext) => {
  const members = await loadMembers(ctx);
  if (isError(members)) return members;
  return new Map(members.map((m) => [m.id, { id: m.id, name: m.name }]));
};

/**
 * The group's timeline, newest first, paged (at most 50): notes, events,
 * symptoms, vitals, doses, medication changes and condition changes, with notes' and events'
 * text. Defaults to the last 90 days.
 */
export const listTimeline = defineTool({
  name: "list_timeline",
  title: "List timeline entries",
  description: `The care group's timeline, newest first: notes, events (appointments), symptoms, vitals, doses, medication changes and condition changes, with notes' and events' text and who wrote each. Filter by time range, kinds or author. At most ${TIMELINE_PAGE_MAX} a page; pass nextCursor back for more. Without from, the last ${TIMELINE_DEFAULT_DAYS} days.`,
  scope: "read",
  input,
  annotations: READ_ANNOTATIONS,
  handler: async (args, ctx) => {
    const loaded = await loadGroup(ctx);
    if (isError(loaded)) return loaded;
    const authors = await authorsOf(ctx);
    if (isError(authors)) return authors;

    // The default window holds across pages: pass the same filters with the cursor.
    const from = args.from ?? new Date(ctx.now.getTime() - TIMELINE_DEFAULT_DAYS * DAY_MS).toISOString();
    const page = await timelineEntryService.list(asMember(ctx), {
      groupId: ctx.groupId,
      kinds: args.kinds,
      from,
      to: args.to,
      authorId: args.authorId,
      cursor: args.cursor ?? null,
      limit: args.limit ?? TIMELINE_PAGE_MAX,
    });
    if (isError(page)) return page;

    const entries = page.data.map((entry) => toEntry(entry, loaded.timeZone, authors));
    // Only medication changes and doses need the medications and passes (deleted ones too, for their names).
    const medications = new Map<string, string>();
    let passes: Passes = [];
    if (entries.some((e) => e.kind === "medicationChange" || e.kind === "dose")) {
      const meds = await medicationService.list(asMember(ctx), {
        groupId: ctx.groupId,
        includeDeleted: true,
      });
      if (isError(meds)) return meds;
      for (const m of meds.data) medications.set(m.id, medicationTitle(m));
      const found = await medicationPassService.list(asMember(ctx), {
        groupId: ctx.groupId,
        includeDeleted: true,
      });
      if (isError(found)) return found;
      passes = found.data;
    }
    const text = entries.length
      ? [
          `${entries.length} entr${entries.length === 1 ? "y" : "ies"}, newest first (${loaded.timeZone}):`,
          ...entries.map((e) => line(e, medications, passes)),
          ...(page.nextCursor ? ["More: call again with nextCursor."] : []),
        ].join("\n")
      : "No entries in that range.";
    return { text, structured: { timeZone: loaded.timeZone, entries, nextCursor: page.nextCursor } };
  },
});
