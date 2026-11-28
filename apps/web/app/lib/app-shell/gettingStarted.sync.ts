import type { SetupFacts } from "./gettingStarted";
import type { GroupSetupFacts } from "./groupSetup";
import type { SyncDb } from "../sync";

import { SYSTEM_WRITTEN_KINDS } from "@caretook/data/schema";
import { useMemo } from "react";
import { useLiveQuery } from "../sync";
import { fromLocalTimestamp } from "../timeline/timeline.sync";

// The setup card's and the setup pages' facts, from the device's synced
// copy, so their steps tick themselves off offline and when another member
// does the work: live for screens (`useSetupFacts`), once for loaders
// (`readSetupFacts`).

type FactsRow = {
  joined_at: string | null;
  allergy_or_condition: number;
  medication: number;
  entry: number;
  others: number;
  connectors_enabled: number | null;
  provider: number;
  care_period: number;
  earliest_member_id: string | null;
};

/** The system-written kinds' parameters, after the group and user (?1, ?2). */
const KIND_MARKS = SYSTEM_WRITTEN_KINDS.map((_, i) => `?${i + 3}`).join(", ");

const FACTS_SQL = `
  SELECT
    (SELECT created_at FROM care_group_member WHERE group_id = ?1 AND user_id = ?2) AS joined_at,
    (
      EXISTS (SELECT 1 FROM recipient_allergy WHERE group_id = ?1 AND deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM recipient_condition WHERE group_id = ?1 AND deleted_at IS NULL)
      OR EXISTS (
        SELECT 1 FROM care_recipient WHERE group_id = ?1
        AND (no_known_allergies_at IS NOT NULL OR no_known_conditions_at IS NOT NULL)
      )
    ) AS allergy_or_condition,
    EXISTS (SELECT 1 FROM medication WHERE group_id = ?1 AND deleted_at IS NULL) AS medication,
    EXISTS (
      SELECT 1 FROM timeline_entry
      WHERE group_id = ?1 AND deleted_at IS NULL AND kind NOT IN (${KIND_MARKS})
    ) AS entry,
    EXISTS (SELECT 1 FROM care_group_member WHERE group_id = ?1 AND user_id != ?2) AS others,
    (SELECT connectors_enabled FROM care_group WHERE id = ?1) AS connectors_enabled,
    EXISTS (SELECT 1 FROM provider WHERE group_id = ?1 AND deleted_at IS NULL) AS provider,
    EXISTS (SELECT 1 FROM care_period WHERE group_id = ?1 AND deleted_at IS NULL) AS care_period,
    (
      SELECT user_id FROM care_group_member WHERE group_id = ?1
      ORDER BY created_at, id LIMIT 1
    ) AS earliest_member_id`;

export type SetupFactsResult = {
  joinedAt: string | null;
  /** The Timeline's setup card's. */
  facts: SetupFacts;
  /** The setup pages' (`groupSetup.ts`). */
  setup: GroupSetupFacts;
};

const toResult = (row: FactsRow): SetupFactsResult => ({
  joinedAt: row.joined_at ? fromLocalTimestamp(row.joined_at) : null,
  facts: {
    hasProfileBasics: !!row.allergy_or_condition,
    hasMedication: !!row.medication,
    hasEntry: !!row.entry,
    hasOtherMembers: !!row.others,
    connectorsEnabled: !!row.connectors_enabled,
  },
  setup: {
    hasProvider: !!row.provider,
    hasProfileBasics: !!row.allergy_or_condition,
    hasMedication: !!row.medication,
    hasCarePeriod: !!row.care_period,
    earliestMemberId: row.earliest_member_id,
  },
});

const factsParams = (groupId: string, userId: string) => [groupId, userId, ...SYSTEM_WRITTEN_KINDS];

/** Until the query reports. Stable (useLiveQuery compares it). */
const UNKNOWN: FactsRow[] = [];

/** When you joined and what the group has set up; null until the device has answered. */
export const useSetupFacts = (groupId: string, userId: string): SetupFactsResult | null => {
  const params = useMemo(() => factsParams(groupId, userId), [groupId, userId]);
  const [row] = useLiveQuery<FactsRow>(FACTS_SQL, params, UNKNOWN);
  return useMemo(() => (row ? toResult(row) : null), [row]);
};

/** The same, read once (a loader's). */
export const readSetupFacts = async (
  db: SyncDb,
  groupId: string,
  userId: string,
): Promise<SetupFactsResult> => {
  const [row] = await db.powersync.getAll<FactsRow>(FACTS_SQL, factsParams(groupId, userId));
  if (!row) throw new Error("The setup facts query returned no row");
  return toResult(row);
};
