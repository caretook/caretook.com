import type { DueDoses } from "./dueDoses";
import type { SyncDb } from "../sync/index";
import type { PassRow } from "./medicationPasses.sync";
import type { MedicationRow, RecipientRow } from "./medications.sync";
import type { EntryRow, LocalQuery } from "../timeline/timeline.sync";

import { useMemo } from "react";
import { dueDoses } from "./dueDoses";
import { addDays, dayInZone, startOfDay } from "../core/zonedDay";
import { useNow } from "../live-notes/editors.sync";
import { useRememberedQuery } from "../sync/useRememberedQuery";
import { passesQuery, toPasses } from "./medicationPasses.sync";
import { isDoseEntry, recipientQuery, toMedicationEntries, toMedications } from "./medications.sync";
import { readRows, toLocalTimestamp } from "../timeline/timeline.sync";

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
  /** The group's passes, deleted ones too (a schedule naming one keeps its time). */
  passes: PassRow[];
  doses: EntryRow[];
  recipient: RecipientRow[];
};

/** The group's passes as due doses and schedule wording need them: deleted ones too. */
export const duePassesQuery = (groupId: string) => passesQuery(groupId, { includeDeleted: true });

const NO_ROWS: never[] = [];

/** A loader's first read, so a screen renders complete before the live queries take over. */
export async function loadDueDoses(db: SyncDb, groupId: string): Promise<DueDosesRows> {
  const [recipient, medications, passes] = await Promise.all([
    readRows<RecipientRow>(db, recipientQuery(groupId)),
    readRows<MedicationRow>(db, dueMedicationsQuery(groupId)),
    readRows<PassRow>(db, duePassesQuery(groupId)),
  ]);
  const zone = recipient[0]?.time_zone || FALLBACK_ZONE;
  const doses = await readRows<EntryRow>(db, dosesSinceQuery(groupId, yesterdayStart(new Date(), zone)));
  return { medications, passes, doses, recipient };
}

/** The pure part: rows in, `dueDoses` out. */
export const toDueDoses = (rows: DueDosesRows, now: Date): DueDoses =>
  dueDoses({
    medications: toMedications(rows.medications),
    passes: toPasses(rows.passes),
    doses: toMedicationEntries(rows.doses).filter(isDoseEntry),
    now,
    timeZone: rows.recipient[0]?.time_zone || FALLBACK_ZONE,
  });

/**
 * Today's slots, yesterday's missed ones and the as-needed counts, live and
 * re-evaluated every `DUE_TICK_MS`. `initial` is a loader's `loadDueDoses`
 * (pass the same object while it's unchanged). Left out, the queries read
 * through the tile cache (`useRememberedQuery`): `ready` is true once every
 * query has an answer, remembered from earlier this session or live, and
 * `fresh` once every one has answered live. Before `ready` a screen shows a
 * skeleton rather than every slot as due; while not `fresh` it shows the
 * remembered answer dimmed, and offers no action on it.
 */
export function useDueDoses(groupId: string, initial?: DueDosesRows) {
  const now = useNow(DUE_TICK_MS);
  const recipientQ = recipientQuery(groupId);
  const recipient = useRememberedQuery<RecipientRow>(
    { groupId, name: "dueDoses:recipient" },
    recipientQ,
    initial?.recipient,
  );
  const zone = recipient.value?.[0]?.time_zone || FALLBACK_ZONE;
  const medications = useRememberedQuery<MedicationRow>(
    { groupId, name: "dueDoses:medications" },
    dueMedicationsQuery(groupId),
    initial?.medications,
  );
  const passRows = useRememberedQuery<PassRow>(
    { groupId, name: "dueDoses:passes" },
    duePassesQuery(groupId),
    initial?.passes,
  );
  const passValue = passRows.value ?? NO_ROWS;
  const passes = useMemo(() => toPasses(passValue), [passValue]);
  // Keyed on the day, so the query only changes at midnight.
  const day = dayInZone(new Date(now), zone);
  const from = useMemo(() => startOfDay(addDays(day, -1), zone), [day, zone]);
  const doses = useRememberedQuery<EntryRow>(
    { groupId, name: "dueDoses:doses" },
    dosesSinceQuery(groupId, from),
    initial?.doses,
  );

  const rows = [recipient, medications, passRows, doses];
  const medicationValue = medications.value ?? NO_ROWS;
  const doseValue = doses.value ?? NO_ROWS;
  const recipientValue = recipient.value ?? NO_ROWS;
  const due = useMemo(
    () =>
      toDueDoses(
        { medications: medicationValue, passes: passValue, doses: doseValue, recipient: recipientValue },
        new Date(now),
      ),
    [medicationValue, passValue, doseValue, recipientValue, now],
  );
  // Nothing is known until every query has an answer: before then, every
  // slot would read as unanswered.
  const ready = rows.every((r) => r.value !== undefined);
  const fresh = rows.every((r) => r.fresh);
  return { due, ready, fresh, timeZone: zone, now, passes };
}
