import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhook, WEBHOOK_TOLERANCE_MS } from "./webhookSignature";

// Svix's published test vector (docs.svix.com, "Verifying signatures manually").
const VECTOR = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: "1614265330",
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};
const AT = Number(VECTOR.timestamp) * 1000;

const headers = (overrides: Record<string, string> = {}) => ({
  "svix-id": VECTOR.id,
  "svix-timestamp": VECTOR.timestamp,
  "svix-signature": VECTOR.signature,
  ...overrides,
});

const verify = (opts: Partial<Parameters<typeof verifyWebhook>[0]> = {}) =>
  verifyWebhook({ headers: headers(), body: VECTOR.body, secret: VECTOR.secret, now: AT, ...opts });

describe("verifyWebhook", () => {
  it("accepts Svix's test vector", () => {
    expect(verify()).toEqual({ ok: true, id: VECTOR.id, timestamp: Number(VECTOR.timestamp) });
  });

  it("reads a Headers object too", () => {
    expect(verify({ headers: new Headers(headers()) }).ok).toBe(true);
  });

  it("accepts the secret without its whsec_ prefix", () => {
    expect(verify({ secret: VECTOR.secret.slice("whsec_".length) }).ok).toBe(true);
  });

  it("refuses a wrong secret", () => {
    expect(verify({ secret: "whsec_" + Buffer.from("another secret").toString("base64") })).toEqual({
      ok: false,
      reason: "badSignature",
    });
    expect(verify({ secret: "whsec_" })).toEqual({ ok: false, reason: "badSecret" });
  });

  it("refuses a tampered body", () => {
    expect(verify({ body: '{"test": 2432232315}' })).toEqual({ ok: false, reason: "badSignature" });
  });

  it("refuses a timestamp more than 5 minutes off, either way", () => {
    expect(verify({ now: AT + WEBHOOK_TOLERANCE_MS }).ok).toBe(true);
    expect(verify({ now: AT + WEBHOOK_TOLERANCE_MS + 1000 })).toEqual({ ok: false, reason: "expired" });
    expect(verify({ now: AT - WEBHOOK_TOLERANCE_MS - 1000 })).toEqual({ ok: false, reason: "expired" });
    expect(verify({ headers: headers({ "svix-timestamp": "soon" }) })).toEqual({
      ok: false,
      reason: "badTimestamp",
    });
  });

  it("accepts any one valid signature among several", () => {
    const several = `v1,${Buffer.from("not it").toString("base64")} v2,whatever ${VECTOR.signature}`;
    expect(verify({ headers: headers({ "svix-signature": several }) }).ok).toBe(true);
    const none = `v1,${Buffer.from("not it").toString("base64")} v1a,${VECTOR.signature.slice(3)}`;
    expect(verify({ headers: headers({ "svix-signature": none }) })).toEqual({
      ok: false,
      reason: "badSignature",
    });
  });

  it("refuses a request missing a header", () => {
    for (const name of ["svix-id", "svix-timestamp", "svix-signature"])
      expect(verify({ headers: headers({ [name]: "" }) })).toEqual({ ok: false, reason: "missingHeaders" });
  });

  it("refuses a signature for another id (the id is signed)", () => {
    expect(verify({ headers: headers({ "svix-id": "msg_other" }) }).ok).toBe(false);
  });
});

describe("signWebhook", () => {
  it("signs as Svix does", () => {
    expect(
      signWebhook({
        id: VECTOR.id,
        body: VECTOR.body,
        secret: VECTOR.secret,
        timestamp: Number(VECTOR.timestamp),
      }),
    ).toEqual(headers());
  });
});
