import type { NamedTag } from "./loadSearch";
import type { LocalMedication } from "~/lib/medications/medications.sync";
import type { SchedulePass } from "@caretook/data/schema";

import { MedicationCard } from "~/components/medications";
import { Badge, STATUS_TONE } from "~/components/ui";
import type { ParsedSearch } from "@caretook/data/domain";
import { notesSnippet } from "@caretook/data/domain";
import { medicationSummaryLine, medicationTitle, STATUS_LABELS } from "@caretook/data/schema";
import { QuickTags } from "~/components/tags";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";
import { Marked, NotesSnippet } from "./resultParts";

/**
 * A medication as a result, as its `MedicationCard`: name and strength
 * (matches marked), dose and schedule; a stopped one is muted and marked
 * with how. A match only in its notes shows a line from them. It opens the
 * medication's page (`onOpen`: its read-only sheet, the easy roles).
 */
export function MedicationResultItem({
  medication,
  passes,
  notes,
  search,
  onOpen,
  tags,
  tagsReadOnly,
}: {
  medication: LocalMedication;
  /** Its tags, live (`SearchResults`' one query per kind), the ones the text names first. */
  tags: readonly NamedTag[];
  /** Chips only, whoever's looking (the easy roles, as on the Planner). */
  tagsReadOnly: boolean;
  /** The group's passes, deleted ones too: the schedule reads by pass name. */
  passes: readonly SchedulePass[];
  notes?: string;
  search: ParsedSearch;
  /** Opens its read-only sheet instead of its page (the easy roles). */
  onOpen?: () => void;
}) {
  const stopped = medication.status !== "current";
  const title = medicationTitle(medication);
  const summary = medicationSummaryLine(medication, passes);
  const snippet = notesSnippet([title, summary], notes, search);
  return (
    <MedicationCard
      medication={medication}
      groupId={medication.groupId}
      stopped={stopped}
      title={<Marked text={title} search={search} />}
      open={onOpen}
      badge={
        stopped && (
          <Badge tone={STATUS_TONE.past} className="shrink-0" data-marker="">
            {STATUS_LABELS[medication.status]}
          </Badge>
        )
      }
      data-result="medication"
      data-result-id={medication.id}
      data-medication-id={medication.id}
      data-stopped={stopped ? "" : undefined}
    >
      <p className="text-muted text-sm" data-medication-summary>
        <Marked text={summary} search={search} />
      </p>
      <NotesSnippet snippet={snippet} />
      <QuickTags
        target="medication"
        recordId={medication.id}
        label={title}
        createdBy={medication.createdBy}
        max={ROW_CHIPS}
        tags={tags}
        readOnly={tagsReadOnly}
        className="mt-1"
      />
    </MedicationCard>
  );
}
