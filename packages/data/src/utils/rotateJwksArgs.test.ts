import { describe, expect, it } from "vitest";
import { parseRotateJwksArgs } from "./rotateJwksArgs";

describe("parseRotateJwksArgs", () => {
  it("takes an optional reason", () => {
    expect(parseRotateJwksArgs([])).toEqual({});
    expect(parseRotateJwksArgs(["--", "--reason", " secret rotated "])).toEqual({ reason: "secret rotated" });
    expect(parseRotateJwksArgs(["--reason=suspected leak"])).toEqual({ reason: "suspected leak" });
  });

  it("refuses anything else", () => {
    expect(parseRotateJwksArgs(["--reason"])).toEqual({ error: "--reason needs a value" });
    expect(parseRotateJwksArgs(["--force"])).toEqual({ error: "Unknown option --force" });
    expect(parseRotateJwksArgs(["now"])).toEqual({ error: "Unexpected argument now" });
    expect(parseRotateJwksArgs(["--reason", "x".repeat(501)])).toEqual({
      error: "--reason is 1–500 characters",
    });
  });
});
