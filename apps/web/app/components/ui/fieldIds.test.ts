import { describe, expect, it } from "vitest";

import { fieldControl } from "./fieldIds";

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
});
