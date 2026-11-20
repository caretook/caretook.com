import type { TaskInput } from "~/lib/sync/tasks";

// The task sheet's form (pure; web:unit tests it): its field names, and the
// posted form as a write's input. Empty fields mean none.

export const FIELD = {
  title: "title",
  assigneeId: "assigneeId",
  assigneeName: "assigneeName",
  dueOn: "dueOn",
  dueTime: "dueTime",
} as const;

/** The fields the form shows issues on; anything else is the form's general message. */
export const isFieldIssue = (path: string) => (Object.values(FIELD) as string[]).includes(path);

const value = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** The form as a create or update. A time without a day is kept, so the schema can say so. */
export const taskFromForm = (form: FormData): TaskInput => ({
  title: typeof form.get(FIELD.title) === "string" ? (form.get(FIELD.title) as string) : "",
  assigneeId: value(form, FIELD.assigneeId),
  assigneeName: value(form, FIELD.assigneeName),
  dueOn: value(form, FIELD.dueOn),
  dueTime: value(form, FIELD.dueTime),
});
