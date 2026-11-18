import { describe, expect, it } from "vitest";
import {
  formatDateOfBirth,
  groupSettingsAccess,
  parseGroupName,
  parseRecipientProfile,
} from "./groupSettings";

const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";

describe("groupSettingsAccess", () => {
  it("lets owners and admins rename the group and edit the recipient", () => {
    for (const role of ["owner", "admin"]) {
      expect(groupSettingsAccess(GROUP, role)).toEqual({ renameGroup: true, editRecipient: true });
    }
  });
  it("lets caretakers edit the recipient only", () => {
    expect(groupSettingsAccess(GROUP, "caretaker")).toEqual({ renameGroup: false, editRecipient: true });
  });
  it("gives viewers, and anyone without a role, nothing to edit", () => {
    expect(groupSettingsAccess(GROUP, "viewer")).toEqual({ renameGroup: false, editRecipient: false });
    expect(groupSettingsAccess(GROUP, null)).toEqual({ renameGroup: false, editRecipient: false });
  });
});

describe("parseGroupName", () => {
  it("trims a name", () => {
    expect(parseGroupName({ name: "  The Example Family " })).toEqual({
      ok: true,
      data: { name: "The Example Family" },
    });
  });
  it("refuses an empty or blank name with the field's error", () => {
    for (const name of ["", "   "]) {
      expect(parseGroupName({ name })).toMatchObject({
        ok: false,
        issues: [{ path: "name", message: "Enter a name." }],
      });
    }
  });
  it("refuses a name over 120 characters", () => {
    expect(parseGroupName({ name: "x".repeat(121) })).toMatchObject({
      ok: false,
      issues: [{ path: "name", message: "Use 120 characters or fewer." }],
    });
  });
});

describe("parseRecipientProfile", () => {
  it("trims names and keeps a date", () => {
    expect(
      parseRecipientProfile({ name: " Pat Example ", preferredName: " Pat ", dateOfBirth: "1941-03-09" }),
    ).toEqual({ ok: true, data: { name: "Pat Example", preferredName: "Pat", dateOfBirth: "1941-03-09" } });
  });
  it("clears an empty preferred name and date of birth", () => {
    expect(parseRecipientProfile({ name: "Pat Example", preferredName: "  ", dateOfBirth: "" })).toEqual({
      ok: true,
      data: { name: "Pat Example", preferredName: null, dateOfBirth: null },
    });
  });
  it("refuses an empty name", () => {
    expect(parseRecipientProfile({ name: " ", preferredName: "", dateOfBirth: "" })).toMatchObject({
      ok: false,
      issues: [{ path: "name", message: "Enter a name." }],
    });
  });
  it("refuses a date of birth that isn't a date", () => {
    for (const dateOfBirth of ["not a date", "1941-02-30", "03/09/1941"]) {
      expect(parseRecipientProfile({ name: "Pat Example", preferredName: "", dateOfBirth })).toMatchObject({
        ok: false,
        issues: [{ path: "dateOfBirth", message: "Enter a valid date." }],
      });
    }
  });
  it("accepts a future date (the shared schema has no such rule)", () => {
    expect(
      parseRecipientProfile({ name: "Pat Example", preferredName: "", dateOfBirth: "2999-01-01" }),
    ).toMatchObject({ ok: true });
  });
  it("reports every invalid field once", () => {
    const result = parseRecipientProfile({ name: "", preferredName: "x".repeat(121), dateOfBirth: "nope" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((i) => i.path).sort()).toEqual([
      "dateOfBirth",
      "name",
      "preferredName",
    ]);
  });
});

describe("formatDateOfBirth", () => {
  it("shows the stored day whatever the device's zone", () => {
    expect(formatDateOfBirth("1941-03-09", "en-US")).toBe("March 9, 1941");
  });
  it("falls back to the stored text", () => {
    expect(formatDateOfBirth("unknown")).toBe("unknown");
  });
});
