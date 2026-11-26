import type { MenuEntry } from "~/components/ui";

import { Ellipsis, Pencil, RotateCcw, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button, ConfirmDialog, Menu, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { TODO_SHEET_STATE } from "~/lib/todos/todoSheets";
import { RepeatDeleteDialog } from "./RepeatDeleteDialog";

/** The page's delete intent, posted to its clientAction. */
export const DELETE_INTENT = "delete";
/** Skip this occurrence of a repeating todo (planner-2): it goes, and the next one comes. */
export const SKIP_INTENT = "skip";

/**
 * A writer's actions on a todo: Edit (the edit sheet, which comes back
 * here) and ⋯ with Tags (the picker sheet, when `onTags` is given; tags
 * PRD), Reopen (once it's done) and Delete, behind a confirm:
 * for an open repeating todo, the choice of skipping this one or stopping
 * the repeat. `onDelete` hears the delete or skip as it's sent; the page
 * leaves once the live row shows it.
 */
export function TodoActions({
  groupId,
  todoId,
  title,
  done,
  repeats,
  busy,
  onReopen,
  onDelete,
  onTags,
}: {
  groupId: string;
  todoId: string;
  title: string;
  done: boolean;
  /** It repeats (and so has a next one to skip to). */
  repeats: boolean;
  busy: boolean;
  onReopen: () => void;
  onDelete: () => void;
  /** Opens the tag picker; left out, there's no Tags. */
  onTags?: () => void;
}) {
  const fetcher = useFetcher<{ ok: true } | { ok: false; error: string }>();
  const [confirming, setConfirming] = useState(false);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const asksRepeat = repeats && !done;
  const send = (intent: string) => {
    setConfirming(false);
    onDelete();
    void fetcher.submit({ intent }, { method: "post" });
  };
  const items: MenuEntry[] = [
    ...(onTags ? [{ id: "tags", label: "Tags", icon: Tag, onAction: onTags }] : []),
    ...(done
      ? [{ id: "reopen", label: "Reopen", icon: RotateCcw, isDisabled: busy, onAction: onReopen }]
      : []),
    { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => setConfirming(true) },
  ];

  return (
    <>
      <Button
        to={appUrls.editTodo(groupId, todoId)}
        // Closing the sheet comes back here.
        state={TODO_SHEET_STATE}
        prefetch="render"
        variant="ghost"
        size="sm"
        icon={Pencil}
        data-edit-todo=""
      >
        Edit
      </Button>
      <Menu
        label={`Actions for ${title}`}
        items={items}
        variant="ghost"
        size="sm"
        shape="square"
        className="shrink-0"
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </Menu>
      {result && !result.ok && <Message tone="error">{result.error}</Message>}
      {asksRepeat ? (
        <RepeatDeleteDialog
          open={confirming}
          title={title}
          onClose={() => setConfirming(false)}
          onSkip={() => send(SKIP_INTENT)}
          onStop={() => send(DELETE_INTENT)}
        />
      ) : (
        <ConfirmDialog
          open={confirming}
          title="Delete this todo?"
          message={`“${title}” and its notes will be removed for everyone in the care group.`}
          confirmLabel="Delete"
          onClose={() => setConfirming(false)}
          onConfirm={() => send(DELETE_INTENT)}
        />
      )}
    </>
  );
}
