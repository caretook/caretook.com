import type { TimelineView } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/core/rpc";

import { useId, useState } from "react";
import { Link } from "react-router";
import { ASIDE_CLASS, AuthorFilterLink, KindFilterLink, MedicationHeading } from "~/components/entry";
import { Chevron, Collapse } from "~/components/ui";
import { formatTime } from "~/lib/core/format";
import { medicationEntryText } from "~/lib/medications/medicationEntries";
import { passLogCounts } from "~/lib/medications/passLogs";
import { SHEET_LINK_STATE } from "./sheet";
import { passLogText } from "@caretook/data/schema";

/**
 * A pass log on the timeline: the doses logged in one round as one row or
 * card ("Morning: 3 given, 1 refused") at its earliest dose's time (beside
 * the text, the author's avatar at the end, as on the entries), with a
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
      className="link-hover text-muted relative z-10 inline-flex cursor-pointer items-center gap-1 text-sm"
      aria-expanded={expanded}
      aria-controls={listId}
      onClick={() => setExpanded((e) => !e)}
      data-pass-log-toggle
    >
      <Chevron open={expanded} />
      {expanded ? "Hide medications" : `Show ${doses.length === 1 ? "medication" : "medications"}`}
    </button>
  );
  const list = (
    <Collapse open={expanded} id={listId} data-pass-log-doses="">
      <ul className="mt-1 space-y-1">
        {doses.map((dose) => {
          const parts = medicationEntryText(dose);
          return (
            <li key={dose.id} data-dose={dose.id}>
              <MedicationHeading entry={dose} what={parts?.what ?? ""} className="text-sm" />
              {parts?.note && <p className="text-muted text-sm break-words">{parts.note}</p>}
            </li>
          );
        })}
      </ul>
    </Collapse>
  );

  return (
    <li
      className={
        cards
          ? "rounded-box border-base-300 bg-base-100 relative isolate flex items-start gap-3 border p-3 shadow-sm"
          : "relative isolate flex items-start gap-2.5 px-3 py-2"
      }
      data-look={cards ? "full" : "condensed"}
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
      <div className={`min-w-0 flex-1 ${cards ? "space-y-0.5" : "pt-0.5"}`}>
        {/* The time beside the first line, as on the entries (`TimelineEntryRow`). */}
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold break-words" data-pass-log-text>
            {text}
          </p>
          <time dateTime={occurredAt} className="text-muted shrink-0 text-sm whitespace-nowrap tabular-nums">
            {time}
          </time>
        </div>
        {toggle}
        {list}
      </div>
      <div className={`${ASIDE_CLASS} w-8`} data-entry-aside>
        <AuthorFilterLink userId={author} name={authorName} image={authorImage} circle />
      </div>
    </li>
  );
}
