import type { EntryOpen } from "~/lib/timeline/entryOpen";
import type { UnitChoices } from "@caretook/data/schema";
import type { LinkedProviderName } from "~/lib/providers/entryProviders";
import type { EntryCancelActions } from "./EntryActions";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { NoteBlock } from "~/lib/live-notes/noteRichText";
import type { ReactNode } from "react";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { AuthorCircle, AuthorFilterLink, KindFilterLink, KindIcon } from "./KindIcon";
import { EntryActions } from "./EntryActions";
import { EntryBody } from "./EntryBody";
import { RepeatMark } from "./RepeatMark";
import { QuickTags } from "~/components/tags";
import { Badge, ViaTag } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formatTime, formatTimeInZone, localTimeZone } from "~/lib/core/format";
import { cancelledLabel } from "~/lib/appointments/upcomingLabels";
import { useCopyLink } from "./CopyLinkButton";
import { actionsLabel, entryLabel, rowDayLabel } from "~/lib/timeline/entryLabels";
import { EntryOpenTarget } from "./EntryOpenTarget";
import { LiveDot } from "./LiveDot";
import { OpenTodosMark } from "./OpenTodosMark";
import { ASIDE_CLASS } from "./layout";
import { entryLinkPath } from "~/lib/timeline/timelineLinks";
import type { ParsedSearch } from "@caretook/data/domain";

/** What an entry's display shows and does, in either look (`TimelineEntryRow`). */
export type EntryViewProps = {
  entry: TimelineEntry;
  authorName: string;
  /** The author's picture (the row's avatar and tooltip). */
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
  /** A note's or event's formatted text (the Full look only: Condensed keeps the plain two-line clamp). */
  richText?: NoteBlock[] | null;
  /** The timeline's search (`?q=`, parsed): its matches are marked. */
  search?: ParsedSearch;
  /** Easy mode: the kind icon and the author aren't filters. */
  easy?: boolean;
  /**
   * Away from the timeline (search, a provider's or todo's links): the kind
   * icon and the author aren't filters (they'd point at the timeline's), and
   * the day shows over the time, since the rows aren't grouped by day.
   */
  elsewhere?: boolean;
  /** How many open todos it links (planner-3): the "1 todo" mark (not in easy mode). */
  openTodos?: number;
  /**
   * Its tags, from the list's one query (tags PRD): two chips, then "+N", for
   * every role and in the easy view; × and "Add tag" for whoever may tag it
   * (`RowTags`, tags-2).
   */
  tags?: readonly { id: string; name: string; color?: string | null }[];
};

const NO_TAGS: readonly { id: string; name: string }[] = [];

/** `data-*` attributes a caller puts on the row's `<li>` (search's `data-result`, …). */
type DataHooks = { [attr: `data-${string}`]: string | undefined };

/**
 * An entry's tags (tags-2): `QuickTags` with two chips, then "+N",
 * and "Add tag", from the list's query (never one per row). Its
 * taps sit above the stretched open target, so they never open the entry.
 * `readOnly` (the easy roles' Planner): the chips only.
 */
export function RowTags({
  entry,
  tags,
  readOnly,
  className,
}: Pick<EntryViewProps, "entry" | "tags"> & { readOnly?: boolean; className?: string }) {
  return (
    <QuickTags
      target="entry"
      recordId={entry.id}
      label={entryLabel(entry)}
      createdBy={entry.createdBy}
      max={2}
      tags={tags ?? NO_TAGS}
      readOnly={readOnly}
      className={className}
    />
  );
}

/** A timeline entry's two looks (the timeline's Full and Condensed views). */
export type EntryLook = "full" | "condensed";

/**
 * Each look's `<li>`: Full is a card of its own, roomier and spaced apart
 * (the list's `space-y-2`); Condensed sits close in the list's divided box.
 * Everything inside is the same.
 */
const LOOK_CLASS: Record<EntryLook, string> = {
  full: "rounded-box border-base-300 bg-base-100 gap-3 border p-3 shadow-sm",
  condensed: "gap-2.5 px-3 py-2",
};

/**
 * One timeline entry, the same display everywhere (shared-displays, B-1015):
 * the kind icon, the entry's body with its first line beside the time (so
 * the text gets the width; the day over it `elsewhere`), then a right-hand
 * column with the ⋯ menu (Copy link for every role) and, under it, the
 * author's avatar (a filter). `look` is the timeline's view: Full spaces
 * entries apart and shows all the text (a note's or event's formatted, from
 * `richText`); Condensed (the default, off the timeline too) sits closer and
 * clamps the text to two lines, with "More". `tagsReadOnly` shows its tags
 * as chips only (search's easy roles, as on the Planner); `trailing` (a todo
 * link's Remove) sits at the row's end, above the open target; `data-*`
 * props go on the row's `<li>`.
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
  richText,
  search,
  easy,
  elsewhere,
  openTodos,
  tags,
  look = "condensed",
  tagsReadOnly,
  trailing,
  ...data
}: EntryViewProps & {
  look?: EntryLook;
  tagsReadOnly?: boolean;
  trailing?: ReactNode;
} & DataHooks) {
  const otherZone = formatTimeInZone(entry.occurredAt, entry.timeZone);
  // Plain icon and author: easy mode, and away from the timeline.
  const plain = easy || elsewhere;
  const full = look === "full";
  const cancelled = cancelledLabel(entry);
  const size = full ? "md" : "sm";
  return (
    <li
      {...data}
      className={`relative isolate flex items-start ${LOOK_CLASS[look]} ${removing ? "opacity-50" : ""}`}
      data-look={look}
      data-easy={easy ? "" : undefined}
      data-cancelled={cancelled ? "" : undefined}
    >
      {open && <EntryOpenTarget open={open} entry={entry} />}
      {plain ? <KindIcon kind={entry.kind} size={size} /> : <KindFilterLink kind={entry.kind} size={size} />}
      <EntryBody
        entry={entry}
        units={units}
        clamp={!full}
        providers={providers}
        richText={full ? richText : undefined}
        search={search}
        className={`${full ? "space-y-0.5" : "pt-0.5"} ${cancelled ? CANCELLED_TEXT : ""}`}
        aside={
          <>
            {liveLabel && <LiveDot label={liveLabel} />}
            <EntryTime entry={entry} elsewhere={elsewhere} />
          </>
        }
        footer={
          <>
            {otherZone && <p className="text-faint text-xs">{otherZone}</p>}
            {cancelled && <CancelledBadge label={cancelled} />}
            {entry.via && (
              <p className="inline-block">
                <ViaTag via={entry.via} />
              </p>
            )}
            <OpenTodosMark count={openTodos} />
            <RowTags entry={entry} tags={tags} readOnly={tagsReadOnly} className="mt-0.5" />
          </>
        }
      />
      {/* The right column: the ⋯ menu, the author under it, so the text gets the width. */}
      <div className={`${ASIDE_CLASS} w-8`} data-entry-aside>
        <EntryMenu entry={entry} onEdit={onEdit} cancel={cancel} onRemind={onRemind} onDelete={onDelete} />
        {plain ? (
          <AuthorCircle
            userId={entry.createdBy}
            name={authorName}
            image={authorImage}
            label={`By ${authorName}`}
          />
        ) : (
          <AuthorFilterLink userId={entry.createdBy} name={authorName} image={authorImage} circle />
        )}
      </div>
      {trailing && (
        <div className="relative z-10 flex shrink-0 items-center gap-1 self-center" data-entry-trailing="">
          {trailing}
        </div>
      )}
    </li>
  );
}

/**
 * An entry's time, beside its first line: "All day" or the time, a series
 * visit's repeat mark after it, and `elsewhere` (rows not grouped by day)
 * the day over it.
 */
function EntryTime({ entry, elsewhere }: { entry: TimelineEntry; elsewhere?: boolean }) {
  return (
    <>
      <time
        dateTime={entry.occurredAt}
        className="text-muted text-right text-sm whitespace-nowrap tabular-nums"
      >
        {elsewhere && (
          <span className="block" data-row-day="">
            {/* An all-day entry's day is its own zone's date, not the device's. */}
            {rowDayLabel(entry.occurredAt, entry.allDay ? entry.timeZone : localTimeZone(), new Date())}
          </span>
        )}
        {entry.allDay ? "All day" : formatTime(entry.occurredAt)}
      </time>
      <RepeatMark seriesId={entry.seriesId} className="text-muted" />
    </>
  );
}

/**
 * An entry's ⋯ menu on its rows and the Planner's cards, with Copy link for every role (its
 * page, or its day for a kind without one: `entryLinkPath`) and "Link copied"
 * under it. It sits above the row's stretched open target (`relative z-10`).
 * `label` names it for screen readers (default "Actions for <kind> at <time>";
 * the Planner's cards say "Actions for <title>"); `onPrepare` is the
 * Planner's Prepare.
 */
export function EntryMenu({
  entry,
  label,
  onEdit,
  cancel,
  onPrepare,
  onRemind,
  onDelete,
}: Pick<EntryViewProps, "entry" | "onEdit" | "cancel" | "onRemind" | "onDelete"> & {
  label?: string;
  onPrepare?: () => void;
}) {
  const link = useCopyLink(entryLinkPath(entry, localTimeZone()));
  return (
    <div className="relative z-10 flex shrink-0" data-copy-link="">
      <EntryActions
        kind={entry.kind}
        label={label ?? actionsLabel(entry)}
        onEdit={onEdit}
        cancel={cancel}
        onPrepare={onPrepare}
        onRemind={onRemind}
        printHref={canHaveNoteDocument(entry.kind) ? appUrls.printEntry(entry.groupId, entry.id) : undefined}
        onCopyLink={link.copy}
        onDelete={onDelete}
      />
      {link.feedback}
    </div>
  );
}

/** A cancelled event's text, struck through and muted (both looks and the Planner's cards). */
export const CANCELLED_TEXT = "text-faint line-through";

/** "Cancelled", below a cancelled event's text. An inline block, so the line through its text skips it. */
export function CancelledBadge({ label }: { label: string }) {
  return (
    <p className="inline-block" data-cancelled-label>
      <Badge>{label}</Badge>
    </p>
  );
}
