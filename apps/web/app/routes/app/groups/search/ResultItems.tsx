import type { EntryResult, ProviderResult } from "./loadSearch";
import type { UnitChoices } from "@caretook/data/schema";
import type { LocalMedication } from "~/lib/sync/medications";

import { Pill } from "lucide-react";
import { Link } from "react-router";
import { EntryBody, KindIcon } from "~/components/entry";
import { ProviderTypeIcon } from "~/components/providers";
import { appUrls } from "~/lib/appUrls";
import { KIND_META } from "~/lib/entryDisplay";
import { entryOpen, SHEET_LINK_STATE } from "~/lib/entryOpen";
import { dayLabel, formatTime, localTimeZone } from "~/lib/format";
import { medicationSummaryLine, medicationTitle, STATUS_LABELS } from "~/lib/medicationDisplay";
import { PROVIDER_TYPE_META } from "~/lib/providerDirectory";

/** A link stretched over its row, so a tap anywhere opens the result (the row is `relative isolate`). */
const STRETCHED =
  "outline-none before:absolute before:inset-0 before:rounded-[inherit] focus-visible:before:outline-2 focus-visible:before:-outline-offset-2 focus-visible:before:outline-primary";

const ROW = "relative isolate flex items-start gap-3 px-3 py-2.5";

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
}: {
  entry: EntryResult;
  groupId: string;
  canWrite: boolean;
  units: UnitChoices;
  now: Date;
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

/** A provider as a result: name, type, specialty and practice; a past provider is marked. */
export function ProviderResultItem({ provider }: { provider: ProviderResult }) {
  const past = provider.status === "past";
  const details = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, provider.practiceName].filter(
    Boolean,
  );
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
            {provider.name}
          </Link>
          {past && (
            <span className="badge badge-ghost badge-sm shrink-0" data-marker>
              Past
            </span>
          )}
        </p>
        <p className="text-base-content/70 truncate text-sm">{details.join(" · ")}</p>
      </div>
    </li>
  );
}

/** A medication as a result: name and strength, dose and schedule; a stopped one is marked with how. */
export function MedicationResultItem({ medication }: { medication: LocalMedication }) {
  const stopped = medication.status !== "current";
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
            {medicationTitle(medication)}
          </Link>
          {stopped && (
            <span className="badge badge-ghost badge-sm shrink-0" data-marker>
              {STATUS_LABELS[medication.status]}
            </span>
          )}
        </p>
        <p className="text-base-content/70 text-sm">{medicationSummaryLine(medication)}</p>
      </div>
    </li>
  );
}
