import { describe, expect, it } from "vitest";
import { linkKeyConfigured, openLinkToken, sealLinkToken } from "./linkToken";

const ID = "7a1d3c6e-0000-4000-8000-000000000001";
const OTHER_ID = "7a1d3c6e-0000-4000-8000-000000000002";
const env = (key?: string, nodeEnv = "test") =>
  ({ NODE_ENV: nodeEnv, ...(key ? { INVITE_LINK_KEY: key } : {}) }) as NodeJS.ProcessEnv;

describe("link tokens at rest", () => {
  it("seals a token that opens on its own invite with the same key", () => {
    const sealed = sealLinkToken("tok_abc-123", ID, env("k1"));
    expect(sealed).toBeTruthy();
    expect(sealed).not.toContain("tok_abc");
    expect(openLinkToken(sealed ?? "", ID, env("k1"))).toBe("tok_abc-123");
  });

  it("never opens on another invite, with another key, or tampered", () => {
    const sealed = sealLinkToken("tok_abc-123", ID, env("k1")) ?? "";
    expect(openLinkToken(sealed, OTHER_ID, env("k1"))).toBeNull();
    expect(openLinkToken(sealed, ID, env("k2"))).toBeNull();
    const flipped = Buffer.from(sealed, "base64url");
    const last = flipped.length - 1;
    flipped.writeUInt8(flipped.readUInt8(last) ^ 1, last);
    expect(openLinkToken(flipped.toString("base64url"), ID, env("k1"))).toBeNull();
    expect(openLinkToken("short", ID, env("k1"))).toBeNull();
  });

  it("uses a fresh IV each time", () => {
    expect(sealLinkToken("t", ID, env("k1"))).not.toBe(sealLinkToken("t", ID, env("k1")));
  });

  it("needs INVITE_LINK_KEY in production, and has a dev key elsewhere", () => {
    expect(linkKeyConfigured(env(undefined, "production"))).toBe(false);
    expect(sealLinkToken("t", ID, env(undefined, "production"))).toBeNull();
    expect(linkKeyConfigured(env(undefined, "development"))).toBe(true);
    expect(linkKeyConfigured(env("k", "production"))).toBe(true);
    const check = { NODE_ENV: "production", VITE_CHECK_BUILD: "1" } as NodeJS.ProcessEnv;
    expect(linkKeyConfigured({ ...check, APP_URL: "http://localhost:6573" })).toBe(true);
    expect(linkKeyConfigured({ ...check, APP_URL: "https://caretook.com" })).toBe(false);
  });
});
