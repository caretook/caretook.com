import { describe, expect, it } from "vitest";
import { adminLink } from "./adminLink";

describe("adminLink", () => {
  it("is for staff only", () => {
    expect(adminLink("member")).toBeNull();
    expect(adminLink(undefined)).toBeNull();
    expect(adminLink(null, "https://caretook.com")).toBeNull();
  });

  it("is a path on the web", () => {
    expect(adminLink("admin")).toEqual({ kind: "path", href: "/admin" });
    expect(adminLink("support", "")).toEqual({ kind: "path", href: "/admin" });
  });

  it("opens the web /admin from the native build", () => {
    expect(adminLink("support", "https://caretook.com/")).toEqual({
      kind: "external",
      href: "https://caretook.com/admin",
    });
  });
});
