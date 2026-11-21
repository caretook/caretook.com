import { describe, expect, it } from "vitest";
import { badgeClass, STATUS_TONE } from "./badgeClass";

const classes = (tone?: Parameters<typeof badgeClass>[0]) => badgeClass(tone).split(" ");

describe("badgeClass", () => {
  it("is a small soft neutral badge by default", () => {
    expect(classes()).toEqual(["badge", "badge-sm", "badge-soft", "badge-neutral"]);
  });

  it.each([
    ["neutral", "badge-neutral"],
    ["primary", "badge-primary"],
    ["success", "badge-success"],
    ["warning", "badge-warning"],
    ["danger", "badge-error"],
    ["info", "badge-info"],
  ] as const)("maps the %s tone", (tone, colour) => {
    expect(classes(tone)).toEqual(["badge", "badge-sm", "badge-soft", colour]);
  });

  it("is always one size and soft, never outlined or ghost", () => {
    for (const tone of ["neutral", "primary", "success", "warning", "danger", "info"] as const) {
      const c = classes(tone);
      expect(c.filter((x) => /^badge-(xs|sm|md|lg|xl)$/.test(x))).toEqual(["badge-sm"]);
      expect(c).toContain("badge-soft");
      expect(c).not.toContain("badge-outline");
      expect(c).not.toContain("badge-ghost");
    }
  });
});

describe("the status tones table", () => {
  it("gives each status its one tone", () => {
    expect(STATUS_TONE).toEqual({
      current: "primary",
      past: "neutral",
      overdue: "danger",
      dueSoon: "warning",
      done: "success",
    });
  });
});
