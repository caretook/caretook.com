import type { TagTarget } from "@caretook/data/schema";

import { canCreateTag, canRenameTag } from "@caretook/data/schema";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import {
  Button,
  CheckField,
  EmptyState,
  Field,
  IconButton,
  Message,
  Sheet,
  tagColorClass,
} from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { exactTag, matchingTags, newTagName } from "~/lib/tags/tagPicker";
import { createTag, tagRecord, untagRecord } from "~/lib/tags/tags.sync";
import { TagEditor } from "./TagEditor";
import { useGroupTags, useRecordTags } from "./useTags";

/** What the picker tags: a record, and its name for the sheet's title. */
export type TagPickerTarget = { target: TagTarget; recordId: string; label: string };

/**
 * The picker sheet (tags PRD): the group's tags with a filter box, each a
 * toggle that tags or untags the record at once (a local write, offline
 * too), and, for anyone who may log, adding the typed name as a new tag on
 * the record in the same step. A name the group has, in any case or
 * spacing, is reused, never added twice (`exactTag`). A tag the person may
 * rename (`canRenameTag`) has a Rename button that edits it in place, with
 * Delete for an owner (`TagEditor`). Who may open it is the caller's
 * (`canTagRecord`); the writes check it again. Each toggle shows its tag's
 * color as a dot (`tagColorClass`; an empty ring for none).
 */
export function TagPickerSheet({
  target,
  recordId,
  label,
  onClose,
}: TagPickerTarget & { onClose: () => void }) {
  const group = useGroup();
  const tags = useGroupTags(group.id);
  const on = new Set(useRecordTags(target, recordId).map((t) => t.id));
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const shown = matchingTags(tags, typed);
  const canAdd = canCreateTag(group.role);
  const adding = canAdd ? newTagName(tags, typed) : null;

  const run = async (write: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    const res = await write();
    if (!res.ok) setError(res.error);
    return res.ok;
  };
  const toggle = (tagId: string, checked: boolean) =>
    void run(() =>
      checked
        ? tagRecord(getSync(), tagId, target, recordId)
        : untagRecord(getSync(), tagId, target, recordId),
    );
  const add = async (name: string) => {
    const db = getSync();
    const made = await createTag(db, group.id, name);
    if (!made.ok) return void setError(made.issues[0]?.message ?? made.error);
    if (await run(() => tagRecord(db, made.id, target, recordId))) setTyped("");
  };
  // Enter: add the typed name, or put on the tag it names exactly.
  const submit = () => {
    if (adding) return void add(adding);
    const exact = exactTag(tags, typed);
    if (exact && !on.has(exact.id)) toggle(exact.id, true);
  };

  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title={`Tags: ${label}`}>
      <form
        className="space-y-3"
        data-tag-picker=""
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={canAdd ? "Find or add a tag" : "Find a tag"} kind="input">
          {(control) => (
            <input
              {...control}
              type="search"
              autoComplete="off"
              enterKeyHint="done"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              data-tag-filter=""
            />
          )}
        </Field>
        {adding && (
          <Button variant="secondary" size="sm" icon={Plus} type="submit" data-tag-add="">
            {`Add “${adding}”`}
          </Button>
        )}
        {error && <Message tone="error">{error}</Message>}
        {shown.length > 0 ? (
          <ul className="space-y-2" aria-label="The group's tags" data-tag-list="">
            {shown.map((t) => (
              <li key={t.id}>
                {editing === t.id ? (
                  <TagEditor tag={t} role={group.role} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <CheckField
                      label={
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            data-tag-swatch={t.color ?? ""}
                            className={`size-3 shrink-0 rounded-full border ${tagColorClass(t.color) ?? "border-base-content/40"}`}
                          />
                          <span className="min-w-0 break-words">{t.name}</span>
                        </span>
                      }
                      checked={on.has(t.id)}
                      onChange={(e) => toggle(t.id, e.target.checked)}
                      data-tag-toggle={t.id}
                    />
                    {canRenameTag(group.role, { createdBy: t.created_by }, group.userId) && (
                      <IconButton
                        label={`Rename ${t.name}`}
                        icon={Pencil}
                        onPress={() => setEditing(t.id)}
                        data-tag-edit={t.id}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !adding && <EmptyState>{tags.length ? "No tags match." : "No tags yet."}</EmptyState>
        )}
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
