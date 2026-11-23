import type { EntryOpen } from "~/lib/timeline/entryOpen";
import type { ParsedSearch, UnitChoices } from "@caretook/data/schema";
import type { LinkedProviderName } from "~/lib/providers/entryProviders";
import type { EntryCancelActions } from "~/components/entry";
import type { TimelineEntry } from "~/lib/core/rpc";

import { canHaveNoteDocument } from "@caretook/data/schema";
import {
  AuthorFilterLink,
  EntryActions,
  EntryBody,
  KindFilterLink,
  KindIcon,
  RepeatMark,
} from "~/components/entry";
import { Badge, ViaTag } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { initials } from "~/lib/timeline/entryDisplay";
import { formatTime, formatTimeInZone } from "~/lib/core/format";
import { cancelledLabel } from "~/lib/appointments/upcomingLabels";
import { actionsLabel } from "./entryLabels";
import { EntryOpenTarget } from "./EntryOpenTarget";
import { LiveDot } from "./LiveDot";
import { ASIDE_CLASS } from "./layout";

/** What a row or card shows and does: the same for both. */
export type EntryViewProps = {
  entry: TimelineEntry;
  authorName: string;
  /** The author's picture (the row's tooltip). */
  authorImage?: string | null;
  units: UnitChoices;
  /** Fading out while its delete is saved. */
  removing?: boolean;
  /** What tapping it opens (`entryOpen`). Omitted: nothing. */
  open?: EntryOpen;
  /** The ⋯ menu's Edit, for symptoms and vitals. */
  onEdit?: () => void;
  /** Omitted for people who can't change the timeline (viewers): no Delete (notes and events keep Print). */
  onDelete?: () => void;
  /** An event's Cancel or Undo cancel in the ⋯ menu (writers). */
  cancel?: EntryCancelActions;
  /** Opens "Remind me" for an upcoming note or event (any role). */
  onRemind?: () => void;
  /** Others are writing in its document now: the live dot's label ("Being written now by Maria"). */
  liveLabel?: string;
  /** A note's or event's linked providers: the "with …" line. */
  providers?: LinkedProviderName[];
  /** The timeline's search (`?q=`, parsed): its matches are marked. */
  search?: ParsedSearch;
  /** Easy mode: the kind icon and the author aren't filters (rows only). */
  easy?: boolean;
};

/**
 * One entry as a dense row: kind icon, time, the entry's body (text clamped
 * to two lines, with "More"), then a right-hand column with the ⋯ menu and,
 * under it, the author's initials (a filter).
 */
export function TimelineEntryRow({
  entry,
  authorName,
  authorImage,
  units,
  removing,
  open,
  onEdit,
  onDelete,
  cancel,
  onRemind,
  liveLabel,
  providers,
  search,
  easy,
}: EntryViewProps) {
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  const cancelled = cancelledLabel(entry);
  return (
    <li
      className={`relative isolate flex items-start gap-2.5 px-3 py-2 ${removing ? "opacity-50" : ""}`}
      data-easy={easy ? "" : undefined}
      data-cancelled={cancelled ? "" : undefined}
    >
      {open && <EntryOpenTarget open={open} entry={entry} />}
      {easy ? <KindIcon kind={entry.kind} size="sm" /> : <KindFilterLink kind={entry.kind} size="sm" />}
      <time
        dateTime={entry.occurredAt}
        className="text-muted w-[4.1rem] shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums"
      >
        {entry.allDay ? "All day" : formatTime(entry.occurredAt)}
        {/* A series visit: the mark under its time, so the text column stays aligned. */}
        {entry.seriesId && <RepeatMark seriesId={entry.seriesId} className="flex" />}
      </time>
      <EntryBody
        entry={entry}
        units={units}
        clamp
        providers={providers}
        search={search}
        className={`pt-0.5 ${cancelled ? CANCELLED_TEXT : ""}`}
        footer={
          <>
            {elsewhere && <p className="text-faint text-xs">{elsewhere}</p>}
            {cancelled && <CancelledBadge label={cancelled} />}
            {entry.via && (
              <p className="inline-block">
                <ViaTag via={entry.via} />
              </p>
            )}
          </>
        }
      />
      {liveLabel && <LiveDot label={liveLabel} className="mt-2" />}
      {/* The right column: the ⋯ menu, the author under it, so the text gets the width. */}
      <div className={`${ASIDE_CLASS} w-8`} data-entry-aside>
        {(onDelete || canHaveNoteDocument(entry.kind)) && (
          <EntryActions
            kind={entry.kind}
            label={actionsLabel(entry)}
            onEdit={onEdit}
            cancel={cancel}
            onRemind={onRemind}
            printHref={
              canHaveNoteDocument(entry.kind) ? appUrls.printEntry(entry.groupId, entry.id) : undefined
            }
            onDelete={onDelete}
          />
        )}
        {easy ? (
          <span
            className="bg-base-200 text-muted inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold"
            data-author={entry.createdBy}
          >
            <span aria-hidden="true">{initials(authorName)}</span>
            <span className="sr-only">By {authorName}</span>
          </span>
        ) : (
          <AuthorFilterLink
            userId={entry.createdBy}
            name={authorName}
            initials={initials(authorName)}
            image={authorImage}
          />
        )}
      </div>
    </li>
  );
}

/** A cancelled event's text, struck through and muted (rows and cards). */
export const CANCELLED_TEXT = "text-faint line-through";

/** "Cancelled", below a cancelled event's text. An inline block, so the line through its text skips it. */
export function CancelledBadge({ label }: { label: string }) {
  return (
    <p className="inline-block" data-cancelled-label>
      <Badge>{label}</Badge>
    </p>
  );
}
