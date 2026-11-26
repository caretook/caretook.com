import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "~/components/ui";
import {
  pruneTodoUndo,
  subscribeTodoUndo,
  type TodoUndo,
  todoUndoFor,
  todoUndoSnapshot,
} from "~/lib/todos/todoUndo";
import { undoTodoTick } from "./useTodoTick";

const NO_OFFERS: readonly TodoUndo[] = [];
const noOffers = () => NO_OFFERS;

/**
 * The Undo after each tick: "Done: Call the pharmacy · Undo" in one polite
 * status region for about 10 s from that tick (`lib/todos/todoUndo.ts`),
 * for this group's ticks, newest first, each line with its own Undo
 * (named "Undo <title>") that reopens only that todo. The region is always
 * rendered (empty when there's nothing to undo), so the announcement isn't
 * lost, and it's a list even for one line, with `aria-atomic="false"` and
 * additions only, so a new tick announces just its own line. `todoIds`
 * keeps it to those todos' ticks (a page with two regions: the todo's own
 * Status, its Subtasks).
 */
export function TodoUndoStatus({
  groupId,
  todoIds,
  className = "",
}: {
  groupId: string;
  todoIds?: readonly string[];
  className?: string;
}) {
  const all = useSyncExternalStore(subscribeTodoUndo, todoUndoSnapshot, noOffers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const shown = all.length ? todoUndoFor(groupId).filter((o) => !todoIds || todoIds.includes(o.todoId)) : [];
  const nextExpiry = shown.length ? Math.min(...shown.map((o) => o.expiresAt)) : null;

  // Each line clears itself when its time is up.
  useEffect(() => {
    if (nextExpiry === null) return;
    const timer = setTimeout(() => pruneTodoUndo(), Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  const undo = (offer: TodoUndo) => {
    setBusy((keys) => new Set(keys).add(offer.key));
    setError(null);
    void undoTodoTick(offer.key, offer.todoId)
      .then((result) => !result.ok && setError(result.error))
      .finally(() =>
        setBusy((keys) => {
          const next = new Set(keys);
          next.delete(offer.key);
          return next;
        }),
      );
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
      className={className}
      data-todo-undo={shown.length ? "" : undefined}
    >
      {shown.length > 0 && (
        <ul className="rounded-box bg-info/10 flex flex-col items-stretch gap-1 px-3 py-2 text-sm">
          {shown.map((offer) => (
            <li key={offer.key} className="flex items-center justify-between gap-3" data-todo-undo-line>
              <span data-todo-undo-label>{offer.label}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Undo ${offer.title}`}
                disabled={busy.has(offer.key)}
                data-todo-undo-button=""
                onClick={() => undo(offer)}
              >
                Undo
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-error-ink text-sm">{error}</p>}
    </div>
  );
}
