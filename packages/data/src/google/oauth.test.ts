import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashState, newOauthSecrets, oauthStateUsable } from "./index";

// Connecting Google (appointments-2 slice 7): the state and PKCE a Connect
// keeps for 10 minutes. Ids are made up.

const ME = "7d1e0c4a-0000-4000-8000-000000000001";
const SOMEONE = "7d1e0c4a-0000-4000-8000-000000000002";
const NOW = new Date("2026-11-18T18:00:00.000Z");

describe("newOauthSecrets", () => {
  it("makes a fresh state and an S256 PKCE pair each time", () => {
    const a = newOauthSecrets();
    const b = newOauthSecrets();
    expect(a.state).not.toBe(b.state);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    // RFC 7636: 43–128 characters, and the challenge is base64url(SHA-256(verifier)).
    expect(a.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(a.codeChallenge).toBe(createHash("sha256").update(a.codeVerifier).digest("base64url"));
  });

  it("stores only a hash of the state", () => {
    const { state } = newOauthSecrets();
    expect(hashState(state)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashState(state)).not.toContain(state);
  });
});

describe("oauthStateUsable", () => {
  const pending = { userId: ME, expiresAt: "2026-11-18T18:10:00.000Z" };

  it("lets the member who started it finish within its 10 minutes", () => {
    expect(oauthStateUsable(pending, ME, NOW)).toBe(true);
    expect(oauthStateUsable(pending, ME, new Date("2026-11-18T18:09:59.999Z"))).toBe(true);
  });

  it("refuses it once expired, for anyone else, or when there's none", () => {
    expect(oauthStateUsable(pending, ME, new Date("2026-11-18T18:10:00.000Z"))).toBe(false);
    expect(oauthStateUsable(pending, SOMEONE, NOW)).toBe(false);
    expect(oauthStateUsable(null, ME, NOW)).toBe(false);
  });
});
