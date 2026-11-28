import type { AuthUserLookup } from "./procedures";

import { getAuth, getAuthConfig, getAuthUser } from "@caretook/auth";
import { accountSchema, getDb, newError } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { createRpcHandler } from "./handler";
import { MIN_FORM_MS } from "@caretook/data/domain";

// /rpc's session lookup (B-140): lazy (public procedures never look one
// up), one query for the account, its memberships and the live session row
// (B-339), and Better Auth's 3-minute session cookie cache, bypassed by
// staff procedures and /token.

const PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Plain SQL on the test database (this package doesn't depend on drizzle-orm). */
const query = (text: string, values: unknown[] = []) => getDb().$client.query(text, values);

/** A user who can sign in with email + password (`role` for staff). */
const createLogin = async (role: "admin" | "member" = "member") => {
  const login = await createUser("rpcauth", role);
  await query(`update "user" set email_verified = true where id = $1`, [login.user.id]);
  await getDb()
    .insert(accountSchema)
    .values({
      userId: login.user.id,
      providerId: "credential",
      accountId: login.user.id,
      password: await (await getAuth().$context).password.hash(PASSWORD),
    });
  return login;
};

/** A browser's cookie jar: what a response sets, sent on the next request. */
const jar = () => {
  const cookies = new Map<string, string>();
  return {
    take(res: Response) {
      for (const line of res.headers.getSetCookie()) {
        const [pair = "", ...attrs] = line.split(";");
        const [name = "", value = ""] = pair.split("=");
        const expired = !value || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a));
        if (expired) cookies.delete(name.trim());
        else cookies.set(name.trim(), value);
      }
    },
    names: () => [...cookies.keys()],
    headers: () =>
      new Headers({
        cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
      }),
  };
};

const signIn = async (email: string) => {
  const cookies = jar();
  const res = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(res.status).toBe(200);
  cookies.take(res);
  return cookies;
};

const rpc = createRpcHandler({ prefix: "/rpc" });

/** The /rpc mount point's lookup (apps/web routes/rpc.ts), counting its calls. */
const lookupFor = (headers: Headers) => {
  const calls: boolean[] = [];
  const lookup: AuthUserLookup = ({ live }) => {
    calls.push(live);
    return getAuthUser(headers, { live });
  };
  return { lookup, calls };
};

const call = (headers: Headers, path: string, json: unknown = {}) => {
  const { lookup, calls } = lookupFor(headers);
  const request = new Request(`http://localhost/rpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
    body: JSON.stringify({ json }),
  });
  return rpc(request, lookup).then((res) => ({ status: res.status, calls }));
};

/** PowerSync's token endpoint, as the device asks for it. */
const token = (headers: Headers, query = "") =>
  getAuth().handler(new Request(`${getAuthConfig().baseURL}/api/auth/token${query}`, { headers }));

const revokeSessions = (userId: string) => query(`delete from session where user_id = $1`, [userId]);

describe("the lazy AuthUser", () => {
  it("public procedures never look up a session", async () => {
    const login = await createLogin();
    const cookies = await signIn(login.user.email);
    const getSession = vi.spyOn(getAuth().api, "getSession");

    const announcement = await call(cookies.headers(), "public/announcement");
    const waitlist = await call(cookies.headers(), "public/waitlist/join", {
      email: `rpcauth-${randomUUID().slice(0, 8)}@example.com`,
      elapsedMs: MIN_FORM_MS + 1000,
    });

    expect([announcement.status, waitlist.status]).toEqual([200, 200]);
    expect([announcement.calls, waitlist.calls]).toEqual([[], []]);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("an authed procedure resolves it once per request, a staff one once and live", async () => {
    const staff = await createLogin("admin");
    const cookies = await signIn(staff.user.email);
    const getSession = vi.spyOn(getAuth().api, "getSession");

    const me = await call(cookies.headers(), "me/get");
    expect(me).toEqual({ status: 200, calls: [false] });
    expect(getSession).toHaveBeenCalledTimes(1);

    const codes = await call(cookies.headers(), "admin/accessCode/list");
    expect(codes).toEqual({ status: 200, calls: [true] });
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(getSession.mock.calls[1]?.[0]).toMatchObject({ query: { disableCookieCache: true } });
  });
});

describe("a lookup error", () => {
  it("is a 500, logged with its code and the procedure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("http://localhost/rpc/me/get", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
      body: JSON.stringify({ json: {} }),
    });
    const res = await rpc(request, () => Promise.resolve(newError({ code: "userModel:getAuthFacts" })));
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls.flat().map(String).join("\n");
    expect(line).toContain("code=userModel:getAuthFacts");
    expect(line).toContain("procedure=me.get");
  });
});

describe("the one-query lookup", () => {
  it("returns the AuthUser for a member of two groups", async () => {
    const member = await createLogin();
    const owner = await createUser("rpcauth-owner");
    const { group: own } = await createGroup(member);
    const { group: theirs } = await createGroup(owner, [{ user: member.user, role: "viewer" }]);
    const cookies = await signIn(member.user.email);

    const expected = {
      id: member.user.id,
      roleNames: ["member"],
      groupRoles: { [own.id]: "owner", [theirs.id]: "viewer" },
    };
    expect(await getAuthUser(cookies.headers())).toEqual(expected);
    expect(await getAuthUser(cookies.headers(), { live: true })).toEqual(expected);
  });

  it("returns no groups for a user in none, and null for a disabled account", async () => {
    const login = await createLogin();
    const cookies = await signIn(login.user.email);
    expect(await getAuthUser(cookies.headers())).toEqual({
      id: login.user.id,
      roleNames: ["member"],
      groupRoles: {},
    });

    // Read live even while the session is in the cookie cache.
    await query(`update "user" set disabled_at = now() where id = $1`, [login.user.id]);
    expect(await getAuthUser(cookies.headers())).toBeNull();
    expect((await call(cookies.headers(), "me/get")).status).toBe(401);
  });
});

describe("the session cookie cache", () => {
  it("is set at sign-in", async () => {
    const login = await createLogin();
    const cookies = await signIn(login.user.email);
    expect(cookies.names().some((name) => name.endsWith("session_data"))).toBe(true);
  });

  // The cache no longer stands in for the session's row (B-339): the
  // one-query lookup joins it, so a session revoked elsewhere is refused on
  // the next ordinary call, its fresh cache cookie notwithstanding.
  it("a session revoked elsewhere is refused on the next ordinary call, despite a fresh cache cookie", async () => {
    const login = await createLogin();
    const cookies = await signIn(login.user.email);
    const other = await signIn(login.user.email);
    expect((await call(cookies.headers(), "me/get")).status).toBe(200);

    // Signed out from the other device (the Devices page's "sign out everywhere").
    const res = await getAuth().api.revokeOtherSessions({ headers: other.headers(), asResponse: true });
    expect(res.status).toBe(200);
    expect(cookies.names().some((name) => name.endsWith("session_data"))).toBe(true);

    expect((await call(cookies.headers(), "me/get")).status).toBe(401);
    expect(await getAuthUser(cookies.headers())).toBeNull();
    // The device that asked keeps its session.
    expect((await call(other.headers(), "me/get")).status).toBe(200);
  });

  it("a session deleted from the table stops ordinary calls at once, not after 3 minutes", async () => {
    const login = await createLogin();
    const cookies = await signIn(login.user.email);
    expect((await call(cookies.headers(), "me/get")).status).toBe(200);
    await revokeSessions(login.user.id);
    expect((await call(cookies.headers(), "me/get")).status).toBe(401);
  });

  it("a revoked session can't call a staff procedure or mint a sync token, at once", async () => {
    const staff = await createLogin("admin");
    const cookies = await signIn(staff.user.email);
    expect((await call(cookies.headers(), "admin/accessCode/list")).status).toBe(200);
    expect((await token(cookies.headers())).status).toBe(200);

    await revokeSessions(staff.user.id);

    expect((await call(cookies.headers(), "me/get")).status).toBe(401);
    expect((await call(cookies.headers(), "admin/accessCode/list")).status).toBe(401);
    expect((await token(cookies.headers())).status).toBe(401);
    // Whatever the client asks for.
    expect((await token(cookies.headers(), "?disableCookieCache=")).status).toBe(401);
  });

  it("is cleared at sign-out, so the cookie no longer authorizes", async () => {
    const login = await createLogin();
    const cookies = await signIn(login.user.email);
    expect((await call(cookies.headers(), "me/get")).status).toBe(200);

    const res = await getAuth().api.signOut({ headers: cookies.headers(), asResponse: true });
    expect(res.status).toBe(200);
    cookies.take(res);

    expect(cookies.names()).toEqual([]);
    expect((await call(cookies.headers(), "me/get")).status).toBe(401);
    expect((await token(cookies.headers())).status).toBe(401);
  });
});
