import { describe, expect, it } from "vitest";
import { signInUrl } from "./redirect";

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
