import { describe, expect, it } from "vitest";
import { addressKey, createAuthLimits } from "./limits";

describe("addressKey", () => {
  it("normalizes case and spaces, so one address is one key", () => {
    expect(addressKey("  Pat.Doe@Example.COM ")).toBe(addressKey("pat.doe@example.com"));
    expect(addressKey("pat.doe@example.com")).not.toBe(addressKey("sam.doe@example.com"));
  });

  it("is a hash: the address isn't in the key", () => {
    const key = addressKey("pat.doe@example.com");
    expect(key).toMatch(/^[\w-]{43}$/);
    expect(key).not.toContain("pat");
    expect(key).not.toContain("example");
  });
});

describe("createAuthLimits", () => {
  it("passes everything while off", async () => {
    const limits = createAuthLimits({ enabled: false });
    for (let i = 0; i < 20; i++) expect(await limits.hit("signInEmail", "k")).toBe(true);
  });
});
