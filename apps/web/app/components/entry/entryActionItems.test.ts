import { describe, expect, it } from "vitest";
import { entryActionItems } from "./entryActionItems";

describe("entryActionItems", () => {
  it("gives symptoms and vitals Edit, then Delete", () => {
    expect(entryActionItems("symptom", { canEdit: true })).toEqual(["edit", "delete"]);
    expect(entryActionItems("vital", { canEdit: true })).toEqual(["edit", "delete"]);
  });

  it("never gives notes or events Edit (they're edited on their page)", () => {
    expect(entryActionItems("note", { canEdit: true })).toEqual(["delete"]);
    expect(entryActionItems("event", { canEdit: true })).toEqual(["delete"]);
    expect(entryActionItems("note", { canEdit: false })).toEqual(["delete"]);
  });

  it("gives doses Edit, then Delete, and medication changes Delete only", () => {
    expect(entryActionItems("dose", { canEdit: true })).toEqual(["edit", "delete"]);
    expect(entryActionItems("medicationChange", { canEdit: true })).toEqual(["delete"]);
  });

  it("drops Edit when there's nothing to edit with", () => {
    expect(entryActionItems("symptom", { canEdit: false })).toEqual(["delete"]);
  });

  it("gives an event Cancel before Delete, or Undo cancel once it's cancelled", () => {
    expect(entryActionItems("event", { canEdit: false, canCancel: true })).toEqual(["cancel", "delete"]);
    expect(entryActionItems("event", { canEdit: false, canCancel: true, cancelled: true })).toEqual([
      "uncancel",
      "delete",
    ]);
  });

  it("gives Cancel to events only", () => {
    for (const kind of ["note", "symptom", "vital", "dose", "medicationChange"] as const)
      expect(entryActionItems(kind, { canEdit: false, canCancel: true })).not.toContain("cancel");
    expect(entryActionItems("symptom", { canEdit: true, canCancel: true })).toEqual(["edit", "delete"]);
  });

  it("gives no Cancel when the caller can't cancel (no handler)", () => {
    expect(entryActionItems("event", { canEdit: false, cancelled: true })).toEqual(["delete"]);
  });

  it("gives an event Reschedule before Cancel (or Undo cancel), events only", () => {
    expect(entryActionItems("event", { canEdit: false, canCancel: true, canReschedule: true })).toEqual([
      "reschedule",
      "cancel",
      "delete",
    ]);
    expect(
      entryActionItems("event", { canEdit: false, canCancel: true, cancelled: true, canReschedule: true }),
    ).toEqual(["reschedule", "uncancel", "delete"]);
    for (const kind of ["note", "symptom", "vital", "dose", "medicationChange"] as const)
      expect(entryActionItems(kind, { canEdit: true, canReschedule: true })).not.toContain("reschedule");
  });

  it("gives no Reschedule when the caller can't reschedule (a viewer, or one already rescheduled)", () => {
    expect(entryActionItems("event", { canEdit: false, canCancel: true })).toEqual(["cancel", "delete"]);
  });

  it("gives an event the caller can prepare Prepare, after Edit and before Reschedule", () => {
    expect(
      entryActionItems("event", { canEdit: false, canCancel: true, canReschedule: true, canPrepare: true }),
    ).toEqual(["prepare", "reschedule", "cancel", "delete"]);
    for (const kind of ["note", "symptom", "vital", "dose", "medicationChange"] as const)
      expect(entryActionItems(kind, { canEdit: true, canPrepare: true })).not.toContain("prepare");
  });

  it("gives notes and events Print before Delete, and other kinds none", () => {
    expect(entryActionItems("note", { canEdit: true, canPrint: true })).toEqual(["print", "delete"]);
    expect(entryActionItems("event", { canEdit: false, canCancel: true, canPrint: true })).toEqual([
      "cancel",
      "print",
      "delete",
    ]);
    for (const kind of ["symptom", "vital", "dose", "medicationChange"] as const)
      expect(entryActionItems(kind, { canEdit: true, canPrint: true })).not.toContain("print");
  });

  it("gives a viewer (no Delete) Print alone", () => {
    expect(entryActionItems("event", { canEdit: false, canPrint: true, canDelete: false })).toEqual([
      "print",
    ]);
    expect(entryActionItems("note", { canEdit: false, canPrint: true, canDelete: false })).toEqual(["print"]);
    expect(entryActionItems("symptom", { canEdit: false, canDelete: false })).toEqual([]);
  });

  it("gives a series visit Edit first (notes and events only)", () => {
    expect(
      entryActionItems("event", {
        canEdit: false,
        canEditSeries: true,
        canCancel: true,
        canReschedule: true,
      }),
    ).toEqual(["editSeries", "reschedule", "cancel", "delete"]);
    expect(entryActionItems("note", { canEdit: false, canEditSeries: true })).toEqual([
      "editSeries",
      "delete",
    ]);
    expect(entryActionItems("symptom", { canEdit: true, canEditSeries: true })).toEqual(["edit", "delete"]);
  });
});

describe("entryActionItems, Remind me", () => {
  it("comes before Print, for an event, viewers included", () => {
    expect(entryActionItems("event", { canEdit: false, canRemind: true, canPrint: true })).toEqual([
      "remind",
      "print",
      "delete",
    ]);
  });

  it("is never offered for a note", () => {
    expect(
      entryActionItems("note", { canEdit: false, canRemind: true, canPrint: true, canDelete: false }),
    ).toEqual(["print"]);
  });

  it("is never offered for other kinds or unless asked", () => {
    expect(entryActionItems("symptom", { canEdit: true, canRemind: true })).not.toContain("remind");
    expect(entryActionItems("event", { canEdit: false, canPrint: true })).not.toContain("remind");
  });
});

describe("entryActionItems, Copy link", () => {
  it("comes before Delete for writers, every kind", () => {
    expect(entryActionItems("symptom", { canEdit: true, canCopyLink: true })).toEqual([
      "edit",
      "copyLink",
      "delete",
    ]);
    expect(entryActionItems("note", { canEdit: false, canPrint: true, canCopyLink: true })).toEqual([
      "print",
      "copyLink",
      "delete",
    ]);
  });

  it("is a reader's too: after Print, or alone where their menu had nothing", () => {
    expect(
      entryActionItems("note", { canEdit: false, canPrint: true, canDelete: false, canCopyLink: true }),
    ).toEqual(["print", "copyLink"]);
    expect(entryActionItems("symptom", { canEdit: false, canDelete: false, canCopyLink: true })).toEqual([
      "copyLink",
    ]);
  });

  it("is never offered unless asked (Upcoming and the entry page)", () => {
    expect(entryActionItems("event", { canEdit: false, canPrint: true })).not.toContain("copyLink");
  });
});
