import type { TagTarget } from "@caretook/data/schema";

import { canTagRecord } from "@caretook/data/schema";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Message } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { untagRecord } from "~/lib/tags/tags.sync";
import { TagChips } from "./TagChips";
import { useRecordTags } from "./useTags";
import { useTagPicker } from "./useTagPicker";

type QuickTag = { id: string; name: string; color?: string | null };

type QuickTagsProps = {
  target: TagTarget;
  recordId: string;
  /** The record's name, for the picker's title ("Tags: <label>"). */
  label: string;
  /** Who created the record (`canTagRecord`: an Easy helper tags their own entries). */
  createdBy: string | null | undefined;
  /** Chips before "+N" (rows pass 2); null shows them all (a record's page). */
  max: number | null;
  /**
   * The record's tags when the caller already has them (a list's one
   * `useGroupRecordTags` query); left out, it reads `useRecordTags` itself.
   */
  tags?: readonly QuickTag[];
  /** Chips only, whoever's looking (a deleted or unsaved record). */
  readOnly?: boolean;
  /** A row's: "Add tag" as an icon alone (its name and tooltip stay "Add tag"). */
  compact?: boolean;
  className?: string;
};

/**
 * The one tag control on rows, pages and edit sheets (tags-2): the record's
 * chips in color, and, for whoever may tag it (`canTagRecord`), an × on
 * each chip that untags it at once and "Add tag" opening the picker
 * (`useTagPicker`; its Add-new only for `canCreateTag`). Every tap is its
 * own local write, never part of a form's Save. Anyone else sees the chips
 * alone (nothing when there are none). It sits above a row's stretched
 * open target (`relative z-10`), so its taps never open the record.
 */
export function QuickTags(props: QuickTagsProps) {
  return props.tags ? <QuickTagsView {...props} tags={props.tags} /> : <OwnQuickTags {...props} />;
}

/** A page's or sheet's: the record's own live query. */
function OwnQuickTags(props: QuickTagsProps) {
  const tags = useRecordTags(props.target, props.recordId);
  return <QuickTagsView {...props} tags={tags} />;
}

function QuickTagsView({
  target,
  recordId,
  label,
  createdBy,
  max,
  tags,
  readOnly,
  compact,
  className = "",
}: QuickTagsProps & { tags: readonly QuickTag[] }) {
  const group = useGroup();
  const picker = useTagPicker();
  const [error, setError] = useState<string | null>(null);
  const editable = !readOnly && canTagRecord(group.role, { target, createdBy }, group.userId);
  if (!editable) return <TagChips tags={tags} max={max} className={className} />;

  const pick = () => picker.ask({ target, recordId, label });
  const remove = async (tagId: string) => {
    setError(null);
    const res = await untagRecord(getSync(), tagId, target, recordId);
    if (!res.ok) setError(res.error);
  };
  return (
    <div className={`relative z-10 space-y-1 ${className}`} data-quick-tags="">
      <div className="flex flex-wrap items-center gap-1">
        <TagChips tags={tags} max={max} onRemove={(t) => void remove(t.id)} onMore={pick} />
        {compact ? (
          <Button
            variant="ghost"
            size="xs"
            icon={Plus}
            label="Add tag"
            onClick={pick}
            aria-haspopup="dialog"
            data-quick-tag-add=""
          />
        ) : (
          <Button
            variant="ghost"
            size="xs"
            icon={Plus}
            onClick={pick}
            aria-haspopup="dialog"
            data-quick-tag-add=""
          >
            Add tag
          </Button>
        )}
      </div>
      {error && <Message tone="error">{error}</Message>}
      {picker.sheet}
    </div>
  );
}
