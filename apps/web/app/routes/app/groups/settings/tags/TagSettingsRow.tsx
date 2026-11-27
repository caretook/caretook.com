import type { TagRow } from "~/lib/tags/tags.sync";

import { TAG_COLORS, canDeleteTag, canRenameTag } from "@caretook/data/schema";
import { Merge, Palette, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { DeleteTagDialog, MergeTagDialog, TagEditor } from "~/components/tags";
import {
  Badge,
  Button,
  IconButton,
  ListRow,
  Message,
  Swatch,
  SwatchGroup,
  tagColorClass,
} from "~/components/ui";
import { getSync } from "~/lib/sync";
import { recolorTag } from "~/lib/tags/tags.sync";

/** "3 items", "1 item", "0 items". */
export const itemCount = (n: number) => (n === 1 ? "1 item" : `${n} items`);

const colorLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

/**
 * One tag on the Tags page: its chip (the shared chip look, in its color)
 * and how many live records carry it. Whoever may rename it
 * (`canRenameTag`) gets Rename (the picker's `TagEditor`, in place) and
 * Color (the palette as swatches; a pick is a local write at once, every
 * chip follows); owners get Merge (into one of `others`, when there are
 * any; the confirm names both and the count) and Delete (the count
 * confirm). Anyone else sees the row only.
 */
export function TagSettingsRow({
  tag,
  uses,
  others,
  role,
  userId,
}: {
  tag: TagRow;
  uses: number;
  /** The group's other tags, what Merge offers. */
  others: readonly TagRow[];
  role: string | null | undefined;
  userId: string;
}) {
  const [mode, setMode] = useState<"rename" | "color" | null>(null);
  const [confirming, setConfirming] = useState<"delete" | "merge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panel = useId();
  const canEdit = canRenameTag(role, { createdBy: tag.created_by }, userId);
  const canDelete = canDeleteTag(role);
  const fill = tagColorClass(tag.color);

  if (mode === "rename")
    return (
      <ListRow data-tag-row={tag.id}>
        <TagEditor tag={tag} role={role} onDone={() => setMode(null)} />
      </ListRow>
    );

  const recolor = async (color: string) => {
    setError(null);
    const res = await recolorTag(getSync(), tag.id, color);
    if (!res.ok) setError(res.error);
  };

  return (
    <ListRow className="space-y-3" data-tag-row={tag.id}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <Badge
            className="max-w-full"
            fill={fill}
            data-tag-chip={tag.id}
            data-tag-color={fill ? (tag.color ?? undefined) : undefined}
          >
            <span className="truncate">{tag.name}</span>
          </Badge>
          <span className="text-muted text-sm" data-tag-uses="">
            {itemCount(uses)}
          </span>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && (
              <IconButton
                label={`Rename ${tag.name}`}
                icon={Pencil}
                onPress={() => setMode("rename")}
                data-tag-edit={tag.id}
              />
            )}
            {canEdit && (
              <IconButton
                label={`Color of ${tag.name}`}
                icon={Palette}
                expanded={mode === "color"}
                controls={panel}
                onPress={() => setMode(mode === "color" ? null : "color")}
                data-tag-recolor={tag.id}
              />
            )}
            {canDelete && others.length > 0 && (
              <IconButton
                label={`Merge ${tag.name} into another tag`}
                icon={Merge}
                onPress={() => setConfirming("merge")}
                data-tag-merge={tag.id}
              />
            )}
            {canDelete && (
              <IconButton
                label={`Delete ${tag.name}`}
                icon={Trash2}
                onPress={() => setConfirming("delete")}
                data-tag-delete={tag.id}
              />
            )}
          </div>
        )}
      </div>
      {mode === "color" && (
        <div id={panel} className="space-y-3">
          <SwatchGroup label={`Color of “${tag.name}”`}>
            {TAG_COLORS.map((color) => (
              <Swatch
                key={color}
                name={`tag-color-${tag.id}`}
                label={colorLabel(color)}
                checked={tag.color === color}
                onChange={() => void recolor(color)}
                className={tagColorClass(color) ?? ""}
              />
            ))}
          </SwatchGroup>
          <Button size="sm" onClick={() => setMode(null)}>
            Done
          </Button>
        </div>
      )}
      {error && <Message tone="error">{error}</Message>}
      {canDelete && (
        <DeleteTagDialog
          tag={tag}
          uses={uses}
          open={confirming === "delete"}
          onClose={() => setConfirming(null)}
          onError={setError}
        />
      )}
      {canDelete && others.length > 0 && (
        <MergeTagDialog
          tag={tag}
          uses={uses}
          others={others}
          open={confirming === "merge"}
          onClose={() => setConfirming(null)}
          onError={setError}
        />
      )}
    </ListRow>
  );
}
