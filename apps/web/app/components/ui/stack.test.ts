import { describe, expect, it } from "vitest";

import { splitStack } from "./stack";

describe("splitStack", () => {
  it("shows everyone up to the limit", () => {
    expect(splitStack(["a", "b"], 3)).toEqual({ shown: ["a", "b"], extra: 0 });
    expect(splitStack(["a", "b", "c"], 3)).toEqual({ shown: ["a", "b", "c"], extra: 0 });
  });

  it("counts the rest past the limit, in order", () => {
    expect(splitStack(["a", "b", "c", "d", "e"], 3)).toEqual({ shown: ["a", "b", "c"], extra: 2 });
  });

  it("handles nobody and a zero limit", () => {
    expect(splitStack([], 3)).toEqual({ shown: [], extra: 0 });
    expect(splitStack(["a"], 0)).toEqual({ shown: [], extra: 1 });
  });
});
