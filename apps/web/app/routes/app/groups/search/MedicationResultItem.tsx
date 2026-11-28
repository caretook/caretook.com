import type { NamedTag } from "./loadSearch";
import type { LocalMedication } from "~/lib/medications/medications.sync";
import type { SchedulePass } from "@caretook/data/schema";

import { Pill } from "lucide-react";
import { Badge, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import type { ParsedSearch } from "@caretook/data/domain";
import { notesSnippet } from "@caretook/data/domain";
import { medicationSummaryLine, medicationTitle, STATUS_LABELS } from "@caretook/data/schema";
import { QuickTags } from "~/components/tags";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";
import { STRETCHED, ROW, OpenName, Marked, NotesSnippet } from "./resultParts";

/**
 * A medication as a result: name and strength, dose and schedule; a stopped
 * one is marked with how. Matches are marked, and a match only in its notes
 * shows a line from them. It opens the medication's page (`onOpen`: its sheet).
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
  // Its page's Back comes back to these results.
  const linkState = useMedicationLinkState();
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="medication"
      data-result-id={medication.id}
      data-stopped={stopped ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full ${stopped ? "bg-base-200 text-faint" : "bg-primary/15 text-primary"}`}
      >
        <Pill className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <OpenName
            to={appUrls.medication(medication.groupId, medication.id)}
            state={linkState}
            onOpen={onOpen}
            className={`font-medium wrap-break-word ${STRETCHED} ${stopped ? "text-muted" : ""}`}
          >
            <Marked text={title} search={search} />
          </OpenName>
          {stopped && (
            <Badge tone={STATUS_TONE.past} className="shrink-0" data-marker="">
              {STATUS_LABELS[medication.status]}
            </Badge>
          )}
        </p>
        <p className="text-muted text-sm">
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
      </div>
    </li>
  );
}
