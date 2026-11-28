import type { TagTarget } from "@caretook/data/schema";

import { canTagRecord } from "@caretook/data/schema";
import { TagPlus } from "lucide-react";
import { useState } from "react";
import { Button, Message, toast } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { getSync } from "~/lib/sync";
import { tagRecord, untagRecord } from "~/lib/tags/tags.sync";
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
  className?: string;
};

/**
 * The one tag control on rows, pages and edit sheets (tags-2): the record's
 * chips in color, and, for whoever may tag it (`canTagRecord`), an × on
 * each chip that untags it at once ("Removed <name>" with Undo, which
 * re-tags it with the same derived link id) and an icon-only "Add tag"
 * (lucide `TagPlus`; tags-3), the chips' last item (`TagChips`' `add`),
 * opening the picker (`useTagPicker`; its
 * Add-new only for `canCreateTag`). Every tap is its own local write, never
 * part of a form's Save. Anyone else sees the chips alone (nothing when
 * there are none). It sits above a row's stretched
 * open target (`relative z-10`), so its taps never open the record; it's
 * only as wide as its chips (`w-fit`), so a tap beside them still does.
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
  className = "",
}: QuickTagsProps & { tags: readonly QuickTag[] }) {
  const group = useGroup();
  const picker = useTagPicker();
  const [error, setError] = useState<string | null>(null);
  const editable = !readOnly && canTagRecord(group.role, { target, createdBy }, group.userId);
  if (!editable) return <TagChips tags={tags} max={max} className={className} />;

  const pick = () => picker.ask({ target, recordId, label });
  const remove = async (tag: QuickTag) => {
    setError(null);
    const db = getSync();
    const res = await untagRecord(db, tag.id, target, recordId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({
      message: `Removed ${tag.name}`,
      undo: () =>
        void tagRecord(db, tag.id, target, recordId).then((back) => setError(back.ok ? null : back.error)),
      data: { "data-tag-removed": tag.id },
    });
  };
  return (
    <div className={`relative z-10 w-fit space-y-1 ${className}`} data-quick-tags="">
      <TagChips
        tags={tags}
        max={max}
        onRemove={(t) => void remove(t)}
        onMore={pick}
        add={
          <Button
            variant="ghost"
            size="xs"
            icon={TagPlus}
            label="Add tag"
            onClick={pick}
            aria-haspopup="dialog"
            data-quick-tag-add=""
          />
        }
      />
      {error && <Message tone="error">{error}</Message>}
      {picker.sheet}
    </div>
  );
}
