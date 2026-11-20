import type { TimelineView } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/core/rpc";

import { useId, useState } from "react";
import { Link } from "react-router";
import { AuthorFilterLink, KindFilterLink, MedicationHeading } from "~/components/entry";
import { initials } from "~/lib/timeline/entryDisplay";
import { formatTime } from "~/lib/core/format";
import { passLogText } from "~/lib/medications/medicationDisplay";
import { medicationEntryText } from "~/lib/medications/medicationEntries";
import { passLogCounts } from "~/lib/medications/passLogs";
import { SHEET_LINK_STATE } from "./sheet";

/**
 * A pass log on the timeline: the doses logged in one round as one row or
 * card ("Morning: 3 given, 1 refused") at its earliest dose's time, with a
 * toggle that lists each medication and what happened. Writers' taps open
 * the pass sheet (`sheetTo`); viewers get the toggle only.
 */
export function PassLogItem({
  view,
  passLogId,
  passName,
  doses,
  occurredAt,
  authorName,
  authorImage,
  sheetTo,
}: {
  view: TimelineView;
  passLogId: string;
  passName: string | null;
  /** Its doses, earliest first (`groupPassLogs`), each with its medication. */
  doses: TimelineEntry[];
  occurredAt: string;
  authorName: string;
  authorImage?: string | null;
  /** The pass sheet's URL, for writers. */
  sheetTo?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const text = passLogText(passName, passLogCounts(doses));
  const time = formatTime(occurredAt);
  const author = doses[0]!.createdBy;
  const cards = view === "cards";

  const toggle = (
    <button
      type="button"
      className="link link-hover text-base-content/70 relative z-10 text-sm"
      aria-expanded={expanded}
      aria-controls={listId}
      onClick={() => setExpanded((e) => !e)}
      data-pass-log-toggle
    >
      {expanded ? "Hide medications" : `Show ${doses.length === 1 ? "medication" : "medications"}`}
    </button>
  );
  const list = (
    <ul id={listId} hidden={!expanded} className="mt-1 space-y-1" data-pass-log-doses>
      {doses.map((dose) => {
        const parts = medicationEntryText(dose);
        return (
          <li key={dose.id} data-dose={dose.id}>
            <MedicationHeading entry={dose} what={parts?.what ?? ""} className="text-sm" />
            {parts?.note && <p className="text-base-content/80 text-sm break-words">{parts.note}</p>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <li
      className={
        cards
          ? "rounded-box border-base-300 bg-base-100 relative isolate flex items-start gap-3 border p-3"
          : "relative isolate flex items-start gap-2.5 px-3 py-2"
      }
      data-pass-log={passLogId}
    >
      {sheetTo && (
        <Link
          to={sheetTo}
          state={SHEET_LINK_STATE}
          preventScrollReset
          className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
          aria-label={`Edit ${passName?.trim() || "medications"} log at ${time}`}
        />
      )}
      <KindFilterLink kind="dose" size={cards ? "md" : "sm"} />
      {!cards && (
        <time
          dateTime={occurredAt}
          className="text-base-content/70 w-[4.1rem] shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums"
        >
          {time}
        </time>
      )}
      <div className={`min-w-0 flex-1 ${cards ? "space-y-0.5" : "pt-0.5"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold break-words" data-pass-log-text>
            {text}
          </p>
          {cards && (
            <time dateTime={occurredAt} className="text-base-content/70 text-sm tabular-nums">
              {time}
            </time>
          )}
        </div>
        {toggle}
        {list}
        {cards && (
          <p className="text-base-content/60 text-xs">
            <AuthorFilterLink userId={author} name={authorName} />
          </p>
        )}
      </div>
      {!cards && (
        <AuthorFilterLink
          userId={author}
          name={authorName}
          initials={initials(authorName)}
          image={authorImage}
        />
      )}
    </li>
  );
}
