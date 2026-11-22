import type { AssigneeChoice } from "./AssigneeField";
import type { AssigneeMember } from "./assigneeOptions";
import type { LinkChoices } from "./todoSheet";
import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { TODO_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Field } from "~/components/ui";
import { AssigneeField } from "./AssigneeField";
import { TodoLinkFields } from "./TodoLinkFields";
import { FIELD, initialRepeat, isFieldIssue, repeatOnDay } from "./todoFormData";
import { TodoRepeat } from "./TodoRepeat";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const choiceOf = (todo: Pick<LocalTodo, "assigneeId" | "assigneeName"> | undefined): AssigneeChoice =>
  todo?.assigneeId
    ? { kind: "member", userId: todo.assigneeId }
    : todo?.assigneeName
      ? { kind: "name", name: todo.assigneeName }
      : { kind: "none" };

/**
 * A new todo's prefills besides its due day: quick entry's Edit (a member's
 * id only when they're one), and a link from a provider's, medication's or
 * appointment's page.
 */
export type TodoFormPrefill = {
  title?: string | null;
  assigneeId?: string | null;
  dueTime?: string | null;
  providerId?: string | null;
  medicationId?: string | null;
  eventId?: string | null;
};

/**
 * Add or edit a todo: the title, who does it, an optional due day with an
 * optional time (both in the recipient's zone), how it repeats (once it
 * has a day: planner-2), and optional links to a
 * provider, an appointment and a medication. Posts to its sheet
 * route's clientAction, which writes on the device; the shared Zod schema's
 * messages show on the fields.
 */
export function TodoForm({
  todo,
  members,
  meId,
  dueOn,
  prefill,
  links,
  zoneNote,
  onDone,
  onCancel,
}: {
  /** Editing this todo; omit to add one. */
  todo?: LocalTodo;
  members: readonly AssigneeMember[];
  meId: string;
  /** A new todo's due day (a prefill). */
  dueOn?: string | null;
  /** A new todo's title, assignee, due time and links. */
  prefill?: TodoFormPrefill;
  /** What the link pickers offer. */
  links: LinkChoices;
  /** "Times are Los Angeles time", when the device is elsewhere. */
  zoneNote: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";
  const [day, setDay] = useState(todo?.dueOn ?? dueOn ?? "");
  const [time, setTime] = useState(todo?.dueTime ?? prefill?.dueTime ?? "");
  const [repeat, setRepeat] = useState(() => initialRepeat(todo));

  // A save closes the sheet; a refusal moves focus to the first field it's about.
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) {
      onDone();
      return;
    }
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>(
        ':is([data-assignee-field], [data-link-picker]):has([data-picker-error]) :is(input:not([type="hidden"]), button)',
      );
    target?.focus();
  }, [fetcher.state, fetcher.data, onDone]);

  const unshown = issues.filter((i) => !isFieldIssue(i.path));
  const general =
    result && !result.ok && (issues.length === 0 || unshown.length > 0)
      ? (unshown[0]?.message ?? result.error)
      : undefined;
  const assigneeError = issueFor(issues, FIELD.assigneeId) ?? issueFor(issues, FIELD.assigneeName);

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-todo-form>
      <Field label="Todo" error={issueFor(issues, FIELD.title)}>
        {(control) => (
          <input
            {...control}
            name={FIELD.title}
            className="input w-full"
            maxLength={TODO_LIMITS.title}
            defaultValue={todo?.title ?? prefill?.title ?? ""}
            placeholder="e.g. Call the pharmacy"
            autoComplete="off"
            required
          />
        )}
      </Field>

      <AssigneeField
        members={members}
        meId={meId}
        initial={choiceOf(
          todo ??
            (prefill?.assigneeId && members.some((m) => m.userId === prefill.assigneeId)
              ? { assigneeId: prefill.assigneeId, assigneeName: null }
              : undefined),
        )}
        error={assigneeError}
      />

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Due (optional)" error={issueFor(issues, FIELD.dueOn)}>
          {(control) => (
            <input
              {...control}
              type="date"
              name={FIELD.dueOn}
              className="input w-full"
              value={day}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setDay(next);
                setRepeat((r) => repeatOnDay(r, next));
              }}
            />
          )}
        </Field>
        <Field label="Time (optional)" help={zoneNote ?? undefined} error={issueFor(issues, FIELD.dueTime)}>
          {(control) => (
            <input
              {...control}
              type="time"
              name={FIELD.dueTime}
              className="input w-full"
              value={time}
              onChange={(e) => setTime(e.currentTarget.value)}
              disabled={!day}
            />
          )}
        </Field>
      </div>

      <TodoRepeat
        day={day}
        dueTime={time}
        draft={repeat}
        onChange={setRepeat}
        error={issueFor(issues, FIELD.repeatRule)}
      />

      <TodoLinkFields
        choices={links}
        initial={{
          providerId: todo ? todo.providerId : (prefill?.providerId ?? null),
          eventId: todo ? todo.eventId : (prefill?.eventId ?? null),
          medicationId: todo ? todo.medicationId : (prefill?.medicationId ?? null),
        }}
        errors={{
          providerId: issueFor(issues, FIELD.providerId),
          eventId: issueFor(issues, FIELD.eventId),
          medicationId: issueFor(issues, FIELD.medicationId),
        }}
      />

      {general && (
        <p role="alert" className="text-error text-sm" data-form-error>
          {general}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {todo ? "Save" : "Add todo"}
        </button>
      </div>
    </fetcher.Form>
  );
}
