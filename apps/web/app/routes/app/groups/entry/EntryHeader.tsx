import type { TimelineEntryKind } from "@caretook/data/schema";
import type { ReactNode, Ref } from "react";

import { useState } from "react";
import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { scheduleText } from "~/lib/appointments/entrySchedule";
import { KindIcon } from "~/components/entry";
import { Field } from "~/components/ui";

/**
 * The entry page's header, in four regions so each feature fills only its
 * own:
 *
 *   [icon] [title ............] [editors] [actions]
 *          [time] [via]
 *          [repeat .........]
 *          [with ...........]
 *          [suggestion .....]
 *          [place ..........]
 *
 * - `title`: `EntryTitle` (editable for writers) or plain text.
 * - `time`: when it happened (`EntryTimeChip` for writers, `EntryTime` otherwise).
 * - `via`: the member's AI assistant it was added through (`ViaTag`), after the time.
 * - `repeat`: how it repeats (`EntryRepeat`: a series visit's rule, a new entry's Repeat button).
 * - `editors`: who is typing now (avatars).
 * - `actions`: Share, the ⋯ menu.
 * - `with`: the providers it was with (notes and events).
 * - `suggestion`: an offer drawn from the entry (an event's care period).
 * - `place`: where an event is (an appointment's address).
 *
 * Empty regions take no space.
 */
export function EntryHeader({
  kind,
  title,
  time,
  editors,
  actions,
  with: withRegion,
  suggestion,
  place,
  via,
  repeat,
}: {
  kind: TimelineEntryKind;
  title: ReactNode;
  time: ReactNode;
  via?: ReactNode;
  editors?: ReactNode;
  actions?: ReactNode;
  with?: ReactNode;
  suggestion?: ReactNode;
  place?: ReactNode;
  /** How it repeats (a series visit's rule, or a new entry's Repeat button). */
  repeat?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <KindIcon kind={kind} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div data-region="title">{title}</div>
        <div data-region="time" className="text-muted text-sm">
          {time}
          {via && (
            <span data-region="via" className="ml-2">
              {via}
            </span>
          )}
        </div>
        {repeat && (
          <div data-region="repeat" className="pt-0.5 empty:hidden">
            {repeat}
          </div>
        )}
        {withRegion && (
          <div data-region="with" className="pt-1.5 empty:hidden">
            {withRegion}
          </div>
        )}
        {suggestion && (
          <div data-region="suggestion" className="pt-1.5 empty:hidden">
            {suggestion}
          </div>
        )}
        {place && (
          <div data-region="place" className="pt-1 empty:hidden">
            {place}
          </div>
        )}
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

/**
 * When the entry is, read-only: "Today, 2:15 PM", a range ("Tomorrow, 10:30
 * AM–11:15 AM") or "Friday, Nov 20 · All day". `dateTime` is the start.
 */
export function EntryTime({
  occurredAt,
  endsAt = null,
  allDay = false,
  timeZone,
}: {
  occurredAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  timeZone: string;
}) {
  return (
    <time dateTime={occurredAt} data-all-day={allDay || undefined}>
      {scheduleText({ id: "", occurredAt, endsAt, allDay, timeZone }, new Date())}
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
  required,
  inputRef,
  onCommit,
  onTextChange,
}: {
  value: string | null;
  placeholder: string;
  /** It must be filled (a draft event's): `aria-required` (the label is hidden, so no `*`). */
  required?: boolean;
  /** The input, for the page to focus. */
  inputRef?: Ref<HTMLInputElement>;
  /** Called with the trimmed text when it differs from `value`. */
  onCommit: (title: string) => void;
  /** Called with the field's text as it's typed (before it's committed). */
  onTextChange?: (text: string) => void;
}) {
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
    <Field label="Title" labelHidden required={required}>
      {(control) => (
        <input
          {...control}
          ref={inputRef}
          type="text"
          value={text}
          maxLength={TIMELINE_LIMITS.title}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="done"
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            setText(e.target.value);
            onTextChange?.(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="input input-ghost h-auto w-full px-1 -ml-1 py-0.5 text-xl font-semibold"
        />
      )}
    </Field>
  );
}
