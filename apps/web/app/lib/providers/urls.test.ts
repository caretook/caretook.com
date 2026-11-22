import { describe, expect, it } from "vitest";
import { appUrls } from "../app-shell/appUrls";

describe("appUrls: providers", () => {
  it("carries the directory's search, in any form, and drops empty values", () => {
    expect(appUrls.providers("g", "?q=cardio&type=clinician")).toBe(
      "/app/groups/g/providers?q=cardio&type=clinician",
    );
    expect(appUrls.providers("g", { q: "", past: "1" })).toBe("/app/groups/g/providers?past=1");
    expect(appUrls.editProvider("g", "p 1", { q: "cardio" })).toBe(
      "/app/groups/g/providers/p%201/edit?q=cardio",
    );
  });

  it("encodes a provider's id", () => {
    expect(appUrls.provider("g", "a/b")).toBe("/app/groups/g/providers/a%2Fb");
  });

  it("sets a new provider's type over the list's type filter, keeping the rest, and drops an unknown type", () => {
    expect(appUrls.newProvider("g", { type: "practice", search: "?q=west&type=clinician&past=1" })).toBe(
      "/app/groups/g/providers/new?q=west&type=practice&past=1",
    );
    expect(appUrls.newProvider("g", { search: "?q=west&type=clinician" })).toBe(
      "/app/groups/g/providers/new?q=west&type=clinician",
    );
    // @ts-expect-error: only provider types.
    expect(appUrls.newProvider("g", { type: "bogus" })).toBe("/app/groups/g/providers/new");
  });
});
