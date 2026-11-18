import type { TimelineEntryKind } from "@caretook/data/schema";
import type { ReactNode } from "react";

import { useId, useState } from "react";
import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { formatDay, formatTime } from "~/lib/format";
import { KindIcon } from "./KindIcon";

/**
 * The entry page's header, in four regions so each feature fills only its
 * own:
 *
 *   [icon] [title ............] [editors] [actions]
 *          [time]
 *
 * - `title`: `EntryTitle` (editable for writers) or plain text.
 * - `time`: when it happened (`EntryTimeChip` for writers, `EntryTime` otherwise).
 * - `editors`: who is typing now (avatars).
 * - `actions`: Share, the ⋯ menu.
 *
 * Empty regions take no space.
 */
export function EntryHeader({
  kind,
  title,
  time,
  editors,
  actions,
}: {
  kind: TimelineEntryKind;
  title: ReactNode;
  time: ReactNode;
  editors?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <KindIcon kind={kind} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div data-region="title">{title}</div>
        <div data-region="time" className="text-base-content/70 text-sm">
          {time}
        </div>
      </div>
      {editors && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {actions && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}

/** When the entry happened, read-only. */
export function EntryTime({ occurredAt }: { occurredAt: string }) {
  return (
    <time dateTime={occurredAt}>
      {formatDay(occurredAt)}, {formatTime(occurredAt)}
    </time>
  );
}

/**
 * The title, as an input that saves on blur or Enter (no Save button).
 * `value` is the stored title; while the field isn't being edited it
 * follows changes from other members.
 */
export function EntryTitle({
  value,
  placeholder,
  onCommit,
}: {
  value: string | null;
  placeholder: string;
  /** Called with the trimmed text when it differs from `value`. */
  onCommit: (title: string) => void;
}) {
  const id = useId();
  const stored = value ?? "";
  const [text, setText] = useState(stored);
  const [editing, setEditing] = useState(false);
  // Someone else renamed it: show theirs unless we're mid-edit.
  const [lastStored, setLastStored] = useState(stored);
  if (stored !== lastStored) {
    setLastStored(stored);
    if (!editing) setText(stored);
  }

  const commit = () => {
    setEditing(false);
    const next = text.trim();
    setText(next);
    if (next !== stored) onCommit(next);
  };

  return (
    <>
      <label htmlFor={id} className="sr-only">
        Title
      </label>
      <input
        id={id}
        type="text"
        value={text}
        maxLength={TIMELINE_LIMITS.title}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="done"
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="input input-ghost h-auto w-full px-1 -ml-1 py-0.5 text-xl font-semibold"
      />
    </>
  );
}
