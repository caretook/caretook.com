import { describe, expect, it } from "vitest";

import { fieldControl, fieldControlClass } from "./fieldIds";

describe("fieldControl", () => {
  it("is just the id with no help or error", () => {
    expect(fieldControl("f", {})).toEqual({ id: "f" });
  });

  it("is described by its help", () => {
    expect(fieldControl("f", { help: true })).toEqual({ id: "f", "aria-describedby": "f-help" });
  });

  it("is invalid and described by its error, after its help", () => {
    expect(fieldControl("f", { help: true, error: true })).toEqual({
      id: "f",
      "aria-invalid": true,
      "aria-describedby": "f-help f-error",
    });
    expect(fieldControl("f", { error: true })).toEqual({
      id: "f",
      "aria-invalid": true,
      "aria-describedby": "f-error",
    });
  });

  it("is described by its warning, unless there's an error", () => {
    expect(fieldControl("f", { warning: true })).toEqual({ id: "f", "aria-describedby": "f-warn" });
    expect(fieldControl("f", { help: true, warning: true })).toEqual({
      id: "f",
      "aria-describedby": "f-help f-warn",
    });
    expect(fieldControl("f", { error: true, warning: true })).toEqual({
      id: "f",
      "aria-invalid": true,
      "aria-describedby": "f-error",
    });
  });
});

describe("fieldControlClass", () => {
  it("is the kind's daisyUI class at full width, with its error style while there's an error", () => {
    expect(fieldControlClass("input", false)).toBe("input w-full");
    expect(fieldControlClass("select", true)).toBe("select select-error w-full");
    expect(fieldControlClass("textarea", true)).toBe("textarea textarea-error w-full");
  });
});
