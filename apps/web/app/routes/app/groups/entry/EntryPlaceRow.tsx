import type { ProviderRow } from "~/lib/providers/providers.sync";

import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { ContactActions } from "~/components/providers";
import { Field } from "~/components/ui";
import { placeMapAction, shownPlace } from "~/lib/appointments/entryPlace";
import { useLiveQuery } from "~/lib/sync";
import { entryProvidersQuery, toProviders } from "~/lib/providers/providers.sync";

const NO_ROWS: ProviderRow[] = [];

/**
 * The entry header's place region (events): where the appointment is. With
 * nothing typed it shows the first linked provider's address, greyed, "from
 * <provider>". Writers type a place (saved on blur or Enter; an empty field
 * goes back to the default). Either has a map action. Viewers see the place,
 * or nothing when there's none.
 */
export function EntryPlaceRow({
  entryId,
  place,
  canWrite,
  onCommit,
}: {
  entryId: string;
  /** The stored place. */
  place: string | null;
  canWrite: boolean;
  /** Called with the trimmed text (null for empty) when it differs from `place`. */
  onCommit: (place: string | null) => void;
}) {
  const query = entryProvidersQuery(entryId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const providers = useMemo(() => toProviders(rows), [rows]);
  const fallback = shownPlace(null, providers);

  const stored = place ?? "";
  const [text, setText] = useState(stored);
  const [editing, setEditing] = useState(false);
  // Someone else changed it: show theirs unless we're mid-edit.
  const [lastStored, setLastStored] = useState(stored);
  if (stored !== lastStored) {
    setLastStored(stored);
    if (!editing) setText(stored);
  }

  const shown = shownPlace(editing ? text : stored, providers);
  const action = placeMapAction(shown);
  const from = shown?.from && <span className="text-base-content/60 text-xs">from {shown.from}</span>;

  if (!canWrite) {
    if (!shown) return null;
    return (
      <div className="flex items-center gap-1.5 text-sm" data-place>
        <MapPin className="text-base-content/60 size-4 shrink-0" aria-hidden="true" />
        <span className={`min-w-0 ${shown.from ? "text-base-content/70" : ""}`}>
          <span className="sr-only">Place: </span>
          {shown.text} {from}
        </span>
        {action && <ContactActions actions={[action]} />}
      </div>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = text.trim();
    setText(next);
    if (next !== stored) onCommit(next || null);
  };

  return (
    <div className="flex items-center gap-1.5" data-place>
      <MapPin className="text-base-content/60 size-4 shrink-0" aria-hidden="true" />
      <Field label="Place" labelHidden className="min-w-0 flex-1">
        {(control) => (
          <input
            {...control}
            type="text"
            value={text}
            maxLength={TIMELINE_LIMITS.place}
            placeholder={fallback ? fallback.text : "Add a place"}
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
            className="input input-ghost input-sm -ml-1 h-auto w-full px-1 py-0.5 text-sm"
          />
        )}
      </Field>
      {!text.trim() && from}
      {action && <ContactActions actions={[action]} />}
    </div>
  );
}
