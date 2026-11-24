import type { UnsavedRecord } from "./unsavedChanges";

import { describe, expect, it } from "vitest";
import { canTryAgain, unsavedLines, unsavedSentence } from "./unsavedChanges";

const sentence = (over: Partial<Parameters<typeof unsavedSentence>[0]>) =>
  unsavedSentence({ table: "medication", op: "PATCH", code: "x:y", issues: [], label: null, ...over });

describe("unsavedSentence", () => {
  it("names the kind and its label, with the reason for each ordinary cause", () => {
    expect(sentence({ code: "permissions:unauthorized", label: "Lisinopril" })).toBe(
      "Your change to the medication “Lisinopril” wasn't saved: you can't edit in this group any more",
    );
    expect(sentence({ table: "provider", code: "providerService:notFound", label: "Dr. Example" })).toBe(
      "Your change to the provider “Dr. Example” wasn't saved: it isn't there any more",
    );
    expect(sentence({ table: "todo", code: "todoService:immutable", label: "Pick up groceries" })).toBe(
      "Your change to the to-do “Pick up groceries” wasn't saved: it can't move to another group or person",
    );
    expect(
      sentence({
        table: "timeline_entry",
        op: "PUT",
        code: "timelineEntryService:invalid",
        issues: [{ path: "title", message: "Title is too long." }],
        label: "Walk",
      }),
    ).toBe("Your new entry “Walk” wasn't saved: it wasn't valid (Title is too long)");
    expect(sentence({ table: "care_recipient", code: "sync:readOnlyTable", label: "Sam" })).toBe(
      "Your change to the profile “Sam” wasn't saved: it can't be changed from this device",
    );
    expect(sentence({ table: "todo", code: "todoService:completionOnly", label: "Bins" })).toBe(
      "Your change to the to-do “Bins” wasn't saved: you can only tick or reopen to-dos assigned to you",
    );
  });

  it("says the server couldn't save a set-aside change (B-286)", () => {
    expect(sentence({ code: "sync:failed", label: "Lisinopril" })).toBe(
      "Your change to the medication “Lisinopril” wasn't saved: the server couldn't save this",
    );
    expect(canTryAgain({ outcome: "set_aside" })).toBe(true);
    expect(canTryAgain({ outcome: "refused" })).toBe(false);
  });

  it("names the kind alone without a label", () => {
    expect(sentence({ op: "DELETE", code: "permissions:unauthorized" })).toBe(
      "Your deletion of the medication wasn't saved: you can't edit in this group any more",
    );
    expect(sentence({ table: "care_period", op: "PUT", code: "carePeriodService:invalid" })).toBe(
      "Your new care period wasn't saved: it wasn't valid",
    );
  });

  it("falls back to the kind and the server's issue messages for an unknown code", () => {
    expect(
      sentence({
        code: "medicationService:somethingNew",
        issues: [
          { path: "schedule", message: "Pick a time." },
          { path: "dose", message: "Too large" },
        ],
        label: "Lisinopril",
      }),
    ).toBe("Your change to the medication “Lisinopril” wasn't saved: Pick a time; Too large");
    expect(sentence({ code: "medicationService:somethingNew" })).toBe(
      "Your change to the medication wasn't saved: the server refused it",
    );
    expect(sentence({ table: "reminder", code: "sync:readOnlyTable" })).toBe(
      "A change wasn't saved: it can't be changed from this device",
    );
  });
});

const record = (over: Partial<UnsavedRecord>): UnsavedRecord => ({
  id: crypto.randomUUID(),
  recordedAt: "2027-06-09T12:00:00.000Z",
  tableName: "medication",
  rowId: "m1",
  op: "PATCH",
  data: null,
  code: "permissions:unauthorized",
  issues: null,
  outcome: "refused",
  label: null,
  lineKey: "medication:m1",
  ...over,
});

describe("unsavedLines", () => {
  it("puts the newest line first, and a row's records on one line with a count", () => {
    const lines = unsavedLines([
      record({ id: "a", recordedAt: "2027-06-09T10:00:00.000Z", label: "Lisinopril" }),
      record({ id: "b", recordedAt: "2027-06-09T11:00:00.000Z", rowId: "p1", lineKey: "provider:p1" }),
      record({ id: "c", recordedAt: "2027-06-09T12:00:00.000Z" }),
    ]);
    expect(lines.map((l) => [l.key, l.count, l.ids])).toEqual([
      ["medication:m1", 2, ["c", "a"]],
      ["provider:p1", 1, ["b"]],
    ]);
    expect(lines[0]?.label).toBe("Lisinopril");
  });

  it("reads a note's updates as its document", () => {
    const [line] = unsavedLines([
      record({ tableName: "note_update", rowId: "u1", op: "PUT", lineKey: "note_document:d1" }),
    ]);
    expect(line).toMatchObject({ table: "note_document", count: 1, op: "PUT" });
  });

  it("parses the issues, and ignores ones it can't read", () => {
    const [ok] = unsavedLines([record({ issues: JSON.stringify([{ path: "a", message: "Bad" }]) })]);
    expect(ok?.issues).toEqual([{ path: "a", message: "Bad" }]);
    const [broken] = unsavedLines([record({ issues: "{not json" })]);
    expect(broken?.issues).toEqual([]);
  });
});
