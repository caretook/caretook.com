import { describe, expect, it } from "vitest";
import { getAuthConfig, parseAuthSecrets } from "./config";

describe("BETTER_AUTH_SECRETS", () => {
  it("parses versioned secrets, current first", () => {
    expect(parseAuthSecrets(" 2:new-secret , 1:old:secret")).toEqual([
      { version: 2, value: "new-secret" },
      { version: 1, value: "old:secret" },
    ]);
    expect(parseAuthSecrets(undefined)).toBeUndefined();
    expect(parseAuthSecrets("  ")).toBeUndefined();
  });

  it("refuses a malformed entry, naming its position, never its value", () => {
    expect(() => parseAuthSecrets("1:ok,hidden-value")).toThrow(
      "BETTER_AUTH_SECRETS entry 2 must be <version>:<secret>",
    );
    expect(() => parseAuthSecrets("x:hidden-value")).toThrow(/entry 1/);
    expect(() => parseAuthSecrets("1:")).toThrow(/entry 1/);
    try {
      parseAuthSecrets("x:hidden-value");
    } catch (e) {
      expect(String(e)).not.toContain("hidden-value");
    }
  });

  it("is read beside BETTER_AUTH_SECRET", () => {
    expect(getAuthConfig({ BETTER_AUTH_SECRET: "a", BETTER_AUTH_SECRETS: "1:b" })).toMatchObject({
      secret: "a",
      secrets: [{ version: 1, value: "b" }],
    });
    expect(getAuthConfig({ BETTER_AUTH_SECRET: "" })).toMatchObject({
      secret: undefined,
      secrets: undefined,
    });
  });
});
