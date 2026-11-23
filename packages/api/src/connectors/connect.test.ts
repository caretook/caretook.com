import { describe, expect, it } from "vitest";
import { acceptedOAuthScopes, connectChoices } from "./connect";

const ALL = ["group:read", "group:write", "offline_access"];

describe("the consent page's scopes", () => {
  it("accept only scopes the assistant asked for", () => {
    expect(acceptedOAuthScopes("readWrite", ALL)).toEqual(ALL);
    expect(acceptedOAuthScopes("read", ALL)).toEqual(["group:read", "offline_access"]);
    expect(acceptedOAuthScopes("readWrite", ["group:read"])).toEqual(["group:read"]);
  });

  it("offer a writer both, unless the group is read only, and then name the owner", () => {
    for (const role of ["owner", "admin", "caretaker"] as const) {
      expect(connectChoices(role, false, ALL)).toEqual({
        scopes: ["read", "readWrite"],
        readOnlyByOwner: false,
      });
      expect(connectChoices(role, true, ALL)).toEqual({ scopes: ["read"], readOnlyByOwner: true });
    }
  });

  it("don't blame the owner when the role or the client is why it can only read", () => {
    expect(connectChoices("viewer", true, ALL)).toEqual({ scopes: ["read"], readOnlyByOwner: false });
    expect(connectChoices("caretaker", true, ["group:read"])).toEqual({
      scopes: ["read"],
      readOnlyByOwner: false,
    });
  });
});
