import type { EntryOpen } from "~/lib/entryOpen";
import type { ParsedSearch, UnitChoices } from "@caretook/data/schema";
import type { LinkedProviderName } from "~/lib/entryProviders";
import type { EntryCancelActions } from "~/components/entry";
import type { TimelineEntry } from "~/lib/rpc";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { AuthorFilterLink, EntryActions, EntryBody, KindFilterLink } from "~/components/entry";
import { appUrls } from "~/lib/appUrls";
import { initials } from "~/lib/entryDisplay";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { cancelledLabel } from "~/lib/upcomingLabels";
import { actionsLabel } from "./entryLabels";
import { EntryOpenTarget } from "./EntryOpenTarget";
import { LiveDot } from "./LiveDot";

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
  /** Others are writing in its document now: the live dot's label ("Being written now by Maria"). */
  liveLabel?: string;
  /** A note's or event's linked providers: the "with …" line. */
  providers?: LinkedProviderName[];
  /** The timeline's search (`?q=`, parsed): its matches are marked. */
  search?: ParsedSearch;
};

/**
 * One entry as a dense row: kind icon, time, the entry's body (text clamped
 * to two lines, with "More"), the author's initials (a filter) and the ⋯ menu.
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
  liveLabel,
  providers,
  search,
}: EntryViewProps) {
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  const cancelled = cancelledLabel(entry);
  return (
    <li
      className={`relative isolate flex items-start gap-2.5 px-3 py-2 ${removing ? "opacity-50" : ""}`}
      data-cancelled={cancelled ? "" : undefined}
    >
      {open && <EntryOpenTarget open={open} entry={entry} />}
      <KindFilterLink kind={entry.kind} size="sm" />
      <time
        dateTime={entry.occurredAt}
        className="text-base-content/70 w-[4.1rem] shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums"
      >
        {entry.allDay ? "All day" : formatTime(entry.occurredAt)}
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
            {elsewhere && <p className="text-base-content/60 text-xs">{elsewhere}</p>}
            {cancelled && <CancelledBadge label={cancelled} />}
          </>
        }
      />
      {liveLabel && <LiveDot label={liveLabel} className="mt-2" />}
      <AuthorFilterLink
        userId={entry.createdBy}
        name={authorName}
        initials={initials(authorName)}
        image={authorImage}
      />
      {(onDelete || canHaveNoteDocument(entry.kind)) && (
        <EntryActions
          kind={entry.kind}
          label={actionsLabel(entry)}
          onEdit={onEdit}
          cancel={cancel}
          printHref={
            canHaveNoteDocument(entry.kind) ? appUrls.printEntry(entry.groupId, entry.id) : undefined
          }
          onDelete={onDelete}
        />
      )}
    </li>
  );
}

/** A cancelled event's text, struck through and muted (rows and cards). */
export const CANCELLED_TEXT = "text-base-content/60 line-through";

/** "Cancelled", below a cancelled event's text. An inline block, so the line through its text skips it. */
export function CancelledBadge({ label }: { label: string }) {
  return (
    <p className="inline-block" data-cancelled-label>
      <span className="badge badge-sm badge-ghost">{label}</span>
    </p>
  );
}
