import type { AssigneeChoice } from "./AssigneeField";
import type { AssigneeMember } from "./assigneeOptions";
import type { ActionResult, FieldIssue } from "~/lib/api";
import type { LocalTask } from "~/lib/sync/tasks";

import { TASK_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Field } from "~/components/ui";
import { AssigneeField } from "./AssigneeField";
import { FIELD, isFieldIssue } from "./taskFormData";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const choiceOf = (task: LocalTask | undefined): AssigneeChoice =>
  task?.assigneeId
    ? { kind: "member", userId: task.assigneeId }
    : task?.assigneeName
      ? { kind: "name", name: task.assigneeName }
      : { kind: "none" };

/**
 * Add or edit a task: the title, who does it, and an optional due day with
 * an optional time (both in the recipient's zone). Posts to its sheet
 * route's clientAction, which writes on the device; the shared Zod schema's
 * messages show on the fields.
 */
export function TaskForm({
  task,
  members,
  meId,
  dueOn,
  zoneNote,
  onDone,
  onCancel,
}: {
  /** Editing this task; omit to add one. */
  task?: LocalTask;
  members: readonly AssigneeMember[];
  meId: string;
  /** A new task's due day (a prefill). */
  dueOn?: string | null;
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
  const [day, setDay] = useState(task?.dueOn ?? dueOn ?? "");

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
        '[data-assignee-field]:has([data-picker-error]) input:not([type="hidden"])',
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
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-task-form>
      <Field label="Task" error={issueFor(issues, FIELD.title)}>
        {(control) => (
          <input
            {...control}
            name={FIELD.title}
            className="input w-full"
            maxLength={TASK_LIMITS.title}
            defaultValue={task?.title ?? ""}
            placeholder="e.g. Call the pharmacy"
            autoComplete="off"
            required
          />
        )}
      </Field>

      <AssigneeField members={members} meId={meId} initial={choiceOf(task)} error={assigneeError} />

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Due (optional)" error={issueFor(issues, FIELD.dueOn)}>
          {(control) => (
            <input
              {...control}
              type="date"
              name={FIELD.dueOn}
              className="input w-full"
              value={day}
              onChange={(e) => setDay(e.currentTarget.value)}
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
              defaultValue={task?.dueTime ?? ""}
              disabled={!day}
            />
          )}
        </Field>
      </div>

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
          {task ? "Save" : "Add task"}
        </button>
      </div>
    </fetcher.Form>
  );
}
