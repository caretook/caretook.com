// web:unit resolves apps/web's "~/" alias (tsconfig paths) as web:components
// does: a "~/" import is the same module as its relative path (B-375).
import { describe, expect, it } from "vitest";
import { initials as relative } from "../app/lib/core/initials";
import { initials } from "~/lib/core/initials";

describe("the ~/ alias under web:unit", () => {
  it("resolves to the same module as the relative import", () => {
    expect(initials).toBe(relative);
    expect(initials("Sam Rivera")).toBe("SR");
  });
});
