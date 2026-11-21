import type { TodoRepeatDraft } from "./todoFormData";

import { Repeat } from "lucide-react";
import { lazy, Suspense, useId, useState } from "react";
import { useGroup } from "~/lib/app-shell/group";
import { defaultChoice } from "~/lib/appointments/repeatChoice";
import { todoRepeatLine } from "~/lib/todos/todoDisplay";
import { FIELD } from "./todoFormData";

// The sheet's preview needs rrule: its folder loads only when Repeat opens.
const RepeatSheet = lazy(() => import("~/components/repeat").then((m) => ({ default: m.RepeatSheet })));

/**
 * How a todo repeats (planner-2), under its due day: a button saying the
 * repeat ("Doesn't repeat", "Repeats weekly on Monday") that opens the
 * repeat sheet, with the same choices as appointments. Off until there's a
 * due day (the repeat starts there). Posts the rule as `repeatRule` (empty:
 * none). The caller holds the draft, so clearing the day clears it.
 */
export function TodoRepeat({
  day,
  dueTime,
  draft,
  onChange,
  error,
}: {
  /** The due day ("YYYY-MM-DD"), or "" for none. */
  day: string;
  /** "HH:MM", or "" for all day. */
  dueTime: string;
  draft: TodoRepeatDraft;
  onChange: (draft: TodoRepeatDraft) => void;
  error?: string;
}) {
  const { recipient } = useGroup();
  const [open, setOpen] = useState(false);
  const helpId = useId();
  const label = draft
    ? (todoRepeatLine({ repeatRule: draft.rule, repeatStartsOn: day }) ?? "Repeats")
    : "Doesn't repeat";
  const help = error ?? (day ? null : "Choose a due day to repeat");

  return (
    <div className="fieldset" data-todo-repeat>
      <span className="fieldset-legend text-sm">Repeat</span>
      <button
        type="button"
        className="btn btn-ghost btn-sm border-base-300 justify-start gap-2 font-normal"
        aria-label={`Repeat: ${label}`}
        aria-describedby={help ? helpId : undefined}
        disabled={!day}
        onClick={() => setOpen(true)}
        data-todo-repeat-button
      >
        <Repeat className="size-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </button>
      {help && (
        <p id={helpId} className={`text-sm ${error ? "text-error" : "text-base-content/70"}`}>
          {help}
        </p>
      )}
      <input type="hidden" name={FIELD.repeatRule} value={draft?.rule ?? ""} />
      {open && day && (
        <Suspense fallback={null}>
          <RepeatSheet
            initial={draft?.choice ?? defaultChoice(day)}
            timing={{
              startsOn: day,
              startTime: dueTime || null,
              allDay: !dueTime,
              timeZone: recipient?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
              durationMinutes: null,
            }}
            kind="todo"
            onClose={() => setOpen(false)}
            onDone={(choice, rule) => {
              setOpen(false);
              onChange(rule ? { choice, rule, day } : null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
