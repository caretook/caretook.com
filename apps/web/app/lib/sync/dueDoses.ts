import type { DueDoses } from "../dueDoses";
import type { SyncDb } from "./index";
import type { MedicationRow, RecipientRow } from "./medications";
import type { EntryRow, LocalQuery } from "./timeline";

import { useMemo } from "react";
import { dueDoses } from "../dueDoses";
import { addDays, dayInZone, startOfDay } from "../zonedDay";
import { useNow } from "./editors";
import { useLiveQuery } from "./index";
import { isDoseEntry, recipientQuery, toMedicationEntries, toMedications } from "./medications";
import { readRows, toLocalTimestamp } from "./timeline";

// What's due today on this device: the group's current medications, its
// doses since yesterday began, and the recipient's zone, read locally (so it
// works offline) and fed to the pure `dueDoses` on a timer, so states move
// from upcoming to due to overdue without a reload. Today (the medications
// page), the Due now strip (the timeline) and the Dose sheet share it.

/** How often states are re-evaluated. */
export const DUE_TICK_MS = 30_000;

/** The group's current medications (not deleted), scheduled or as needed. */
export const dueMedicationsQuery = (groupId: string): LocalQuery => ({
  sql: `SELECT * FROM medication
        WHERE group_id = ? AND deleted_at IS NULL AND status = 'current'
        ORDER BY name COLLATE NOCASE, id`,
  params: [groupId],
});

/** The group's doses (not deleted) from `from` on, oldest first. */
export const dosesSinceQuery = (groupId: string, from: Date): LocalQuery => ({
  sql: `SELECT * FROM timeline_entry
        WHERE group_id = ? AND kind = 'dose' AND deleted_at IS NULL AND occurred_at >= ?
        ORDER BY occurred_at, id`,
  params: [groupId, toLocalTimestamp(from)],
});

/** The moment yesterday began in the recipient's zone: the doses `dueDoses` needs start there. */
export const yesterdayStart = (now: Date, timeZone: string) =>
  startOfDay(addDays(dayInZone(now, timeZone), -1), timeZone);

const FALLBACK_ZONE = "UTC";

export type DueDosesRows = {
  medications: MedicationRow[];
  doses: EntryRow[];
  recipient: RecipientRow[];
};

// Starting rows when there's no loader's: kept apart by identity, so the hook
// can tell rows not read yet from none at all.
const NOT_READ: DueDosesRows = { medications: [], doses: [], recipient: [] };

/** A loader's first read, so a screen renders complete before the live queries take over. */
export async function loadDueDoses(db: SyncDb, groupId: string): Promise<DueDosesRows> {
  const [recipient, medications] = await Promise.all([
    readRows<RecipientRow>(db, recipientQuery(groupId)),
    readRows<MedicationRow>(db, dueMedicationsQuery(groupId)),
  ]);
  const zone = recipient[0]?.time_zone || FALLBACK_ZONE;
  const doses = await readRows<EntryRow>(db, dosesSinceQuery(groupId, yesterdayStart(new Date(), zone)));
  return { medications, doses, recipient };
}

/** The pure part: rows in, `dueDoses` out. */
export const toDueDoses = (rows: DueDosesRows, now: Date): DueDoses =>
  dueDoses({
    medications: toMedications(rows.medications),
    doses: toMedicationEntries(rows.doses).filter(isDoseEntry),
    now,
    timeZone: rows.recipient[0]?.time_zone || FALLBACK_ZONE,
  });

/**
 * Today's slots, yesterday's missed ones and the as-needed counts, live and
 * re-evaluated every `DUE_TICK_MS`. `initial` is a loader's `loadDueDoses`
 * (pass the same object while it's unchanged); left out, `ready` is false
 * until the live queries have answered, so a screen shows nothing rather
 * than every slot as due.
 */
export function useDueDoses(groupId: string, initial: DueDosesRows = NOT_READ) {
  const now = useNow(DUE_TICK_MS);
  const recipientQ = recipientQuery(groupId);
  const recipient = useLiveQuery<RecipientRow>(recipientQ.sql, recipientQ.params, initial.recipient);
  const zone = recipient[0]?.time_zone || FALLBACK_ZONE;
  const medicationsQ = dueMedicationsQuery(groupId);
  const medications = useLiveQuery<MedicationRow>(medicationsQ.sql, medicationsQ.params, initial.medications);
  // Keyed on the day, so the query only changes at midnight.
  const day = dayInZone(new Date(now), zone);
  const from = useMemo(() => startOfDay(addDays(day, -1), zone), [day, zone]);
  const dosesQ = dosesSinceQuery(groupId, from);
  const doses = useLiveQuery<EntryRow>(dosesQ.sql, dosesQ.params, initial.doses);

  const due = useMemo(
    () => toDueDoses({ medications, doses, recipient }, new Date(now)),
    [medications, doses, recipient, now],
  );
  // Without a loader's rows, nothing is known until every query has answered
  // once: before then, every slot would read as unanswered.
  const ready =
    initial !== NOT_READ ||
    (medications !== NOT_READ.medications && doses !== NOT_READ.doses && recipient !== NOT_READ.recipient);
  return { due, ready, timeZone: zone, now };
}
