import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";
import { safeRedirect, signInUrl } from "./redirect";

describe("signInUrl", () => {
  const request = new Request("http://localhost/app/groups/g1/timeline?kind=note");

  it("comes back to the page asked for", () => {
    expect(signInUrl(request)).toBe("/sign-in?redirectTo=%2Fapp%2Fgroups%2Fg1%2Ftimeline%3Fkind%3Dnote");
  });

  it("carries a reason for the sign-in page to show", () => {
    expect(signInUrl(request, { reason: "offline" })).toBe(
      "/sign-in?redirectTo=%2Fapp%2Fgroups%2Fg1%2Ftimeline%3Fkind%3Dnote&reason=offline",
    );
  });
});

describe("safeRedirect", () => {
  it.each([
    "/app",
    "/app/groups/g1/timeline?kind=note&q=a%2Fb",
    "/app/groups/g1/notes/n1#heading",
    "/app/settings?tab=theme#top",
  ])("keeps the in-app path %s", (to) => {
    expect(safeRedirect(to)).toBe(to);
  });

  it.each([
    ["nothing", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["an absolute URL", "https://evil.example/app"],
    ["a protocol-relative URL", "//evil.example"],
    ["a relative path", "app/settings"],
    ["a leading backslash", "/\\evil.example"],
    ["a backslash later on", "/app\\..\\\\evil.example"],
    ["a tab", "/\t/evil.example"],
    ["a carriage return", "/\r/evil.example"],
    ["a line feed", "/\n/evil.example"],
    ["a CRLF", "/\r\n/evil.example"],
    ["a NUL", "/app\u0000"],
    ["a DEL", "/\u007f/evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
  ])("falls back on %s", (_name, to) => {
    expect(safeRedirect(to)).toBe(appUrls.home());
  });

  it("falls back to the fallback given", () => {
    expect(safeRedirect("/\t/evil.example", "/sign-in")).toBe("/sign-in");
  });
});
