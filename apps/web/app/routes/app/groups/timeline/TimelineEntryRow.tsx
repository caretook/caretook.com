import type { EntryOpen } from "./entryOpen";
import type { UnitChoices } from "@caretook/data/schema";
import type { LinkedProviderName } from "~/lib/entryProviders";
import type { TimelineEntry } from "~/lib/rpc";

import { AuthorFilterLink, EntryActions, KindFilterLink } from "~/components/entry";
import { initials } from "~/lib/entryDisplay";
import { formatTime, formatTimeInZone } from "~/lib/format";
import { EntryBody } from "./EntryBody";
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
  /** Omitted for people who can't change the timeline (viewers): no ⋯ menu. */
  onDelete?: () => void;
  /** Others are writing in its document now: the live dot's label ("Being written now by Maria"). */
  liveLabel?: string;
  /** A note's or event's linked providers: the "with …" line. */
  providers?: LinkedProviderName[];
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
  liveLabel,
  providers,
}: EntryViewProps) {
  const elsewhere = formatTimeInZone(entry.occurredAt, entry.timeZone);
  return (
    <li className={`relative isolate flex items-start gap-2.5 px-3 py-2 ${removing ? "opacity-50" : ""}`}>
      {open && <EntryOpenTarget open={open} entry={entry} />}
      <KindFilterLink kind={entry.kind} size="sm" />
      <time
        dateTime={entry.occurredAt}
        className="text-base-content/70 w-[4.1rem] shrink-0 pt-0.5 text-sm whitespace-nowrap tabular-nums"
      >
        {formatTime(entry.occurredAt)}
      </time>
      <EntryBody
        entry={entry}
        units={units}
        clamp
        providers={providers}
        className="pt-0.5"
        footer={elsewhere && <p className="text-base-content/60 text-xs">{elsewhere}</p>}
      />
      {liveLabel && <LiveDot label={liveLabel} className="mt-2" />}
      <AuthorFilterLink
        userId={entry.createdBy}
        name={authorName}
        initials={initials(authorName)}
        image={authorImage}
      />
      {onDelete && (
        <EntryActions kind={entry.kind} label={actionsLabel(entry)} onEdit={onEdit} onDelete={onDelete} />
      )}
    </li>
  );
}
