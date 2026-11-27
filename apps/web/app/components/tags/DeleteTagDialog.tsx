import { ConfirmDialog } from "~/components/ui";
import { getSync } from "~/lib/sync";
import { deleteTag } from "~/lib/tags/tags.sync";

/** "3 records", "1 record", "no records" (the delete and merge confirms). */
export const recordCount = (n: number) => (n === 0 ? "no records" : n === 1 ? "1 record" : `${n} records`);

/**
 * Deleting a tag (owners, `canDeleteTag`; the write checks it again): a
 * native <dialog> naming how many records carry it, then `deleteTag` (it
 * comes off every record at once; the records stay). The picker's editor and
 * the Tags page share it.
 */
export function DeleteTagDialog({
  tag,
  uses,
  open,
  onClose,
  onDeleted,
  onError,
}: {
  tag: { id: string; name: string };
  uses: number;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onError: (message: string) => void;
}) {
  const remove = async () => {
    const res = await deleteTag(getSync(), tag.id);
    onClose();
    if (res.ok) onDeleted?.();
    else onError(res.error);
  };
  return (
    <ConfirmDialog
      open={open}
      title={`Delete the tag “${tag.name}”?`}
      message={`It comes off ${recordCount(uses)}, for everyone in the group. The records stay.`}
      confirmLabel="Delete tag"
      onConfirm={() => void remove()}
      onClose={onClose}
    />
  );
}
