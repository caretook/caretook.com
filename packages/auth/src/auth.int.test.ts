import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accountSchema,
  getDb,
  isError,
  notificationOutboxSchema,
  userSchema,
  userService,
  verificationSchema,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createGroup, createUser, ok, system } from "../../data/test/fixtures";
import { getAuth, getAuthUser } from ".";

// Each test makes its own user and group, so tests never depend on each other.

const PASSWORD = "correct horse battery staple";

/** A user who can sign in with email + password, owning a fresh group. */
const createLogin = async ({ verified = true }: { verified?: boolean } = {}) => {
  const login = await createUser("auth");
  if (verified) {
    await getDb().update(userSchema).set({ emailVerified: true }).where(eq(userSchema.id, login.user.id));
  }
  await getDb()
    .insert(accountSchema)
    .values({
      userId: login.user.id,
      providerId: "credential",
      accountId: login.user.id,
      password: await hashPassword(PASSWORD),
    });
  const { group } = await createGroup(login);
  return { ...login, email: login.user.email, group };
};

const signIn = (email: string, password = PASSWORD) =>
  getAuth().api.signInEmail({ body: { email, password }, asResponse: true });

/** The request headers a browser would send after `res` (its cookies). */
const cookieHeaders = (res: Response) =>
  new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });

describe("signing in", () => {
  it("resolves a cookie session to the AuthUser services expect", async () => {
    const login = await createLogin();
    const res = await signIn(login.email);
    expect(res.status).toBe(200);

    expect(await getAuthUser(cookieHeaders(res))).toEqual({
      id: login.user.id,
      roleNames: ["member"],
      groupRoles: { [login.group.id]: "owner" },
    });
  });

  it("accepts a bearer token, for the native app", async () => {
    const login = await createLogin();
    const res = await signIn(login.email);
    const token = res.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    const authUser = await getAuthUser(new Headers({ authorization: `Bearer ${token}` }));
    expect(authUser).toMatchObject({ id: login.user.id });
  });

  it("rejects a wrong password and unknown emails alike", async () => {
    const login = await createLogin();
    const wrong = await signIn(login.email, "not the password at all");
    const unknown = await signIn("nobody@example.com");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
  });

  it("returns null without a valid session", async () => {
    expect(await getAuthUser(new Headers())).toBeNull();
    expect(await getAuthUser(new Headers({ authorization: "Bearer forged" }))).toBeNull();
    expect(await getAuthUser(new Headers({ cookie: "better-auth.session_token=forged" }))).toBeNull();
  });

  it("ends the session on sign-out", async () => {
    const login = await createLogin();
    const headers = cookieHeaders(await signIn(login.email));
    await getAuth().api.signOut({ headers });
    expect(await getAuthUser(headers)).toBeNull();
  });
});

describe("accounts", () => {
  it("refuses sign-up (accounts come from seeds this iteration)", async () => {
    const res = await getAuth().api.signUpEmail({
      body: { email: `new-${crypto.randomUUID()}@example.com`, password: PASSWORD, name: "New" },
      asResponse: true,
    });
    expect(res.ok).toBe(false);
  });

  it("never lets a request change the user's role", async () => {
    const login = await createLogin();
    const headers = cookieHeaders(await signIn(login.email));

    await getAuth()
      .api.updateUser({ headers, body: { name: "Renamed", role: "admin" } as never })
      .catch(() => undefined);

    const user = ok(await userService.getById(system, login.user.id));
    expect(user?.role).toBe("member");
  });

  it("issues a short-lived JWT for the user", async () => {
    const login = await createLogin();
    const headers = cookieHeaders(await signIn(login.email));
    const { token } = await getAuth().api.getToken({ headers });

    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as {
      sub: string;
      role: string;
      exp: number;
      iat: number;
    };
    expect(payload).toMatchObject({ sub: login.user.id, role: "member" });
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it("deleting a user removes their sessions and accounts", async () => {
    const login = await createLogin();
    const headers = cookieHeaders(await signIn(login.email));
    // The user owns a group; leaving it ownerless is an open question (AGENTS.md).
    const res = await userService.remove(system, { filter: { id: { type: "eq", value: login.user.id } } });
    expect(isError(res)).toBe(false);
    expect(await getAuthUser(headers)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Account emails (invites slice 2)
// ---------------------------------------------------------------------------

// Auth emails are queued in the background; collect that work so a test can
// wait for it instead of sleeping.
const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));

const settle = async () => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
};

/** Mail the memory sender delivered to `to`, oldest first (after the background work). */
const mailTo = async (to: string) => {
  await settle();
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

/** The one message `name` sent to `to`. */
const lastMail = async (to: string, name: string) => {
  const mail = (await mailTo(to)).filter((m) => m.name === name);
  expect(mail).toHaveLength(1);
  return mail[0]!;
};

const linkIn = (text: string, path: string) => {
  const match = text.match(new RegExp(`https?://[^\\s]+${path.replaceAll("/", "\\/")}\\?[^\\s]+`));
  if (!match) throw new Error(`No ${path} link in: ${text}`);
  return new URL(match[0]);
};

const api = () => getAuth().api;

const userCount = async (email: string) =>
  (
    await getDb()
      .select()
      .from(userSchema)
      .where(eq(sql`lower(${userSchema.email})`, email.toLowerCase()))
  ).length;

const unknownEmail = () => `nobody-${crypto.randomUUID().slice(0, 8)}@example.com`;

describe("email verification", () => {
  it("refuses an unverified account's password sign-in and emails a link that verifies it", async () => {
    const login = await createLogin({ verified: false });
    const res = await signIn(login.email);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("EMAIL_NOT_VERIFIED");

    const mail = await lastMail(login.email, "verifyEmail");
    const link = linkIn(mail.text, "/verify-email");
    expect(link.origin).toBe(process.env.APP_URL ?? "http://localhost:5173");
    // The outbox doesn't keep the link once it's sent.
    const [row] = await getDb()
      .select()
      .from(notificationOutboxSchema)
      .where(eq(notificationOutboxSchema.recipient, login.email));
    expect(row?.text).not.toContain(link.searchParams.get("token"));

    const verified = await api().verifyEmail({
      query: { token: link.searchParams.get("token") ?? "" },
      asResponse: true,
    });
    expect(verified.status).toBe(200);
    // It signs the user in, and the password works from now on.
    expect(await getAuthUser(cookieHeaders(verified))).toMatchObject({ id: login.user.id });
    expect((await signIn(login.email)).status).toBe(200);
  });

  it("answers a resend the same way for unknown, verified and unverified addresses", async () => {
    const unverified = await createLogin({ verified: false });
    const verified = await createLogin();
    const unknown = unknownEmail();
    for (const email of [unverified.email, verified.email, unknown]) {
      const res = await api().sendVerificationEmail({ body: { email }, asResponse: true });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: true });
    }
    expect((await mailTo(unverified.email)).map((m) => m.name)).toEqual(["verifyEmail"]);
    expect(await mailTo(verified.email)).toEqual([]);
    expect(await mailTo(unknown)).toEqual([]);
  });

  it("sends every resend, even two in one second (the token's iat is in seconds)", async () => {
    const login = await createLogin({ verified: false });
    for (let i = 0; i < 2; i++) {
      await api().sendVerificationEmail({ body: { email: login.email }, asResponse: true });
    }
    expect((await mailTo(login.email)).map((m) => m.name)).toEqual(["verifyEmail", "verifyEmail"]);
  });
});

describe("magic links", () => {
  it("signs an existing user in, once", async () => {
    const login = await createLogin();
    const res = await api().signInMagicLink({
      body: { email: login.email, callbackURL: "/app" },
      headers: new Headers(),
      asResponse: true,
    });
    expect(await res.json()).toEqual({ status: true });

    const link = linkIn((await lastMail(login.email, "magicLink")).text, "/api/auth/magic-link/verify");
    expect(link.searchParams.get("callbackURL")).toBe("/app");
    const token = link.searchParams.get("token") ?? "";
    const verified = await api().magicLinkVerify({
      query: { token },
      headers: new Headers(),
      asResponse: true,
    });
    expect(await getAuthUser(cookieHeaders(verified))).toMatchObject({ id: login.user.id });

    const again = await api().magicLinkVerify({
      query: { token, callbackURL: "/app", errorCallbackURL: "/sign-in" },
      headers: new Headers(),
      asResponse: true,
    });
    expect(again.headers.get("location")).toContain("error=INVALID_TOKEN");
  });

  it("says the same for an unknown email, sends nothing and creates no account", async () => {
    const email = unknownEmail();
    const res = await api().signInMagicLink({ body: { email }, headers: new Headers(), asResponse: true });
    expect(await res.json()).toEqual({ status: true });
    expect(await mailTo(email)).toEqual([]);
    expect(await userCount(email)).toBe(0);
  });
});

describe("sign-in codes", () => {
  const sendCode = (email: string) =>
    api().sendVerificationOTP({ body: { email, type: "sign-in" }, asResponse: true });
  const signInWithCode = (email: string, otp: string) =>
    api().signInEmailOTP({ body: { email, otp }, asResponse: true });
  const codeIn = (text: string) => text.match(/\b(\d{6})\b/)?.[1] ?? "";

  it("signs in with the emailed code, and refuses a wrong one", async () => {
    const login = await createLogin();
    expect(await (await sendCode(login.email)).json()).toEqual({ success: true });
    const code = codeIn((await lastMail(login.email, "signInCode")).text);
    expect(code).toMatch(/^\d{6}$/);

    const wrong = code === "000000" ? "111111" : "000000";
    expect((await signInWithCode(login.email, wrong)).status).toBe(400);
    const res = await signInWithCode(login.email, code);
    expect(res.status).toBe(200);
    expect(await getAuthUser(cookieHeaders(res))).toMatchObject({ id: login.user.id });
  });

  it("refuses an expired code", async () => {
    const login = await createLogin();
    await sendCode(login.email);
    const code = codeIn((await lastMail(login.email, "signInCode")).text);
    await getDb()
      .update(verificationSchema)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verificationSchema.identifier, `sign-in-otp-${login.email.toLowerCase()}`));
    expect((await signInWithCode(login.email, code)).status).toBe(400);
  });

  it("says the same for an unknown email, sends nothing and creates no account", async () => {
    const email = unknownEmail();
    expect(await (await sendCode(email)).json()).toEqual({ success: true });
    expect(await mailTo(email)).toEqual([]);
    expect((await signInWithCode(email, "123456")).status).toBe(400);
    expect(await userCount(email)).toBe(0);
  });

  it("verifies an unverified account that signs in with a code", async () => {
    const login = await createLogin({ verified: false });
    await sendCode(login.email);
    const code = codeIn((await lastMail(login.email, "signInCode")).text);
    expect((await signInWithCode(login.email, code)).status).toBe(200);
    const [user] = await getDb().select().from(userSchema).where(eq(userSchema.id, login.user.id));
    expect(user?.emailVerified).toBe(true);
  });

  it("keeps the plugin's other code endpoints off", async () => {
    const res = await getAuth().handler(
      new Request("http://localhost:5173/api/auth/email-otp/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:5173" },
        body: JSON.stringify({ email: "x@example.com" }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("password reset", () => {
  it("sets a new password through the emailed link, which works once", async () => {
    const login = await createLogin();
    const res = await api().requestPasswordReset({
      body: { email: login.email, redirectTo: "/reset-password" },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const token =
      linkIn((await lastMail(login.email, "resetPassword")).text, "/reset-password").searchParams.get(
        "token",
      ) ?? "";
    const newPassword = "a brand new passphrase";
    expect((await api().resetPassword({ body: { token, newPassword }, asResponse: true })).status).toBe(200);

    expect((await signIn(login.email)).status).toBe(401);
    expect((await signIn(login.email, newPassword)).status).toBe(200);
    expect(
      (
        await api().resetPassword({
          body: { token, newPassword: "yet another passphrase" },
          asResponse: true,
        })
      ).status,
    ).toBe(400);
  });

  it("says the same for an unknown email and sends nothing", async () => {
    const login = await createLogin();
    const known = await api().requestPasswordReset({ body: { email: login.email }, asResponse: true });
    const email = unknownEmail();
    const unknown = await api().requestPasswordReset({ body: { email }, asResponse: true });
    expect(await unknown.json()).toEqual(await known.json());
    expect(await mailTo(email)).toEqual([]);
  });
});
