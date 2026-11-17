import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { accountSchema, getDb, isError, userService } from "@caretook/data";
import { createGroup, createUser, ok, system } from "../../data/test/fixtures";
import { getAuth, getAuthUser } from ".";

// Each test makes its own user and group, so tests never depend on each other.

const PASSWORD = "correct horse battery staple";

/** A user who can sign in with email + password, owning a fresh group. */
const createLogin = async () => {
  const login = await createUser("auth");
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
