import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as domain from ".";

// The names `@caretook/data/domain` exports, frozen: a name added or lost
// fails here. Update the list in the same change that adds or removes one.
const DOMAIN_EXPORTS = [
  "CALENDAR_ITEM_KINDS",
  "CALENDAR_WINDOW_DAYS",
  "CARING_FOR",
  "CARING_FOR_LABELS",
  "CLAMP_VISIBLE",
  "CONTACT_MESSAGE_MAX",
  "CONTACT_TOPICS",
  "CONTACT_TOPIC_LABELS",
  "DEFAULT_ITEM_MINUTES",
  "DEVICE_FUTURE_SKEW_MS",
  "DUE_AFTER_PARENT_ISSUE",
  "EMAIL_MAX",
  "ENTRY_SETUP_FIELDS",
  "FUTURE_DATE_MESSAGE",
  "FUTURE_KINDS",
  "GOOGLE_WINDOW_AHEAD_DAYS",
  "GROUP_ADMIN_PAGE_SIZE",
  "HEARD_FROM_MAX",
  "HONEYPOT_FIELD",
  "LEGAL_CHECKBOX_PARTS",
  "LEGAL_DOCUMENTS",
  "LEGAL_REQUIRED_MESSAGE",
  "LEGAL_VERSIONS",
  "LOGGED_KINDS",
  "MAX_TODO_DEPTH",
  "MEDICATION_TYPES",
  "MEDICATION_TYPE_BADGES",
  "MEDICATION_TYPE_GROUPS",
  "MEDICATION_TYPE_LABELS",
  "MENTION_NODE",
  "MIN_FORM_MS",
  "MONTH_WEEKS",
  "NAME_MAX",
  "NEW_TAB_PHRASES",
  "NOTE_FRAGMENT",
  "QUICK_ENTRY_PAGES",
  "RECENT_EDITORS_TICK_MS",
  "RECENT_EDITORS_WINDOW_MS",
  "RECIPIENT_FIELDS",
  "RECIPIENT_FIELD_GROUPS",
  "REMINDER_CATCH_UP_MS",
  "REMINDER_CHANNELS",
  "REMINDER_LEADS",
  "REPEAT_FREQS",
  "ROLLUP_METADATA",
  "SEARCH_MAX_LENGTH",
  "SEARCH_MAX_TERMS",
  "SERIES_AHEAD_DAYS",
  "SERIES_LIMITS",
  "SERIES_VISIT_NAMESPACE",
  "SERVER_FUTURE_SKEW_MS",
  "SHARED_FIELDS",
  "SIBLING_ORDER_SQL",
  "SNIPPET_LENGTH",
  "SOURCE_FIELD_MAX",
  "STAFF_SETTABLE_GROUP_ROLES",
  "SYNC_WRITE_LIMIT",
  "TICK_NEXT_METADATA",
  "TODO_COMPLETER_ROLES",
  "TODO_LEADS",
  "TODO_WRITER_ROLES",
  "TYPE_NOT_SET",
  "UNDO_NEXT_METADATA",
  "UTM_PARAMS",
  "WEEKDAYS",
  "addDays",
  "appendNoteSection",
  "assigneeLabel",
  "assigneeOf",
  "buildNoteDoc",
  "calendarItems",
  "calendarText",
  "calendarWhen",
  "calendarWindow",
  "canBeEmergencyContact",
  "canChangeEntry",
  "canCompleteTodo",
  "canEditRecipient",
  "canHaveSubtask",
  "canLogEntry",
  "canManageEmergencyContacts",
  "canReadRecipient",
  "clampDue",
  "comparePeriods",
  "compareSiblings",
  "completedText",
  "completionOnly",
  "currentPeriod",
  "dayBounds",
  "dayHeading",
  "dayInZone",
  "dayLabel",
  "dayStart",
  "depthOf",
  "doneOrder",
  "doneText",
  "dueText",
  "encodeNoteDoc",
  "endOfDay",
  "findTime",
  "foldSearchText",
  "fromBase64",
  "googleWindow",
  "highlightParts",
  "highlightRanges",
  "inheritedDue",
  "isDueAfterParent",
  "isEmptySearch",
  "isFutureKind",
  "isStartOfDay",
  "isTodoCompleter",
  "isTodoWriter",
  "isTooFarAhead",
  "isYjsUpdate",
  "legalCheckboxText",
  "linkLabel",
  "localDate",
  "localTime",
  "medicationTypeBadge",
  "medicationTypeDetail",
  "medicationTypeGroupHeading",
  "medicationTypeLabel",
  "mergeEditors",
  "neighbours",
  "noteDocFromText",
  "noteText",
  "notesSnippet",
  "ordinal",
  "pageContextFor",
  "parseEditTime",
  "parseNoteEditors",
  "parseRule",
  "parseSearch",
  "periodAt",
  "periodDay",
  "periodDayOn",
  "periodLengthDays",
  "periodRange",
  "periodSpans",
  "periodUnderway",
  "planReminders",
  "prefixForms",
  "prependNoteSection",
  "readCommand",
  "readGoTo",
  "readReminderKey",
  "readableRecipientGroups",
  "recentEditors",
  "reminderKey",
  "reminderLeadLabel",
  "reminderSendAt",
  "repeatColumnsFor",
  "repeatPattern",
  "repeatText",
  "resolveTime",
  "rollupOf",
  "ruleText",
  "saysFuture",
  "searchSnippet",
  "seriesVisitFallbackId",
  "seriesVisitId",
  "sharedContact",
  "sharesAnything",
  "shortDay",
  "siblingOrder",
  "snippetIfHidden",
  "sortConditions",
  "spamVerdict",
  "startOfDay",
  "subtaskProgress",
  "timeInZone",
  "toBase64",
  "toFtsMatch",
  "toTsQuery",
  "todoOrder",
  "todoRepeatLine",
  "todoRepeatText",
  "todoState",
  "upcomingListsSubtask",
  "uuidV5",
  "visibleSharedFields",
  "wallTime",
  "weekdayName",
  "wordStem",
  "zonedInstant",
];

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(here, "../db/schema");

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });

/** Each import or re-export in a module: its specifier, and whether it brings only types. */
const importsOf = (source: string) =>
  [
    ...source.matchAll(
      /^(?:import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?"([^"]+)"|import\(\s*"([^"]+)"\s*\)/gm,
    ),
  ].map((m) => ({ spec: (m[2] ?? m[3])!, typeOnly: !!m[1] }));

/** Why a domain module's import breaks the direction rule, or null when it's allowed. */
const refusal = (file: string, spec: string, typeOnly: boolean) => {
  if (/^(drizzle-orm|drizzle-zod|pg)(\/|$)/.test(spec)) return `${spec} is table or server code`;
  if (!spec.startsWith(".")) return null;
  const target = path.resolve(path.dirname(file), spec);
  const inSchema = target === schemaDir || target.startsWith(schemaDir + path.sep);
  return inSchema && !typeOnly ? "a value from the schema folder (import type only)" : null;
};

describe("@caretook/data/domain", () => {
  it("exports exactly the frozen list", () => {
    expect(Object.keys(domain).sort()).toEqual(DOMAIN_EXPORTS);
  });

  it("imports only types from the schema folder, and never drizzle-orm or pg", () => {
    const broken = sources(here).flatMap((file) =>
      importsOf(readFileSync(file, "utf8")).flatMap(({ spec, typeOnly }) => {
        const why = refusal(file, spec, typeOnly);
        return why ? [`${path.relative(here, file)}: "${spec}": ${why}`] : [];
      }),
    );
    expect(broken).toEqual([]);
  });

  it("refuses drizzle-orm, pg and a schema value, and allows a schema type", () => {
    const file = path.join(here, "todos/todoRules.ts");
    const refused = (source: string) =>
      importsOf(source).map(({ spec, typeOnly }) => refusal(file, spec, typeOnly) !== null);
    expect(refused(`import { sql } from "drizzle-orm";`)).toEqual([true]);
    expect(refused(`import { pgTable } from "drizzle-orm/pg-core";`)).toEqual([true]);
    expect(refused(`import { Pool } from "pg";`)).toEqual([true]);
    expect(refused(`import { todoSchema } from "../../db/schema/todos/todo";`)).toEqual([true]);
    expect(refused(`export { todoSchema } from "../../db/schema";`)).toEqual([true]);
    expect(refused(`import "../../db/schema/todos/todo";`)).toEqual([true]);
    expect(refused(`const m = await import("../../db/schema/todos/todo");`)).toEqual([true]);
    expect(refused(`import type { Todo } from "../../db/schema/todos/todo";`)).toEqual([false]);
    expect(refused(`import { localDate } from "../core/entryTiming";`)).toEqual([false]);
    expect(refused(`import * as Y from "yjs";`)).toEqual([false]);
  });
});
