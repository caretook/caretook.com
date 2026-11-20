import type { Auth } from "./auth";

import { createPublicKey, verify } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountSchema,
  adminAuditLogSchema,
  authKeysService,
  getDb,
  jwksSchema,
  userSchema,
} from "@caretook/data";
import { createUser, ok } from "../../data/test/fixtures";
import { createAuth, getAuth } from ".";

// Rotating the JWT signing key and BETTER_AUTH_SECRET (hosting slice 9,
// B-158), against Better Auth 1.7.25 itself:
//
// - `pnpm auth:rotate-jwks` (authKeysService.rotate) retires the key; the
//   next token makes a new one, the JWKS serves both, and each verifies.
// - A new BETTER_AUTH_SECRET alone can't read the old private key, so
//   tokens fail until the key is rotated.
// - BETTER_AUTH_SECRETS keeps it readable. Its current (first) entry signs
//   and checks session cookies on its own, so making a new secret current
//   signs everyone out; listing one behind the current changes nothing.
//
// Keys are shared by the whole test database, so each test starts with none
// live, and the last leaves none for the next file (which makes its own with
// the default secret).

const OLD = process.env.BETTER_AUTH_SECRET ?? "";
const NEW = "a-new-test-only-secret-never-used-outside-tests-9876543210";
const PASSWORD = "correct horse battery staple";
const ORIGIN = "http://localhost:5173";

const retireAll = async () => ok(await authKeysService.rotate({ reason: "rotation.int.test" }));

beforeEach(retireAll);
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(retireAll);

/** A verified user with a password. */
const createLogin = async () => {
  const { user } = await createUser("rotation");
  await getDb().update(userSchema).set({ emailVerified: true }).where(eq(userSchema.id, user.id));
  await getDb()
    .insert(accountSchema)
    .values({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(PASSWORD),
    });
  return user.email;
};

/** The cookie headers of a fresh session on `auth`. */
const signIn = async (auth: Auth, email: string) => {
  const res = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(res.status).toBe(200);
  return new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });
};

const tokenFor = (auth: Auth, headers: Headers) =>
  auth.api.getToken({ headers }).then(
    ({ token }) => token,
    () => null,
  );

type Jwk = { kid: string; kty: string; crv: string; x: string };
const jwks = async (auth: Auth) => {
  const res = await auth.handler(new Request(`${ORIGIN}/api/auth/jwks`));
  expect(res.status).toBe(200);
  return ((await res.json()) as { keys: Jwk[] }).keys;
};

const kidOf = (token: string) =>
  (JSON.parse(Buffer.from(token.split(".")[0] ?? "", "base64url").toString()) as { kid: string }).kid;

/** Does `token` verify against the JWKS, as PowerSync checks it? */
const verifies = (token: string, keys: Jwk[]) => {
  const [header = "", payload = "", signature = ""] = token.split(".");
  const jwk = keys.find((k) => k.kid === kidOf(token));
  if (!jwk) return false;
  const key = createPublicKey({ key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, format: "jwk" });
  return verify(null, Buffer.from(`${header}.${payload}`), key, Buffer.from(signature, "base64url"));
};

/** A new Better Auth instance (a new deploy) with these secrets. */
const deployWith = (env: { BETTER_AUTH_SECRET?: string; BETTER_AUTH_SECRETS?: string }) => {
  vi.stubEnv("BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET ?? "");
  vi.stubEnv("BETTER_AUTH_SECRETS", env.BETTER_AUTH_SECRETS ?? "");
  return createAuth();
};

describe("pnpm auth:rotate-jwks", () => {
  it("makes the JWKS serve a new key whose tokens verify, keeps the old one, and audits", async () => {
    const auth = getAuth();
    const headers = await signIn(auth, await createLogin());
    const before = await tokenFor(auth, headers);
    if (!before) throw new Error("no token before the rotation");

    const rotated = ok(await authKeysService.rotate({ reason: "Scheduled rotation" }));
    expect(rotated.retired).toEqual([kidOf(before)]);

    const after = await tokenFor(auth, headers);
    if (!after) throw new Error("no token after the rotation");
    expect(kidOf(after)).not.toBe(kidOf(before));

    const keys = await jwks(auth);
    expect(keys.map((k) => k.kid)).toEqual(expect.arrayContaining([kidOf(before), kidOf(after)]));
    expect(verifies(after, keys)).toBe(true);
    // Tokens the old key signed (15 minutes) verify until they expire.
    expect(verifies(before, keys)).toBe(true);

    const [entry] = await getDb()
      .select()
      .from(adminAuditLogSchema)
      .where(eq(adminAuditLogSchema.reason, "Scheduled rotation"));
    expect(entry).toMatchObject({
      actorId: null,
      action: "auth.jwksRotated",
      targetUserId: null,
      changes: { retired: [null, [kidOf(before)]] },
    });
  }, 20_000);

  it("drops a key from the JWKS an hour after it was retired, and deletes it on the next rotation", async () => {
    const auth = getAuth();
    const headers = await signIn(auth, await createLogin());
    const token = await tokenFor(auth, headers);
    if (!token) throw new Error("no token");
    const kid = kidOf(token);

    ok(await authKeysService.rotate());
    await getDb()
      .update(jwksSchema)
      .set({ expiresAt: new Date(Date.now() - 61 * 60_000) })
      .where(eq(jwksSchema.id, kid));
    expect((await jwks(auth)).map((k) => k.kid)).not.toContain(kid);

    const next = ok(await authKeysService.rotate());
    expect(next.deleted).toContain(kid);
    expect(await getDb().select().from(jwksSchema).where(eq(jwksSchema.id, kid))).toEqual([]);
  }, 20_000);
});

describe("rotating BETTER_AUTH_SECRET", () => {
  it("alone: tokens fail until the key is rotated, then work", async () => {
    const email = await createLogin();
    const before = getAuth();
    expect(await tokenFor(before, await signIn(before, email))).toBeTruthy();

    const auth = deployWith({ BETTER_AUTH_SECRET: NEW });
    const headers = await signIn(auth, email);
    expect(await tokenFor(auth, headers)).toBeNull();

    ok(await authKeysService.rotate());
    const token = await tokenFor(auth, headers);
    expect(token && verifies(token, await jwks(auth))).toBe(true);
  }, 20_000);

  it("with BETTER_AUTH_SECRETS: tokens never fail, and the old secret can go once the key is rotated", async () => {
    const email = await createLogin();
    const before = getAuth();
    const oldSession = await signIn(before, email);
    const oldToken = await tokenFor(before, oldSession);
    if (!oldToken) throw new Error("no token");

    // Step 1: the new secret current, the old one kept as the legacy secret.
    const step1 = deployWith({ BETTER_AUTH_SECRET: OLD, BETTER_AUTH_SECRETS: `1:${NEW}` });
    // Session cookies are checked against the current secret alone: signed out.
    expect(await step1.api.getSession({ headers: oldSession })).toBeNull();
    const headers = await signIn(step1, email);
    const sameKey = await tokenFor(step1, headers);
    expect(sameKey && kidOf(sameKey)).toBe(kidOf(oldToken));

    // Step 2: rotate the key; the new one is encrypted with version 1.
    ok(await authKeysService.rotate());
    const fresh = await tokenFor(step1, headers);
    if (!fresh) throw new Error("no token after the rotation");
    const [row] = await getDb()
      .select()
      .from(jwksSchema)
      .where(eq(jwksSchema.id, kidOf(fresh)));
    expect(JSON.parse(row?.privateKey ?? '""')).toMatch(/^\$ba\$1\$/);

    // Step 3: the old secret gone everywhere; sessions and tokens carry on.
    const step3 = deployWith({ BETTER_AUTH_SECRET: NEW, BETTER_AUTH_SECRETS: `1:${NEW}` });
    expect(await step3.api.getSession({ headers })).not.toBeNull();
    const later = await tokenFor(step3, headers);
    expect(later && kidOf(later)).toBe(kidOf(fresh));
  }, 30_000);

  it("listing a new secret behind the current one keeps sessions and tokens", async () => {
    const email = await createLogin();
    const before = getAuth();
    const session = await signIn(before, email);
    const token = await tokenFor(before, session);
    if (!token) throw new Error("no token");

    const auth = deployWith({ BETTER_AUTH_SECRET: OLD, BETTER_AUTH_SECRETS: `0:${OLD},1:${NEW}` });
    expect(await auth.api.getSession({ headers: session })).not.toBeNull();
    const again = await tokenFor(auth, session);
    expect(again && kidOf(again)).toBe(kidOf(token));
  }, 20_000);
});
