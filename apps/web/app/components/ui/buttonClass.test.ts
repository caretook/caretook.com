import type { ButtonVariant } from "./buttonClass";

import { describe, expect, it } from "vitest";
import { buttonClass } from "./buttonClass";

const classes = (look: Parameters<typeof buttonClass>[0]) => buttonClass(look).split(" ");

describe("buttonClass", () => {
  it("is a plain, secondary, medium, rounded button by default", () => {
    expect(buttonClass()).toBe("btn");
    expect(buttonClass({ variant: "secondary", size: "md", shape: "rounded" })).toBe(buttonClass());
  });

  it.each([
    ["primary", ["btn", "btn-primary"]],
    ["secondary", ["btn"]],
    ["ghost", ["btn", "btn-ghost"]],
    ["danger", ["btn", "btn-error"]],
    ["dangerQuiet", ["btn", "btn-ghost", "text-error"]],
  ] as const)("maps the %s variant", (variant, expected) => {
    expect(classes({ variant })).toEqual(expected);
  });

  it("has no variant named default any more (the typecheck holds it)", () => {
    // @ts-expect-error -- `default` was renamed `secondary`.
    const removed: ButtonVariant = "default";
    expect(classes({ variant: removed })).toEqual(["btn"]);
  });

  it.each([
    ["lg", ["btn", "btn-lg"]],
    ["md", ["btn"]],
    ["sm", ["btn", "btn-sm"]],
    ["xs", ["btn", "btn-xs"]],
  ] as const)("maps the %s size", (size, expected) => {
    expect(classes({ size })).toEqual(expected);
  });

  it.each([
    ["rounded", ["btn"]],
    ["pill", ["btn", "rounded-full"]],
    ["square", ["btn", "btn-square"]],
    ["round", ["btn", "btn-circle"]],
  ] as const)("maps the %s shape", (shape, expected) => {
    expect(classes({ shape })).toEqual(expected);
  });

  it("goes full width with block", () => {
    expect(classes({ variant: "primary", block: true })).toEqual(["btn", "btn-primary", "btn-block"]);
  });

  it("combines a variant, a size and a shape", () => {
    expect(classes({ variant: "ghost", size: "sm", shape: "square" })).toEqual([
      "btn",
      "btn-ghost",
      "btn-sm",
      "btn-square",
    ]);
    expect(classes({ variant: "primary", size: "lg", shape: "pill" })).toEqual([
      "btn",
      "btn-primary",
      "btn-lg",
      "rounded-full",
    ]);
  });

  it("gives a toggle a filled look when on and an outlined ghost when off, whatever the variant", () => {
    expect(classes({ variant: "primary", size: "sm", shape: "square", pressed: true })).toEqual([
      "btn",
      "btn-sm",
      "btn-square",
      "btn-neutral",
    ]);
    expect(classes({ variant: "primary", size: "sm", shape: "square", pressed: false })).toEqual([
      "btn",
      "btn-ghost",
      "btn-sm",
      "btn-square",
      "border-base-300",
      "bg-base-100",
    ]);
  });

  it("gives the quiet danger button no solid fill", () => {
    const quiet = classes({ variant: "dangerQuiet" });
    expect(quiet).not.toContain("btn-error");
    expect(quiet.some((c) => c.startsWith("bg-"))).toBe(false);
    expect(quiet).toContain("btn-ghost");
  });
});
