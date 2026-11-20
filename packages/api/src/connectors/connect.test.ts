import { describe, expect, it } from "vitest";
import { acceptedOAuthScopes } from "./connect";

const ALL = ["group:read", "group:write", "offline_access"];

describe("the consent page's scopes", () => {
  it("accept only scopes the assistant asked for", () => {
    expect(acceptedOAuthScopes("readWrite", ALL)).toEqual(ALL);
    expect(acceptedOAuthScopes("read", ALL)).toEqual(["group:read", "offline_access"]);
    expect(acceptedOAuthScopes("readWrite", ["group:read"])).toEqual(["group:read"]);
  });
});
