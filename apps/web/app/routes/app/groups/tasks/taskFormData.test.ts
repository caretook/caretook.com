import { describe, expect, it } from "vitest";
import { isFieldIssue, taskFromForm } from "./taskFormData";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("taskFromForm", () => {
  it("reads the fields, empty ones as none", () => {
    expect(
      taskFromForm(
        form({
          title: "Call",
          assigneeId: "",
          assigneeName: " Aunt May ",
          dueOn: "2026-11-20",
          dueTime: "",
          providerId: "p1",
          medicationId: "",
          eventId: "e1",
        }),
      ),
    ).toEqual({
      title: "Call",
      assigneeId: null,
      assigneeName: "Aunt May",
      dueOn: "2026-11-20",
      dueTime: null,
      providerId: "p1",
      medicationId: null,
      eventId: "e1",
    });
    expect(taskFromForm(form({}))).toEqual({
      title: "",
      assigneeId: null,
      assigneeName: null,
      dueOn: null,
      dueTime: null,
      providerId: null,
      medicationId: null,
      eventId: null,
    });
  });

  it("knows which issues the fields show", () => {
    expect(isFieldIssue("dueTime")).toBe(true);
    expect(isFieldIssue("providerId")).toBe(true);
    expect(isFieldIssue("groupId")).toBe(false);
  });
});
