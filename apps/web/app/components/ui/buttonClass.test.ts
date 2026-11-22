import { describe, expect, it } from "vitest";
import { buttonClass } from "./buttonClass";

const classes = (look: Parameters<typeof buttonClass>[0]) => buttonClass(look).split(" ");

describe("buttonClass", () => {
  it("is a plain medium button by default", () => {
    expect(buttonClass()).toBe("btn");
  });

  it.each([
    ["primary", ["btn", "btn-primary"]],
    ["default", ["btn"]],
    ["ghost", ["btn", "btn-ghost"]],
    ["danger", ["btn", "btn-error"]],
    ["dangerQuiet", ["btn", "btn-ghost", "text-error"]],
  ] as const)("maps the %s variant", (variant, expected) => {
    expect(classes({ variant })).toEqual(expected);
  });

  it.each([
    ["md", ["btn"]],
    ["sm", ["btn", "btn-sm"]],
    ["xs", ["btn", "btn-xs"]],
  ] as const)("maps the %s size", (size, expected) => {
    expect(classes({ size })).toEqual(expected);
  });

  it("goes full width with block", () => {
    expect(classes({ variant: "primary", block: true })).toEqual(["btn", "btn-primary", "btn-block"]);
  });

  it("takes an icon-only shape", () => {
    expect(classes({ variant: "ghost", size: "sm", shape: "square" })).toEqual([
      "btn",
      "btn-ghost",
      "btn-sm",
      "btn-square",
    ]);
    expect(classes({ shape: "circle" })).toEqual(["btn", "btn-circle"]);
  });

  it("gives the quiet danger button no solid fill", () => {
    const quiet = classes({ variant: "dangerQuiet" });
    expect(quiet).not.toContain("btn-error");
    expect(quiet.some((c) => c.startsWith("bg-"))).toBe(false);
    expect(quiet).toContain("btn-ghost");
  });
});
