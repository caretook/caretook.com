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
        form({ title: "Call", assigneeId: "", assigneeName: " Aunt May ", dueOn: "2026-11-20", dueTime: "" }),
      ),
    ).toEqual({
      title: "Call",
      assigneeId: null,
      assigneeName: "Aunt May",
      dueOn: "2026-11-20",
      dueTime: null,
    });
    expect(taskFromForm(form({}))).toEqual({
      title: "",
      assigneeId: null,
      assigneeName: null,
      dueOn: null,
      dueTime: null,
    });
  });

  it("knows which issues the fields show", () => {
    expect(isFieldIssue("dueTime")).toBe(true);
    expect(isFieldIssue("providerId")).toBe(false);
  });
});
