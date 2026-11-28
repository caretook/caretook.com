import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  accountSchema,
  careGroupInviteSchema,
  careGroupInviteService,
  getDb,
  isError,
  notificationOutboxSchema,
  sessionSchema,
  userSchema,
  userService,
  verificationSchema,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createGroup, createUser, ok, system } from "../../data/test/fixtures";
import { createAuth, createAuthLimits, getAuth, getAuthUser, signUpWithTicket } from ".";

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

  it("refuses the raw stored token as a bearer: only the signed one works (B-330)", async () => {
    const login = await createLogin();
    const res = await signIn(login.email);
    const signed = res.headers.get("set-auth-token");
    const { token: raw } = (await res.json()) as { token: string };
    // The body's token is the session table's own column.
    const stored = await getDb().select().from(sessionSchema).where(eq(sessionSchema.token, raw));
    expect(stored).toHaveLength(1);
    expect(signed).not.toBe(raw);

    expect(await getAuthUser(new Headers({ authorization: `Bearer ${raw}` }))).toBeNull();
    expect(await getAuthUser(new Headers({ authorization: `Bearer ${raw}` }), { live: true })).toBeNull();
    expect(await getAuthUser(new Headers({ authorization: `Bearer ${signed}` }))).toMatchObject({
      id: login.user.id,
    });
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
    // The session row is gone, so the old cookies (kept past sign-out; the
    // browser drops them) sign no one in, cookie cache or not (B-339).
    expect(await getAuthUser(headers, { live: true })).toBeNull();
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

    const user = ok(await userService.getWholeById(system, login.user.id));
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

describe("the sign-in email (link and code)", () => {
  const sendSignInEmail = (email: string, callbackURL?: string) =>
    api().signInMagicLink({
      body: { email, ...(callbackURL ? { callbackURL } : {}) },
      headers: new Headers(),
      asResponse: true,
    });
  const signInWithCode = (email: string, otp: string) =>
    api().signInEmailOTP({ body: { email, otp }, asResponse: true });
  /** The code sits on a line of its own in the plain text. */
  const codeIn = (text: string) => text.match(/^\s*(\d{6})\s*$/m)?.[1] ?? "";

  it("sends one email whose link signs an existing user in, once", async () => {
    const login = await createLogin();
    const res = await sendSignInEmail(login.email, "/app");
    expect(await res.json()).toEqual({ status: true });

    const mail = await lastMail(login.email, "signInEmail");
    expect((await mailTo(login.email)).map((m) => m.name)).toEqual(["signInEmail"]);
    expect(codeIn(mail.text)).toMatch(/^\d{6}$/);
    const link = linkIn(mail.text, "/api/auth/magic-link/verify");
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

  it("signs in with the same email's code, and refuses a wrong one", async () => {
    const login = await createLogin();
    await sendSignInEmail(login.email);
    const code = codeIn((await lastMail(login.email, "signInEmail")).text);
    expect(code).toMatch(/^\d{6}$/);

    const wrong = code === "000000" ? "111111" : "000000";
    expect((await signInWithCode(login.email, wrong)).status).toBe(400);
    const res = await signInWithCode(login.email, code);
    expect(res.status).toBe(200);
    expect(await getAuthUser(cookieHeaders(res))).toMatchObject({ id: login.user.id });
  });

  it("stores the code hashed", async () => {
    const login = await createLogin();
    await sendSignInEmail(login.email);
    const code = codeIn((await lastMail(login.email, "signInEmail")).text);
    const rows = await getDb()
      .select()
      .from(verificationSchema)
      .where(eq(verificationSchema.identifier, `sign-in-otp-${login.email.toLowerCase()}`));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).not.toContain(code);
  });

  it("refuses an expired code", async () => {
    const login = await createLogin();
    await sendSignInEmail(login.email);
    const code = codeIn((await lastMail(login.email, "signInEmail")).text);
    await getDb()
      .update(verificationSchema)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verificationSchema.identifier, `sign-in-otp-${login.email.toLowerCase()}`));
    expect((await signInWithCode(login.email, code)).status).toBe(400);
  });

  it("says the same for an unknown email, sends nothing and creates no account", async () => {
    const email = unknownEmail();
    const res = await sendSignInEmail(email);
    expect(await res.json()).toEqual({ status: true });
    expect(await mailTo(email)).toEqual([]);
    expect((await signInWithCode(email, "123456")).status).toBe(400);
    expect(await userCount(email)).toBe(0);
  });

  it("verifies an unverified account that signs in with a code", async () => {
    const login = await createLogin({ verified: false });
    await sendSignInEmail(login.email);
    const code = codeIn((await lastMail(login.email, "signInEmail")).text);
    expect((await signInWithCode(login.email, code)).status).toBe(200);
    const [user] = await getDb().select().from(userSchema).where(eq(userSchema.id, login.user.id));
    expect(user?.emailVerified).toBe(true);
  });

  it.each(["/email-otp/request-password-reset", "/email-otp/send-verification-otp"])(
    "keeps the plugin's other code endpoints off (%s)",
    async (path) => {
      const res = await getAuth().handler(
        new Request(`http://localhost:5173/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:5173" },
          body: JSON.stringify({ email: "x@example.com", type: "sign-in" }),
        }),
      );
      expect(res.status).toBe(404);
    },
  );
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

// ---------------------------------------------------------------------------
// Our limits (account-security slice 2)
// ---------------------------------------------------------------------------

const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;

describe("per-address sign-in limits (limits on)", () => {
  const limited = createAuth({ rateLimitEnabled: true });
  const sendSignInEmail = (email: string) =>
    limited.api.signInMagicLink({ body: { email }, headers: new Headers(), asResponse: true });
  // Through the handler, as a browser sends it (a refusal in a before hook is
  // thrown from a direct API call), each from its own address (Better Auth's
  // per-IP limit is on too).
  const signInWithCode = (email: string, otp: string) =>
    limited.handler(
      new Request("http://localhost:5173/api/auth/sign-in/email-otp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({ email, otp }),
      }),
    );
  const codeIn = (text: string) => text.match(/^\s*(\d{6})\s*$/m)?.[1] ?? "";
  /** The code in the newest sign-in email to `email`. */
  const newestCode = async (email: string) => codeIn((await mailTo(email)).at(-1)?.text ?? "");
  const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");

  it("answers a sixth sign-in email in an hour as the first, and queues nothing", async () => {
    const login = await createLogin();
    const first = await sendSignInEmail(login.email);
    const firstBody: unknown = await first.json();
    for (let i = 0; i < 4; i++) await sendSignInEmail(login.email);
    expect((await mailTo(login.email)).length).toBe(5);

    // Another spelling of the address is the same address.
    const sixth = await sendSignInEmail(`  ${login.email.toUpperCase()} `);
    expect(sixth.status).toBe(first.status);
    expect(await sixth.json()).toEqual(firstBody);
    expect((await mailTo(login.email)).length).toBe(5);

    // Another address is unaffected.
    const other = await createLogin();
    await sendSignInEmail(other.email);
    expect((await mailTo(other.email)).map((m) => m.name)).toEqual(["signInEmail"]);
  });

  it("refuses the eleventh code try in an hour, across fresh codes, even the right one", async () => {
    const login = await createLogin();
    let code = "";
    let tries = 0;
    while (tries < 10) {
      await sendSignInEmail(login.email);
      code = await newestCode(login.email);
      expect(code).toMatch(/^\d{6}$/);
      // Each code allows three tries; the last email's code keeps one back.
      for (let i = 0; i < 3 && tries < 10; i++, tries++) {
        expect((await signInWithCode(login.email, wrongFor(code))).status).toBe(400);
      }
    }
    const refused = await signInWithCode(login.email, code);
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { code?: string }).code).toBe("INVALID_OTP");
    expect(await getAuthUser(cookieHeaders(refused))).toBeNull();

    // Another address is unaffected.
    const other = await createLogin();
    await sendSignInEmail(other.email);
    expect((await signInWithCode(other.email, await newestCode(other.email))).status).toBe(200);
  });
});

describe("Better Auth's /update-user", () => {
  it("is off (404): name and image change only through our procedures", async () => {
    const login = await createLogin();
    const headers = cookieHeaders(await signIn(login.email));
    headers.set("content-type", "application/json");
    headers.set("origin", "http://localhost:5173");
    const res = await getAuth().handler(
      new Request("http://localhost:5173/api/auth/update-user", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "x".repeat(5000), image: "https://tracker.example.com/p.gif" }),
      }),
    );
    expect(res.status).toBe(404);
    const user = ok(await userService.getWholeById(system, login.user.id));
    expect(user?.name).not.toBe("x".repeat(5000));
  });
});

describe("link sign-up (the ticket path)", () => {
  /** A link to a fresh group, made by its owner. */
  const createLink = async (maxUses?: number) => {
    const owner = await createUser("link-owner");
    const { group } = await createGroup(owner);
    const made = ok(
      await careGroupInviteService.createLink(owner.ctx, {
        groupId: group.id,
        role: "viewer",
        ...(maxUses ? { maxUses } : {}),
      }),
    );
    return { inviteId: made.invite.id, token: made.token };
  };
  const useCount = async (inviteId: string) =>
    (
      await getDb()
        .select({ useCount: careGroupInviteSchema.useCount })
        .from(careGroupInviteSchema)
        .where(eq(careGroupInviteSchema.id, inviteId))
    )[0]?.useCount;
  const signUp = (
    token: string,
    email: string,
    opts: Parameters<typeof signUpWithTicket>[1] = { clientIp: randomIp() },
  ) =>
    signUpWithTicket(
      { ticket: { kind: "invite", token, legal: true }, name: "Link Person", email, password: PASSWORD },
      opts,
    );

  it("answers an address with an account as a new one, and hashes the password for both", async () => {
    const { token } = await createLink();
    const existing = await createLogin();
    const hash = vi.spyOn((await getAuth().$context).password, "hash");
    try {
      const fresh = await signUp(token, unknownEmail());
      const known = await signUp(token, existing.email);
      expect(isError(fresh) || isError(known)).toBe(false);
      const shape = (r: typeof fresh) =>
        isError(r) ? r : { email: typeof r.email, verified: r.emailVerified };
      expect(shape(known)).toEqual(shape(fresh));
      expect(hash).toHaveBeenCalledTimes(2);
    } finally {
      hash.mockRestore();
    }
  });

  it("refuses past the per-link limit as a used-up link", async () => {
    const { token } = await createLink();
    const limits = createAuthLimits({ enabled: true, limits: { linkSignUpLink: 2 } });
    for (let i = 0; i < 2; i++) {
      expect(isError(await signUp(token, unknownEmail(), { clientIp: randomIp(), limits }))).toBe(false);
    }
    const email = unknownEmail();
    const refused = await signUp(token, email, { clientIp: randomIp(), limits });
    expect(isError(refused) && refused.code).toBe("ticket:invalid");
    expect(await userCount(email)).toBe(0);
  });

  it("refuses past the per-IP limit, on any link", async () => {
    const limits = createAuthLimits({ enabled: true, limits: { linkSignUpIp: 1 } });
    const clientIp = randomIp();
    const first = await createLink();
    expect(isError(await signUp(first.token, unknownEmail(), { clientIp, limits }))).toBe(false);
    const second = await createLink();
    const refused = await signUp(second.token, unknownEmail(), { clientIp, limits });
    expect(isError(refused) && refused.code).toBe("ticket:invalid");
    // Another address is unaffected.
    expect(isError(await signUp(second.token, unknownEmail(), { clientIp: randomIp(), limits }))).toBe(false);
  });

  it("counts a sign-up toward max_uses; at it, sign-up is refused, and the join request adds no use", async () => {
    const { inviteId, token } = await createLink(1);
    const email = unknownEmail();
    const created = await signUp(token, email);
    if (isError(created) || !created.id) throw new Error("sign-up failed");
    expect(await useCount(inviteId)).toBe(1);

    const refused = await signUp(token, unknownEmail());
    expect(isError(refused) && refused.code).toBe("ticket:invalid");

    // The person who signed up still asks to join, and their request adds no use.
    const authUser = { id: created.id, roleNames: ["member" as const] };
    const asked = ok(
      await careGroupInviteService.accept({ authUser }, { token, consent: true, legal: true }),
    );
    expect(asked.status).toBe("requested");
    expect(await useCount(inviteId)).toBe(1);
  });
});
