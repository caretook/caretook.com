import type { TimelineEntryKind } from "../../db/schema/timeline/timelineEntry";

import { isLoggerRole, isOwnRowLogger, isWriterRole } from "../../constants/roles";

// Who may log and change timeline entries (easy roles PRD). Pure and
// client-safe: the device's local writes and the screens ask these, and
// timelineEntryService applies the same rules (the permission map's
// `groupOwn` enforces "their own entries" in SQL).

/** What an Easy helper logs by hand: notes, events, symptoms, vitals and doses (Given all too). */
export const LOGGED_KINDS = [
  "note",
  "event",
  "symptom",
  "vital",
  "dose",
] as const satisfies readonly TimelineEntryKind[];

/** Appointment fields only writers set: a series, a reschedule and a cancellation. */
export const ENTRY_SETUP_FIELDS = [
  "seriesId",
  "seriesDay",
  "rescheduledTo",
  "cancelledAt",
  "cancelReason",
] as const;

type SetupFields = Partial<Record<(typeof ENTRY_SETUP_FIELDS)[number], unknown>>;

/**
 * Whether `role` may write an entry of `kind` with these fields: writers
 * any; an Easy helper only the logged kinds, with no appointment setup.
 * On an update, pass the entry as it is (`existing`): an Easy helper may
 * not change a setup field from its value either, so clearing a writer's
 * cancellation or reschedule is refused too. A field left out is unchanged.
 */
export const canLogEntry = (
  role: string | null | undefined,
  kind: string,
  fields: SetupFields = {},
  existing?: SetupFields,
) => {
  if (isWriterRole(role)) return true;
  if (!isLoggerRole(role)) return false;
  return (
    (LOGGED_KINDS as readonly string[]).includes(kind) &&
    ENTRY_SETUP_FIELDS.every(
      (field) =>
        fields[field] == null && (fields[field] === undefined || !existing || existing[field] == null),
    )
  );
};

/**
 * Whether someone may edit or delete this entry: writers any; an Easy
 * helper only one they created. Nobody else.
 */
export const canChangeEntry = ({
  role,
  userId,
  entry,
}: {
  role: string | null | undefined;
  userId: string | null | undefined;
  entry: { createdBy: string | null };
}) => {
  if (isWriterRole(role)) return true;
  return isOwnRowLogger(role) && !!userId && entry.createdBy === userId;
};
