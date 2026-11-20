import { describe, expect, it } from "vitest";
import { basicsValues, parseBasics } from "./basicsFormData";

const EMPTY = {
  name: "",
  preferredName: "",
  dateOfBirth: "",
  codeStatus: "",
  bloodType: "",
  primaryLanguage: "",
  pronouns: "",
  notes: "",
};

describe("parseBasics", () => {
  it("trims text and keeps every field", () => {
    expect(
      parseBasics({
        name: " Pat Example ",
        preferredName: " Pat ",
        dateOfBirth: "1941-03-09",
        codeStatus: "dnrPolst",
        bloodType: "O-",
        primaryLanguage: " English ",
        pronouns: "she/her",
        notes: " Hard of hearing on the left. ",
      }),
    ).toEqual({
      ok: true,
      data: {
        name: "Pat Example",
        preferredName: "Pat",
        dateOfBirth: "1941-03-09",
        codeStatus: "dnrPolst",
        bloodType: "O-",
        primaryLanguage: "English",
        pronouns: "she/her",
        notes: "Hard of hearing on the left.",
      },
    });
  });

  it("clears every empty optional field", () => {
    expect(parseBasics({ ...EMPTY, name: "Pat Example", preferredName: "  ", notes: " \n " })).toEqual({
      ok: true,
      data: {
        name: "Pat Example",
        preferredName: null,
        dateOfBirth: null,
        codeStatus: null,
        bloodType: null,
        primaryLanguage: null,
        pronouns: null,
        notes: null,
      },
    });
  });

  it("refuses an empty name", () => {
    expect(parseBasics({ ...EMPTY, name: "  " })).toMatchObject({
      ok: false,
      issues: [{ path: "name", message: "Enter a name." }],
    });
  });

  it("refuses a birthday that isn't a date", () => {
    for (const dateOfBirth of ["not a date", "1941-02-30", "03/09/1941"]) {
      expect(parseBasics({ ...EMPTY, name: "Pat", dateOfBirth })).toMatchObject({
        ok: false,
        issues: [{ path: "dateOfBirth", message: "Enter a valid date." }],
      });
    }
  });

  it("refuses a code status or blood type that isn't one of the options", () => {
    const result = parseBasics({ ...EMPTY, name: "Pat", codeStatus: "maybe", bloodType: "C+" });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.issues).toEqual([
      { path: "codeStatus", message: "Choose one of the options." },
      { path: "bloodType", message: "Choose one of the options." },
    ]);
  });

  it("says each text field's own limit", () => {
    const result = parseBasics({
      ...EMPTY,
      name: "x".repeat(121),
      pronouns: "x".repeat(41),
      primaryLanguage: "x".repeat(61),
      notes: "x".repeat(1001),
    });
    expect(!result.ok && result.issues).toEqual([
      { path: "name", message: "Use 120 characters or fewer." },
      { path: "primaryLanguage", message: "Use 60 characters or fewer." },
      { path: "pronouns", message: "Use 40 characters or fewer." },
      { path: "notes", message: "Use 1000 characters or fewer." },
    ]);
  });

  it("accepts text at its limit", () => {
    expect(parseBasics({ ...EMPTY, name: "Pat", notes: "x".repeat(1000) })).toMatchObject({ ok: true });
  });
});

describe("basicsValues", () => {
  it("reads every field, a missing one as empty", () => {
    const form = new FormData();
    form.set("name", "Pat");
    form.set("codeStatus", "dnr");
    expect(basicsValues(form)).toEqual({ ...EMPTY, name: "Pat", codeStatus: "dnr" });
  });
});
