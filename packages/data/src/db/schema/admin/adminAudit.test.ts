import { describe, expect, it } from "vitest";
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, auditChanges, auditFilterZSchema } from "./adminAudit";

describe("auditChanges", () => {
  it("keeps only the listed fields", () => {
    const before = { role: "member", name: "Sam", notes: "care detail" };
    const after = { role: "support", name: "Samuel", notes: "another care detail" };
    expect(auditChanges(before, after, ["role"])).toEqual({ role: ["member", "support"] });
  });

  it("leaves out fields that didn't change", () => {
    expect(
      auditChanges({ role: "admin", label: "x" }, { role: "admin", label: "y" }, ["role", "label"]),
    ).toEqual({
      label: ["x", "y"],
    });
  });

  it("reads a missing row or field as null", () => {
    expect(auditChanges(null, { label: "Flyer", maxUses: undefined }, ["label", "maxUses"])).toEqual({
      label: [null, "Flyer"],
    });
    expect(auditChanges({ label: "Flyer" }, undefined, ["label"])).toEqual({ label: ["Flyer", null] });
  });

  it("stores dates as ISO strings and compares objects by value", () => {
    const at = new Date("2026-11-19T10:00:00Z");
    expect(auditChanges({}, { when: at }, ["when"])).toEqual({ when: [null, "2026-11-19T10:00:00.000Z"] });
    expect(auditChanges({ list: ["a"] }, { list: ["a"] }, ["list"])).toEqual({});
  });
});

describe("the action list", () => {
  it("labels every action", () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toBeTruthy();
  });

  it("filters only known actions and real days", () => {
    expect(auditFilterZSchema.safeParse({ action: "accessCode.create", from: "2026-11-01" }).success).toBe(
      true,
    );
    expect(auditFilterZSchema.safeParse({ action: "user.delete" }).success).toBe(false);
    expect(auditFilterZSchema.safeParse({ from: "2026-02-31x" }).success).toBe(false);
  });
});
