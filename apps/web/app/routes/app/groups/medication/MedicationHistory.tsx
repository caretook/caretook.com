import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { MedicationEntry } from "~/lib/medications/medications.sync";
import type { EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";

import { KindIcon } from "~/components/entry";
import { EmptyState, Section } from "~/components/ui";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { formatDay, formatTime } from "~/lib/core/format";
import { changeText, doseSlotText, doseText } from "~/lib/medications/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { medicationEntriesQuery, toMedicationEntries } from "~/lib/medications/medications.sync";
import { membersQuery, toMember } from "~/lib/timeline/timeline.sync";

/** What an entry says, and the line under it (the slot and note, or the stop note). */
const entryLines = (
  entry: MedicationEntry,
  passes: readonly SchedulePass[],
): { text: string; extra: string | null } => {
  if (entry.kind === "dose") {
    const extra = [doseSlotText(entry.details), entry.details.note?.trim() || null]
      .filter(Boolean)
      .join(" · ");
    return { text: doseText(entry.details), extra: extra || null };
  }
  return { text: changeText(entry.details, passes), extra: entry.details.stopNote?.trim() || null };
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
  passes,
}: {
  groupId: string;
  medicationId: string;
  initialRows: EntryRow[];
  initialMembers: MemberRow[];
  /** The group's passes, deleted ones too: schedule changes name them. */
  passes: readonly SchedulePass[];
}) {
  const query = medicationEntriesQuery(medicationId);
  const rows = useLiveQuery<EntryRow>(query.sql, query.params, initialRows);
  const entries = toMedicationEntries(rows);
  const members = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(members.sql, members.params, initialMembers);
  const nameOf = (id: string) =>
    memberRows.map(toMember).find((m) => m.userId === id)?.name ?? "Former member";

  return (
    <Section title="History" id="history" data-medication-history="">
      {entries.length === 0 ? (
        <EmptyState>No doses or changes yet.</EmptyState>
      ) : (
        <ol className="rounded-box border-base-300 bg-base-100 divide-base-300 divide-y overflow-hidden border">
          {entries.map((entry) => {
            const { text, extra } = entryLines(entry, passes);
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
                  {extra && <p className="text-muted text-sm wrap-break-word">{extra}</p>}
                  <p className="text-muted text-sm">
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
    </Section>
  );
}
