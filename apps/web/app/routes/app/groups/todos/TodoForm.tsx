import type { AssigneeChoice } from "./AssigneeField";
import type { AssigneeMember } from "./assigneeOptions";
import type { LinkChoices } from "./todoSheet";
import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { LocalTodo } from "~/lib/todos/todos.sync";

import { TODO_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Field, FormFooter, Message, TimeSelect } from "~/components/ui";
import { AssigneeField } from "./AssigneeField";
import { TodoLinkFields } from "./TodoLinkFields";
import { FIELD, initialRepeat, isFieldIssue, prefillRepeat, repeatOnDay } from "./todoFormData";
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
 * id only when they're one; a repeat only when its rule parses), and a link
 * from a provider's, medication's or appointment's page.
 */
export type TodoFormPrefill = {
  title?: string | null;
  assigneeId?: string | null;
  dueTime?: string | null;
  providerId?: string | null;
  medicationId?: string | null;
  /** An event to link (`todos/new?eventId=`): one of the starting `entryIds`. */
  eventId?: string | null;
  /** A live note or event to link (`todos/new?entryId=`): one of the starting `entryIds`. */
  entryId?: string | null;
  repeatRule?: string | null;
};

/**
 * Add or edit a todo: the title, who does it, an optional due day with an
 * optional time (both in the recipient's zone), how it repeats (once it
 * has a day: planner-2; none for a subtask or a todo with subtasks:
 * todo-subtasks), and optional links (the shared "Link to" box: a
 * provider, a medication, any notes and events). Posts to its sheet
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
  repeatable = true,
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
  /** False for a subtask or a todo with subtasks: no Repeat (todo-subtasks). */
  repeatable?: boolean;
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
  const [repeat, setRepeat] = useState(() =>
    todo ? initialRepeat(todo) : prefillRepeat(prefill?.repeatRule, dueOn),
  );

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
      <Field label="Todo" kind="input" required error={issueFor(issues, FIELD.title)}>
        {(control) => (
          <input
            {...control}
            name={FIELD.title}
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
        <Field label="Due" kind="input" error={issueFor(issues, FIELD.dueOn)}>
          {(control) => (
            <input
              {...control}
              type="date"
              name={FIELD.dueOn}
              value={day}
              onChange={(e) => {
                const next = e.currentTarget.value;
                setDay(next);
                setRepeat((r) => repeatOnDay(r, next));
              }}
            />
          )}
        </Field>
        <TimeSelect
          label="Time"
          name={FIELD.dueTime}
          optional
          help={zoneNote ?? undefined}
          error={issueFor(issues, FIELD.dueTime)}
          value={time}
          onChange={setTime}
          disabled={!day}
        />
      </div>

      {repeatable && (
        <TodoRepeat
          day={day}
          dueTime={time}
          draft={repeat}
          onChange={setRepeat}
          error={issueFor(issues, FIELD.repeatRule)}
        />
      )}

      <TodoLinkFields
        choices={links}
        todoId={todo?.id ?? null}
        initial={{
          providerId: todo ? todo.providerId : (prefill?.providerId ?? null),
          medicationId: todo ? todo.medicationId : (prefill?.medicationId ?? null),
          // An edited todo's notes and events are its link rows (read by the fields).
          entryIds: todo ? [] : [prefill?.eventId, prefill?.entryId].filter((id): id is string => !!id),
        }}
        errors={{
          providerId: issueFor(issues, FIELD.providerId),
          medicationId: issueFor(issues, FIELD.medicationId),
        }}
      />

      {general && (
        <Message tone="error" data-form-error="">
          {general}
        </Message>
      )}

      <FormFooter
        submitLabel={todo ? "Save" : "Add todo"}
        busy={busy}
        cancel={{ label: "Cancel", onCancel }}
        className="pt-3"
      />
    </fetcher.Form>
  );
}
