import type { MedicationEntry } from "~/lib/sync/medications";
import type { EntryRow, MemberRow } from "~/lib/sync/timeline";

import { KindIcon } from "~/components/entry";
import { KIND_META } from "~/lib/entryDisplay";
import { formatDay, formatTime } from "~/lib/format";
import { changeText, doseSlotText, doseText } from "~/lib/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { medicationEntriesQuery, toMedicationEntries } from "~/lib/sync/medications";
import { membersQuery, toMember } from "~/lib/sync/timeline";

/** What an entry says, and the line under it (the slot and note, or the stop note). */
const entryLines = (entry: MedicationEntry): { text: string; extra: string | null } => {
  if (entry.kind === "dose") {
    const extra = [doseSlotText(entry.details), entry.details.note?.trim() || null]
      .filter(Boolean)
      .join(" · ");
    return { text: doseText(entry.details), extra: extra || null };
  }
  return { text: changeText(entry.details), extra: entry.details.stopNote?.trim() || null };
};

/**
 * The medication's history: its doses and changes, newest first, with who
 * logged each and when. Live: a dose logged on another device shows at once.
 */
export function MedicationHistory({
  groupId,
  medicationId,
  initialRows,
  initialMembers,
}: {
  groupId: string;
  medicationId: string;
  initialRows: EntryRow[];
  initialMembers: MemberRow[];
}) {
  const query = medicationEntriesQuery(medicationId);
  const rows = useLiveQuery<EntryRow>(query.sql, query.params, initialRows);
  const entries = toMedicationEntries(rows);
  const members = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(members.sql, members.params, initialMembers);
  const nameOf = (id: string) =>
    memberRows.map(toMember).find((m) => m.userId === id)?.name ?? "Former member";

  return (
    <section aria-labelledby="medication-history-heading" className="space-y-2" data-medication-history>
      <h2 id="medication-history-heading" className="font-semibold">
        History
      </h2>
      {entries.length === 0 ? (
        <p className="text-base-content/70 text-sm">No doses or changes yet.</p>
      ) : (
        <ol className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
          {entries.map((entry) => {
            const { text, extra } = entryLines(entry);
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 px-3 py-2.5"
                data-entry-id={entry.id}
                data-kind={entry.kind}
              >
                <KindIcon kind={entry.kind} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="wrap-break-word">
                    <span className="sr-only">{KIND_META[entry.kind].label}: </span>
                    <span data-entry-text>{text}</span>
                  </p>
                  {extra && <p className="text-base-content/70 text-sm wrap-break-word">{extra}</p>}
                  <p className="text-base-content/70 text-sm">
                    {nameOf(entry.createdBy)} ·{" "}
                    <time dateTime={entry.occurredAt}>
                      {formatDay(entry.occurredAt)}, {formatTime(entry.occurredAt)}
                    </time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
