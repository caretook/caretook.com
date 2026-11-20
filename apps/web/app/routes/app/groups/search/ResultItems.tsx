import type { SchedulePass } from "~/lib/medications/medicationDisplay";
import type { EntryResult, ProviderResult } from "./loadSearch";
import type { ParsedSearch, Snippet, UnitChoices } from "@caretook/data/schema";
import type { LocalMedication } from "~/lib/medications/medications.sync";
import type { LocalTask } from "~/lib/tasks/tasks.sync";

import { highlightRanges, notesSnippet } from "@caretook/data/schema";
import { CircleCheck, ListTodo, Pill } from "lucide-react";
import { Link } from "react-router";
import { EntryBody, KindIcon } from "~/components/entry";
import { ProviderTypeIcon } from "~/components/providers";
import { Highlight } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { entryOpen, SHEET_LINK_STATE } from "~/lib/timeline/entryOpen";
import { dayLabel, formatTime, localTimeZone } from "~/lib/core/format";
import { medicationSummaryLine, medicationTitle, STATUS_LABELS } from "~/lib/medications/medicationDisplay";
import { PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { dueText } from "~/lib/tasks/taskDisplay";

/** A link stretched over its row, so a tap anywhere opens the result (the row is `relative isolate`). */
const STRETCHED =
  "outline-none before:absolute before:inset-0 before:rounded-[inherit] focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 focus-visible:before:outline-primary";

const ROW = "relative isolate flex items-start gap-3 px-3 py-2.5";

/** `text` with the search's matches marked. */
const Marked = ({ text, search }: { text: string; search: ParsedSearch }) => (
  <Highlight text={text} ranges={highlightRanges(text, search)} />
);

/** A line from the notes, around the match that's only there. */
function NotesSnippet({ snippet }: { snippet: Snippet | null }) {
  if (!snippet) return null;
  return (
    <p className="text-base-content/80 text-sm break-words" data-snippet>
      <span className="sr-only">From the notes: </span>
      <Highlight text={snippet.text} ranges={snippet.ranges} />
    </p>
  );
}

/**
 * A timeline entry as a result: its kind, what it says (as on the timeline),
 * when and who. It opens as the timeline would: a note or event's page for
 * everyone, a symptom's, vital's or dose's edit sheet for writers (closing it
 * comes back here), and nothing for a viewer's symptom.
 */
export function EntryResultItem({
  entry,
  groupId,
  canWrite,
  units,
  now,
  search,
}: {
  entry: EntryResult;
  groupId: string;
  canWrite: boolean;
  units: UnitChoices;
  now: Date;
  search: ParsedSearch;
}) {
  const open = entryOpen({ groupId, entry, canWrite, search: "" });
  const day = dayLabel(entry.occurredAt, localTimeZone(), now);
  const time = entry.allDay ? "all day" : formatTime(entry.occurredAt);
  const name = entry.title || KIND_META[entry.kind].label.toLowerCase();
  return (
    <li
      className={`${ROW} ${open ? "hover:bg-base-200/50" : ""}`}
      data-result="entry"
      data-result-id={entry.id}
      data-opens={open ? (open.sheet ? "sheet" : "page") : "none"}
    >
      {open && (
        <Link
          to={open.to}
          state={open.sheet ? SHEET_LINK_STATE : undefined}
          aria-label={`${open.sheet ? "Edit" : "Open"} ${name}, ${day} at ${time}`}
          className={`absolute inset-0 rounded-[inherit] ${STRETCHED}`}
        />
      )}
      <KindIcon kind={entry.kind} size="sm" />
      <EntryBody
        entry={entry}
        units={units}
        clamp
        providers={entry.providers}
        search={search}
        footer={
          <p className="text-base-content/60 mt-0.5 text-xs">
            <time dateTime={entry.occurredAt}>
              {day}, {time}
            </time>{" "}
            · {entry.authorName}
          </p>
        }
      />
    </li>
  );
}

/**
 * A provider as a result: name, type, specialty and practice; a past
 * provider is marked. Matches are marked, and a match only in its notes
 * shows a line from them.
 */
export function ProviderResultItem({
  provider,
  notes,
  search,
}: {
  provider: ProviderResult;
  notes?: string;
  search: ParsedSearch;
}) {
  const past = provider.status === "past";
  const details = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, provider.practiceName].filter(
    Boolean,
  );
  const line = details.join(" · ");
  const snippet = notesSnippet([provider.name, line], notes, search);
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="provider"
      data-result-id={provider.id}
      data-past={past ? "" : undefined}
    >
      <ProviderTypeIcon type={provider.type} past={past} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Link
            to={appUrls.provider(provider.groupId, provider.id)}
            className={`truncate font-medium ${STRETCHED} ${past ? "text-base-content/70" : ""}`}
          >
            <Marked text={provider.name} search={search} />
          </Link>
          {past && (
            <span className="badge badge-ghost badge-sm shrink-0" data-marker>
              Past
            </span>
          )}
        </p>
        <p className="text-base-content/70 truncate text-sm">
          <Marked text={line} search={search} />
        </p>
        <NotesSnippet snippet={snippet} />
      </div>
    </li>
  );
}

/**
 * A medication as a result: name and strength, dose and schedule; a stopped
 * one is marked with how. Matches are marked, and a match only in its notes
 * shows a line from them.
 */
export function MedicationResultItem({
  medication,
  passes,
  notes,
  search,
}: {
  medication: LocalMedication;
  /** The group's passes, deleted ones too: the schedule reads by pass name. */
  passes: readonly SchedulePass[];
  notes?: string;
  search: ParsedSearch;
}) {
  const stopped = medication.status !== "current";
  const title = medicationTitle(medication);
  const summary = medicationSummaryLine(medication, passes);
  const snippet = notesSnippet([title, summary], notes, search);
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="medication"
      data-result-id={medication.id}
      data-stopped={stopped ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full ${stopped ? "bg-base-200 text-base-content/60" : "bg-primary/15 text-primary"}`}
      >
        <Pill className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Link
            to={appUrls.medication(medication.groupId, medication.id)}
            className={`font-medium wrap-break-word ${STRETCHED} ${stopped ? "text-base-content/70" : ""}`}
          >
            <Marked text={title} search={search} />
          </Link>
          {stopped && (
            <span className="badge badge-ghost badge-sm shrink-0" data-marker>
              {STATUS_LABELS[medication.status]}
            </span>
          )}
        </p>
        <p className="text-base-content/70 text-sm">
          <Marked text={summary} search={search} />
        </p>
        <NotesSnippet snippet={snippet} />
      </div>
    </li>
  );
}

/**
 * A task as a result: its title and its due line, or a "Done" marker for a
 * done one. It opens the task's page. Matches are marked, and a match only
 * in its notes shows a line from them.
 */
export function TaskResultItem({
  task,
  notes,
  now,
  timeZone,
  search,
}: {
  task: LocalTask;
  notes?: string;
  now: Date;
  /** The recipient's zone: due days and times are theirs. */
  timeZone: string;
  search: ParsedSearch;
}) {
  const done = !!task.doneAt;
  const due = dueText(task, now, timeZone);
  const snippet = notesSnippet([task.title], notes, search);
  const Icon = done ? CircleCheck : ListTodo;
  return (
    <li
      className={`${ROW} hover:bg-base-200/50`}
      data-result="task"
      data-result-id={task.id}
      data-done={done ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? "bg-base-200 text-base-content/60" : "bg-primary/15 text-primary"}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <Link
            to={appUrls.task(task.groupId, task.id)}
            className={`font-medium wrap-break-word ${STRETCHED} ${done ? "text-base-content/70" : ""}`}
          >
            <Marked text={task.title} search={search} />
          </Link>
          {done && (
            <span className="badge badge-ghost badge-sm shrink-0" data-marker>
              Done
            </span>
          )}
        </p>
        {due && <p className="text-base-content/70 text-sm">{due}</p>}
        <NotesSnippet snippet={snippet} />
      </div>
    </li>
  );
}
