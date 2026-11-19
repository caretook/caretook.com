import {
  accountAdminService,
  accountSchema,
  adminAuditLogModel,
  getDb,
  isError,
  SYSTEM_USER,
} from "@caretook/data";
import { setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { getAuth, getAuthUser, staffAccountMailer } from ".";

// Disabling an account (admin slice 3): once an admin disables it
// (accountAdminService), Better Auth answers every way of signing in, every
// auth email and every sync token exactly as it answers a wrong password, a
// wrong code, no session or an unknown address. Re-enabling restores it.
// The guards are tested at the service (packages/data's
// accountAdmin.int.test.ts), and who may call the procedures in
// packages/api's accountDisable.int.test.ts.

const PASSWORD = "correct horse battery staple";

const codeOf = (value: unknown) => (isError(value) ? value.code : "ok");

type Staff = Awaited<ReturnType<typeof createUser>>;
const disable = async (admin: Staff, userId: string, reason: string) =>
  ok(await accountAdminService.disable(admin.ctx, { userId, reason }));

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));
const settle = async () => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
};
const mailTo = async (to: string) => {
  await settle();
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

const linkIn = (text: string, path: string) => {
  const match = text.match(new RegExp(`https?://[^\\s]+${path.replaceAll("/", "\\/")}\\?[^\\s]+`));
  if (!match) throw new Error(`No ${path} link in: ${text}`);
  return new URL(match[0]);
};

const query = async <T extends object>(text: string, values: unknown[] = []) =>
  (await getDb().$client.query<T>(text, values)).rows;

/** An account that signs in with a password (confirmed unless `verified: false`), in a group. */
const createLogin = async (label: string, { verified = true }: { verified?: boolean } = {}) => {
  const login = await createUser(label);
  if (verified) await query(`update "user" set email_verified = true where id = $1`, [login.user.id]);
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

const api = () => getAuth().api;

const ORIGIN = "http://localhost:5173";

/**
 * A POST to Better Auth's HTTP handler, as a browser sends it. Sign-in goes
 * this way, not through `auth.api`: a refusal from a `hooks.before`
 * middleware becomes a response only in the handler.
 */
const post = (path: string, body: object) =>
  getAuth().handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(body),
    }),
  );

const signIn = (email: string, password = PASSWORD) => post("/sign-in/email", { email, password });

const cookieHeaders = (res: Response) =>
  new Headers({
    cookie: res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });

const answer = async (res: Response) => ({ status: res.status, body: (await res.json()) as unknown });

const unknownEmail = () => `nobody-${randomUUID().slice(0, 8)}@example.com`;

const sendCode = (email: string) =>
  api().sendVerificationOTP({ body: { email, type: "sign-in" }, asResponse: true });

const codeIn = (text: string) => text.match(/\b(\d{6})\b/)?.[1] ?? "";

const auditActions = async (userId: string) => {
  const res = await adminAuditLogModel.search({
    authUser: SYSTEM_USER,
    filter: { target: userId },
    paginate: { page: 1, limit: 100 },
  });
  if (isError(res)) throw new Error(String(res.code));
  return res.data.map((e) => e.action).sort();
};

describe("a disabled account", () => {
  it("is signed out everywhere and can't sign in by password, link or code, answered as a stranger", async () => {
    const admin = await createUser("dsb-admin", "admin");
    const login = await createLogin("dsb");
    const stranger = await createLogin("dsb-stranger");

    const signedIn = await signIn(login.email);
    expect(signedIn.status).toBe(200);
    const headers = cookieHeaders(signedIn);
    const bearer = new Headers({ authorization: `Bearer ${signedIn.headers.get("set-auth-token")}` });
    // A link and a code asked for before the disable.
    await api().signInMagicLink({ body: { email: login.email }, headers: new Headers(), asResponse: true });
    await sendCode(login.email);
    const before = await mailTo(login.email);
    const linkToken = linkIn(
      before.find((m) => m.name === "magicLink")!.text,
      "/api/auth/magic-link/verify",
    ).searchParams.get("token")!;
    const code = codeIn(before.find((m) => m.name === "signInCode")!.text);

    expect(await disable(admin, login.user.id, "Reported as compromised")).toEqual({ revoked: 1 });

    // Its session is gone: the cookie, the bearer token and a sync token all read as signed out.
    expect(await getAuthUser(headers)).toBeNull();
    expect(await getAuthUser(bearer)).toBeNull();
    const token = await api().getToken({ headers, asResponse: true });
    const noSession = await api().getToken({ headers: new Headers(), asResponse: true });
    expect(await answer(token)).toEqual(await answer(noSession));
    expect(token.status).toBe(401);

    // Password: the right one reads as a wrong one.
    const right = await signIn(login.email);
    expect(right.headers.getSetCookie()).toEqual([]);
    expect(await answer(right)).toEqual(
      await answer(await signIn(stranger.email, "not the password at all")),
    );

    // The link and code sent before no longer sign in, like a wrong token or code.
    const verified = await api().magicLinkVerify({
      query: { token: linkToken, callbackURL: "/app", errorCallbackURL: "/sign-in" },
      headers: new Headers(),
      asResponse: true,
    });
    expect(verified.headers.get("location")).toContain("error=INVALID_TOKEN");
    const wrongCode = code === "000000" ? "111111" : "000000";
    const withCode = await post("/sign-in/email-otp", { email: login.email, otp: code });
    const otherCode = await post("/sign-in/email-otp", { email: stranger.email, otp: wrongCode });
    expect(await answer(withCode)).toEqual(await answer(otherCode));

    // New links, codes, resets: the unknown address's answer, and no email.
    const nobody = unknownEmail();
    const sentBefore = (await mailTo(login.email)).length;
    for (const ask of [
      (email: string) => api().signInMagicLink({ body: { email }, headers: new Headers(), asResponse: true }),
      sendCode,
      (email: string) => api().requestPasswordReset({ body: { email }, asResponse: true }),
    ]) {
      expect(await answer(await ask(login.email))).toEqual(await answer(await ask(nobody)));
    }
    expect(await mailTo(login.email)).toHaveLength(sentBefore);

    // Staff can't send it a reset either, and the disable is on its page.
    const help = { userId: login.user.id, reason: "Asked" };
    const mail = { mail: staffAccountMailer(admin.user.id) };
    expect(codeOf(await accountAdminService.sendReset(admin.ctx, help, mail))).toBe("accountAdmin:disabled");
    const page = ok(await accountAdminService.get(admin.ctx, login.user.id));
    expect(page.account).toMatchObject({
      disabledReason: "Reported as compromised",
      disabledBy: { id: admin.user.id, email: admin.user.email },
    });
    expect(page.sessions).toEqual([]);
    expect(await mailTo(login.email)).toHaveLength(sentBefore);
  });

  it("gets no verification email, and the right password still reads as wrong", async () => {
    const admin = await createUser("dsb-unv-admin", "admin");
    const login = await createLogin("dsb-unv", { verified: false });
    const stranger = await createLogin("dsb-unv-stranger");
    await disable(admin, login.user.id, "Spam");

    expect(await answer(await signIn(login.email))).toEqual(
      await answer(await signIn(stranger.email, "not the password at all")),
    );
    const resend = await api().sendVerificationEmail({ body: { email: login.email }, asResponse: true });
    expect(await answer(resend)).toEqual({ status: 200, body: { status: true } });
    const help = { userId: login.user.id, reason: "Asked" };
    const resent = await accountAdminService.resendVerification(admin.ctx, help, {
      mail: staffAccountMailer(admin.user.id),
    });
    expect(codeOf(resent)).toBe("accountAdmin:disabled");
    expect(await mailTo(login.email)).toEqual([]);
  });

  it("never gets a session, by any path", async () => {
    const admin = await createUser("dsb-session-admin", "admin");
    const login = await createLogin("dsb-session");
    await disable(admin, login.user.id, "Abuse");
    const { internalAdapter } = await getAuth().$context;
    await expect(internalAdapter.createSession(login.user.id)).rejects.toThrow();
    expect(await query(`select id from session where user_id = $1`, [login.user.id])).toEqual([]);
  });

  it("signs in again once re-enabled, with its groups as they were", async () => {
    const admin = await createUser("dsb-enable-admin", "admin");
    const login = await createLogin("dsb-enable");
    await disable(admin, login.user.id, "Mistaken report");
    expect((await signIn(login.email)).status).toBe(401);

    ok(
      await accountAdminService.enable(admin.ctx, { userId: login.user.id, reason: "Report was a mistake" }),
    );
    const res = await signIn(login.email);
    expect(res.status).toBe(200);
    expect(await getAuthUser(cookieHeaders(res))).toMatchObject({
      id: login.user.id,
      groupRoles: { [login.group.id]: "owner" },
    });
    const { token } = await api().getToken({ headers: cookieHeaders(res) });
    expect(token).toBeTruthy();
    await sendCode(login.email);
    expect((await mailTo(login.email)).map((m) => m.name)).toEqual(["signInCode"]);
    expect(await auditActions(login.user.id)).toEqual(["user.disable", "user.enable"]);
  });
});
