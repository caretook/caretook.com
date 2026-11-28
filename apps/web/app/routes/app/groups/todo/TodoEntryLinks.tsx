import type { LinkedEntry } from "./useTodoEntryLinks";

import { DEFAULT_UNITS } from "@caretook/data/schema";
import { X } from "lucide-react";
import { TimelineEntryRow } from "~/components/entry";
import { IconButton, ListRow } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useEntryOpenerState } from "~/lib/timeline/entryOrigin";
import { linkedEntryName } from "~/lib/todos/entryTodoDisplay";
import { REMOVED_ITEM } from "../todos/todoLinks";

type RowTag = { id: string; name: string; color?: string | null };

/** A link row's Remove (writers): unlinks it, leaving both sides. */
export function RemoveLink({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <IconButton
      label={`Remove link to ${name}`}
      icon={X}
      onPress={onRemove}
      className="relative z-10"
      data-todo-link-remove=""
    />
  );
}

/**
 * A link to a provider or medication deleted since: "Removed item", greyed,
 * under what it was ("Provider", "Medication"), opening nothing; writers'
 * Remove clears the slot. Not its kind's card, on purpose (data-rights): a
 * delete scrubs the row, so the card has no name, details or actions left to
 * show, and every removed link reads the same here and on the sheet's chips
 * (`chosenLinkChip`).
 */
export function RemovedLinkRow({
  kind,
  label,
  onRemove,
}: {
  kind: "provider" | "medication";
  /** What it was: "Provider", "Medication". */
  label: string;
  /** Writers: clear the slot. */
  onRemove?: () => void;
}) {
  return (
    <ListRow
      trailing={onRemove && <RemoveLink name={REMOVED_ITEM} onRemove={onRemove} />}
      data-todo-link={kind}
      data-removed=""
    >
      <p className="text-muted text-xs">{label}</p>
      <p className="text-faint" data-removed-link-name="">
        {REMOVED_ITEM}
      </p>
    </ListRow>
  );
}

/**
 * A linked note or event as the timeline's own row (`TimelineEntryRow`,
 * `elsewhere`: the day over the time, a plain kind icon and author), with
 * its tags; a cancelled event struck through and labelled. It opens its
 * page, whose Back returns here (B-936). Writers get Remove at its end,
 * which unlinks it and leaves both the entry and the todo.
 */
export function EntryLinkRow({
  groupId,
  entry,
  text,
  authorName,
  authorImage,
  tags,
  tagsReadOnly,
  onRemove,
}: {
  groupId: string;
  entry: LinkedEntry;
  /** The entry's document text (its body, and a note's name for Remove). */
  text: string;
  authorName: string;
  authorImage: string | null;
  /** Its tags, from `TodoLinks`' one query. */
  tags?: readonly RowTag[];
  tagsReadOnly?: boolean;
  /** Writers: unlink it. */
  onRemove?: () => void;
}) {
  const opener = useEntryOpenerState();
  return (
    <TimelineEntryRow
      entry={{ ...entry, body: text || null }}
      authorName={authorName}
      authorImage={authorImage}
      // Notes and events only: no readings to show in anyone's units.
      units={DEFAULT_UNITS}
      open={{ to: appUrls.entry(groupId, entry.id), sheet: false, state: opener }}
      tags={tags}
      tagsReadOnly={tagsReadOnly}
      elsewhere
      trailing={onRemove && <RemoveLink name={linkedEntryName(entry, text)} onRemove={onRemove} />}
      data-todo-link={entry.kind}
    />
  );
}
