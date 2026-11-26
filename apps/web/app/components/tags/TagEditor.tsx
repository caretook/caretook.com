import type { TagRow } from "~/lib/tags/tags.sync";

import { canDeleteTag } from "@caretook/data/schema";
import { useEffect, useRef, useState } from "react";
import { Button, ConfirmDialog, Field } from "~/components/ui";
import { getSync, useLiveQuery } from "~/lib/sync";
import { deleteTag, renameTag, tagUsesQuery } from "~/lib/tags/tags.sync";

const NO_USES: { uses: number }[] = [];

/** "3 records", "1 record", "no records". */
const records = (n: number) => (n === 0 ? "no records" : n === 1 ? "1 record" : `${n} records`);

/**
 * One tag's rename in the picker (tags PRD): the name in a box, saved as a
 * local write (every chip follows), with a taken name refused inline. For an
 * owner, Delete too, after a native <dialog> naming how many records carry
 * the tag; the records stay. Who may open it is the picker's
 * (`canRenameTag`); the writes check it again.
 */
export function TagEditor({
  tag,
  role,
  onDone,
}: {
  tag: TagRow;
  role: string | null | undefined;
  onDone: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canDelete = canDeleteTag(role);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const q = tagUsesQuery(tag.id);
  const uses = Number(useLiveQuery<{ uses: number }>(q.sql, q.params, NO_USES)[0]?.uses ?? 0);

  const save = async () => {
    setError(null);
    const res = await renameTag(getSync(), tag.id, name);
    if (res.ok) onDone();
    else setError(res.issues[0]?.message ?? res.error);
  };
  const remove = async () => {
    const res = await deleteTag(getSync(), tag.id);
    setConfirming(false);
    if (res.ok) onDone();
    else setError(res.error);
  };

  return (
    <div className="space-y-2" data-tag-editor={tag.id}>
      <Field label={`Rename “${tag.name}”`} kind="input" error={error ?? undefined}>
        {(control) => (
          <input
            {...control}
            ref={input}
            autoComplete="off"
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // The picker is a form: Enter saves this name, never adds a tag.
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onDone();
              }
            }}
            data-tag-rename=""
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => void save()} data-tag-save="">
          Save
        </Button>
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
        {canDelete && (
          <Button variant="dangerQuiet" size="sm" onClick={() => setConfirming(true)} data-tag-delete="">
            Delete
          </Button>
        )}
      </div>
      {canDelete && (
        <ConfirmDialog
          open={confirming}
          title={`Delete the tag “${tag.name}”?`}
          message={`It comes off ${records(uses)}, for everyone in the group. The records stay.`}
          confirmLabel="Delete tag"
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
