import type { MenuEntry } from "~/components/ui";

import { Ellipsis, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { ConfirmDialog, Menu } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { TASK_SHEET_STATE } from "~/lib/tasks/taskSheets";

/** The page's delete intent, posted to its clientAction. */
export const DELETE_INTENT = "delete";

/**
 * A writer's actions on a task: Edit (the edit sheet, which comes back
 * here) and ⋯ with Reopen (once it's done) and Delete, behind a confirm.
 * `onDelete` hears the delete as it's sent; the page leaves once the live
 * row shows it.
 */
export function TaskActions({
  groupId,
  taskId,
  title,
  done,
  busy,
  onReopen,
  onDelete,
}: {
  groupId: string;
  taskId: string;
  title: string;
  done: boolean;
  busy: boolean;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const fetcher = useFetcher<{ ok: true } | { ok: false; error: string }>();
  const [confirming, setConfirming] = useState(false);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const items: MenuEntry[] = [
    ...(done
      ? [{ id: "reopen", label: "Reopen", icon: RotateCcw, isDisabled: busy, onAction: onReopen }]
      : []),
    { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => setConfirming(true) },
  ];

  return (
    <>
      <Link
        to={appUrls.editTask(groupId, taskId)}
        // Closing the sheet comes back here.
        state={TASK_SHEET_STATE}
        prefetch="render"
        className="btn btn-ghost btn-sm gap-1"
        data-edit-task
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Link>
      <Menu label={`Actions for ${title}`} items={items} className="btn btn-ghost btn-sm btn-square shrink-0">
        <Ellipsis className="size-4" aria-hidden="true" />
      </Menu>
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete this task?"
        message={`“${title}” and its notes will be removed for everyone in the care group.`}
        confirmLabel="Delete"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onDelete();
          void fetcher.submit({ intent: DELETE_INTENT }, { method: "post" });
        }}
      />
    </>
  );
}
