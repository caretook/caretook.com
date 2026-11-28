import type { ReactNode } from "react";
import type { EntryViewProps } from "./TimelineEntryRow";

import { Link } from "react-router";
import { Badge, LINK, STATUS_TONE } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { entryTiming } from "~/lib/appointments/upcoming";
import { cancelledLabel, nowLabel, timeRange, upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { EntryBody } from "./EntryBody";
import { AuthorCircle, AuthorFilterLink, KindFilterLink, KindIcon } from "./KindIcon";
import { RepeatMark } from "./RepeatMark";
import { EntryMenu, RowTags } from "./TimelineEntryRow";

/** Where a card's event is, on one line, and the provider it came from when it isn't its own. */
export type UpcomingPlace = { text: string; from?: string | null };

/** What the Planner adds to an entry's display; its caller (the Planner's list) works these out. */
export type UpcomingCardExtras = {
  /** The list's clock: an item in progress says "Now · until …". */
  now: Date;
  /** Opens visit prep (the ⋯ menu's Prepare; writers, upcoming events). */
  onPrepare?: () => void;
  /** The easy roles' Planner: no ⋯ menu or filter links, tags as chips only. */
  readOnly?: boolean;
  /** Its place, already on one line. */
  place?: UpcomingPlace | null;
  /** A cancelled event's new one ("Rescheduled to Tue, Nov 24"), when it was rescheduled and that's on the device. */
  rescheduledTo?: { id: string; label: string };
  /** The history state its page opens with (the Planner's return, B-690). */
  openState?: unknown;
  /** The footer's left side (the Planner's Call and Directions); the author's avatar ends it. */
  footer?: ReactNode;
};

/**
 * The entry display's Planner look (shared-displays slice 7, was the
 * Planner's `UpcomingRow`): one item as a card. The kind icon (a filter) on
 * the left and the ⋯ menu (`EntryMenu`, Copy link for every role) on the
 * right. Between them its time on one line ("10:30 AM–11:15 AM", "All day",
 * or "Now · until 11:15 AM") with the repeat mark, the entry's body with its
 * "with …" line, its place, its tags (`RowTags`) and "Cancelled" with the
 * rescheduled link. A `footer` (Call and Directions) has the author's avatar
 * (the timeline's: a filter) on its right; with none, the avatar ends the
 * last line, under the menu. The whole card opens the entry's page with
 * `openState`. `readOnly` shows the kind and avatar without their filter
 * links, so a tap on the avatar opens the card.
 */
export function UpcomingEntryCard({
  entry,
  authorName,
  authorImage,
  units,
  providers,
  tags,
  onEdit,
  onDelete,
  cancel,
  onRemind,
  onPrepare,
  now,
  readOnly = false,
  place,
  rescheduledTo,
  openState,
  footer,
}: EntryViewProps & UpcomingCardExtras) {
  const cancelled = cancelledLabel(entry);
  // A cancelled item isn't happening, so it's never "Now".
  const inProgress = !cancelled && entryTiming(entry, now) === "now";
  const when = inProgress ? nowLabel(entry) : timeRange(entry);
  const title = upcomingTitle(entry);
  const hasFooter = Boolean(footer);
  const hasSide = !readOnly || !hasFooter;
  const author = readOnly ? (
    <AuthorCircle userId={entry.createdBy} name={authorName} image={authorImage} label={`By ${authorName}`} />
  ) : (
    <AuthorFilterLink userId={entry.createdBy} name={authorName} image={authorImage} circle />
  );

  return (
    <li
      className={`relative isolate grid gap-x-2.5 gap-y-1 px-3 py-2 ${hasSide ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]"}`}
      data-upcoming-item={entry.id}
      data-cancelled={cancelled ? "" : undefined}
    >
      <Link
        to={appUrls.entry(entry.groupId, entry.id)}
        state={openState}
        className="hover:bg-base-content/5 focus-visible:outline-primary absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:-outline-offset-2 focus-visible:outline-2"
        aria-label={`Open ${title}, ${when}${cancelled ? `, ${cancelled.toLowerCase()}` : ""}`}
      />
      {readOnly ? <KindIcon kind={entry.kind} size="sm" /> : <KindFilterLink kind={entry.kind} size="sm" />}
      <div className="min-w-0">
        <p
          className={`flex items-center gap-1 text-sm whitespace-nowrap tabular-nums ${inProgress ? "text-primary-ink font-semibold" : "text-muted"}`}
          data-when-line
        >
          <time dateTime={entry.occurredAt} data-when>
            {when}
          </time>
          {entry.seriesId && <RepeatMark seriesId={entry.seriesId} />}
        </p>
        <EntryBody
          entry={entry}
          units={units}
          clamp
          providers={providers}
          className={cancelled ? "text-faint line-through" : ""}
        />
        {place && (
          <p className="text-muted text-sm break-words" data-place>
            {place.text}
            {place.from && <span className="text-faint"> · from {place.from}</span>}
          </p>
        )}
        <RowTags entry={entry} tags={tags} readOnly={readOnly} className="mt-0.5" />
        {cancelled && (
          <p className="text-sm" data-cancelled-label>
            <Badge tone={STATUS_TONE.past}>{cancelled}</Badge>
            {rescheduledTo && (
              <>
                {" · "}
                <Link
                  to={appUrls.entry(entry.groupId, rescheduledTo.id)}
                  state={openState}
                  className={`${LINK} relative z-10`}
                  data-rescheduled-to={rescheduledTo.id}
                >
                  {rescheduledTo.label}
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      {hasSide && (
        <div className="flex flex-col items-end gap-1">
          {!readOnly && (
            <EntryMenu
              entry={entry}
              label={`Actions for ${title}`}
              onEdit={onEdit}
              cancel={cancel}
              onPrepare={onPrepare}
              onRemind={onRemind}
              onDelete={onDelete}
            />
          )}
          {!hasFooter && <div className="mt-auto flex">{author}</div>}
        </div>
      )}
      {hasFooter && (
        <div className="col-start-2 col-end-[-1] flex items-center justify-between gap-2" data-row-footer>
          {footer}
          {author}
        </div>
      )}
    </li>
  );
}
