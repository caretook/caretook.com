import { useState } from "react";
import { ConfirmDialog, Field } from "~/components/ui";
import { getSync } from "~/lib/sync";
import { mergeTags } from "~/lib/tags/tags.sync";
import { recordCount } from "./DeleteTagDialog";

/**
 * Merging a tag into another (owners, `canDeleteTag`; the write checks it
 * again): the shared confirm <dialog> with a native select of the group's
 * other tags; once one is chosen it names both tags and how many records
 * carry this one, then `mergeTags` (they get the other tag; this one goes).
 */
export function MergeTagDialog({
  tag,
  uses,
  others,
  open,
  onClose,
  onError,
}: {
  tag: { id: string; name: string };
  uses: number;
  /** The group's other tags, A to Z: what it can merge into. */
  others: readonly { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [intoId, setIntoId] = useState("");
  const into = others.find((t) => t.id === intoId);
  const close = () => {
    setIntoId("");
    onClose();
  };
  const merge = async () => {
    if (!into) return;
    const res = await mergeTags(getSync(), tag.id, into.id);
    close();
    if (!res.ok) onError(res.error);
  };
  return (
    <ConfirmDialog
      open={open}
      title={into ? `Merge “${tag.name}” into “${into.name}”?` : `Merge “${tag.name}” into another tag?`}
      message={
        !into
          ? "Choose the tag that takes its place."
          : uses
            ? `“${into.name}” goes on the ${recordCount(uses)} tagged “${tag.name}”, for everyone in the group, and “${tag.name}” is deleted.`
            : `No record is tagged “${tag.name}”, so it is just deleted.`
      }
      confirmLabel="Merge tags"
      confirmDisabled={!into}
      onConfirm={() => void merge()}
      onClose={close}
    >
      <Field label="Merge into" kind="select">
        {(control) => (
          <select
            {...control}
            value={intoId}
            onChange={(e) => setIntoId(e.target.value)}
            data-tag-merge-into=""
          >
            <option value="">Choose a tag</option>
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </Field>
    </ConfirmDialog>
  );
}
