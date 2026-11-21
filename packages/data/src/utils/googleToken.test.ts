import { describe, expect, it } from "vitest";
import { googleTokenKeyConfigured, openGoogleToken, sealGoogleToken } from "./googleToken";

// Google refresh tokens at rest (appointments-2 slice 7). Tokens are made up.

const ID = "5c2e9a10-0000-4000-8000-000000000001";
const OTHER_ID = "5c2e9a10-0000-4000-8000-000000000002";
const env = (key?: string, nodeEnv = "test") =>
  ({ NODE_ENV: nodeEnv, ...(key ? { GOOGLE_TOKEN_KEY: key } : {}) }) as NodeJS.ProcessEnv;

describe("Google tokens at rest", () => {
  it("seal a token that opens on its own connection with the same key", () => {
    const sealed = sealGoogleToken("1//refresh-fake-abc", ID, env("k1")) ?? "";
    expect(sealed).toBeTruthy();
    expect(sealed).not.toContain("refresh-fake");
    expect(openGoogleToken(sealed, ID, env("k1"))).toBe("1//refresh-fake-abc");
  });

  it("never open on another connection, with another key, or tampered", () => {
    const sealed = sealGoogleToken("1//refresh-fake-abc", ID, env("k1")) ?? "";
    expect(openGoogleToken(sealed, OTHER_ID, env("k1"))).toBeNull();
    expect(openGoogleToken(sealed, ID, env("k2"))).toBeNull();
    // The invite-link key is a different key, even with the same value.
    expect(openGoogleToken(sealed, ID, env())).toBeNull();
    const flipped = Buffer.from(sealed, "base64url");
    flipped.writeUInt8(flipped.readUInt8(0) ^ 1, 0);
    expect(openGoogleToken(flipped.toString("base64url"), ID, env("k1"))).toBeNull();
  });

  it("need GOOGLE_TOKEN_KEY in production, and have a dev key elsewhere", () => {
    expect(googleTokenKeyConfigured(env(undefined, "production"))).toBe(false);
    expect(sealGoogleToken("t", ID, env(undefined, "production"))).toBeNull();
    expect(googleTokenKeyConfigured(env(undefined, "development"))).toBe(true);
    expect(googleTokenKeyConfigured(env("k", "production"))).toBe(true);
    const dev = sealGoogleToken("t", ID, env()) ?? "";
    expect(openGoogleToken(dev, ID, env())).toBe("t");
  });
});
