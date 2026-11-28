import type { AuthUser } from "@caretook/data";

import { isError, RATE_LIMIT_LONGEST_WINDOW_MS, timelineEntryService } from "@caretook/data";
import { setBackgroundRunner } from "@caretook/notifications";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { createRpcHandler } from "./handler";
import { createRateLimiter, createUserLimits, postgresStore, USER_LIMITS } from "./rateLimit";
import { clientFor, rejection, sqliteTime } from "./testing";

// The shared limiter (hosting PRD, slice 3) on the real `rate_limit_hit`
// table: two limiters stand for two server instances.

const scope = () => `test.${randomUUID().slice(0, 8)}`;

describe("postgresStore", () => {
  it("lets instances sharing the table allow exactly `limit` hits, even at once", async () => {
    const shared = scope();
    const a = createRateLimiter({ limit: 5, windowMs: 60_000, store: postgresStore(shared) });
    const b = createRateLimiter({ limit: 5, windowMs: 60_000, store: postgresStore(shared) });
    const now = Date.now();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).hit("203.0.113.9", now)),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    // Another key, and another scope with the same key, count on their own.
    expect(await a.hit("203.0.113.10", now)).toBe(true);
    const other = createRateLimiter({ limit: 5, windowMs: 60_000, store: postgresStore(scope()) });
    expect(await other.hit("203.0.113.9", now)).toBe(true);
  });

  it("slides: a hit frees its slot `windowMs` later, and refused hits aren't counted", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, store: postgresStore(scope()) });
    const t0 = Date.now();
    expect(await limiter.hit("a", t0)).toBe(true);
    expect(await limiter.hit("a", t0 + 100)).toBe(true);
    expect(await limiter.hit("a", t0 + 200)).toBe(false);
    expect(await limiter.hit("a", t0 + 999)).toBe(false);
    expect(await limiter.hit("a", t0 + 1001)).toBe(true);
    expect(await limiter.hit("a", t0 + 1050)).toBe(false);
    // The per-call limit (a setting read at call time) overrides the limiter's.
    expect(await limiter.hit("a", t0 + 1050, 3)).toBe(true);
    await limiter.reset();
    expect(await limiter.hit("a", t0 + 1050)).toBe(true);
  });

  it("refuses a window longer than the purge keeps rows", () => {
    expect(() =>
      createRateLimiter({
        limit: 1,
        windowMs: RATE_LIMIT_LONGEST_WINDOW_MS + 1,
        store: postgresStore(scope()),
      }),
    ).toThrow();
  });
});

// The per-user limits on signed-in procedures (account-security slice 6,
// B-334), on as in production, counting in Postgres, on a clock the test moves.

describe("per-user limits on signed-in procedures", () => {
  // Invite emails are delivered after the response; nothing here reads them.
  beforeAll(() => setBackgroundRunner(() => undefined));
  afterAll(() => setBackgroundRunner(null));

  const clock = () => {
    let t = Date.now();
    return { now: () => t, advance: (ms: number) => (t += ms) };
  };

  const withRoles = (authUser: AuthUser, groupId: string, role: "owner" | "viewer") => ({
    ...authUser,
    groupRoles: { ...authUser.groupRoles, [groupId]: role },
  });

  it("refuses the call past the default with a 429 and retry-after; another user is unaffected", async () => {
    const userLimits = createUserLimits({ enabled: true, limits: { default: { limit: 2 } } });
    const rpc = createRpcHandler({ prefix: "/rpc", userLimits });
    const a = await createUser("limit-a");
    const b = await createUser("limit-b");
    const call = (authUser: AuthUser) =>
      rpc(
        new Request("http://localhost/rpc/me/get", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
          body: JSON.stringify({ json: {} }),
        }),
        () => Promise.resolve(authUser),
      );

    expect((await call(a.ctx.authUser)).status).toBe(200);
    expect((await call(a.ctx.authUser)).status).toBe(200);
    const refused = await call(a.ctx.authUser);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe(String(USER_LIMITS.default.windowMs / 1000));
    expect(await refused.text()).toContain("TOO_MANY_REQUESTS");
    expect((await call(b.ctx.authUser)).status).toBe(200);
  });

  it("gives invite.resend its tighter limit, shared with createEmail", async () => {
    const userLimits = createUserLimits({ enabled: true, limits: { inviteEmail: { limit: 2 } } });
    const owner = await createUser("limit-inviter");
    const { group } = await createGroup(owner);
    const api = clientFor(withRoles(owner.ctx.authUser, group.id, "owner"), undefined, { userLimits });
    const invite = await api.invite.createEmail({
      groupId: group.id,
      email: `limit-${randomUUID().slice(0, 8)}@example.com`,
      role: "viewer",
      attested: true,
    });
    await api.invite.resend({ id: invite.id });
    const refused = await rejection(api.invite.resend({ id: invite.id }));
    expect(refused.code).toBe("TOO_MANY_REQUESTS");
    expect(refused.status).toBe(429);
    expect(refused.data).toMatchObject({ retryAfter: USER_LIMITS.inviteEmail.windowMs / 1000 });
    // Its own count: the default still lets other calls through.
    expect((await api.me.get()).id).toBe(owner.user.id);
  });

  it("limits sync.upload on its own: past it TOO_MANY_REQUESTS, and the change is saved after the wait", async () => {
    const time = clock();
    const userLimits = createUserLimits({
      enabled: true,
      limits: { sync: { limit: 1 }, default: { limit: 1 } },
      now: time.now,
    });
    const owner = await createUser("limit-sync");
    const { group, recipient } = await createGroup(owner);
    const authUser = withRoles(owner.ctx.authUser, group.id, "owner");
    const api = clientFor(authUser, undefined, { userLimits });
    const put = (id: string) => ({
      op: "PUT" as const,
      table: "timeline_entry",
      id,
      data: {
        group_id: group.id,
        recipient_id: recipient.id,
        kind: "note",
        occurred_at: sqliteTime(-60_000),
        time_zone: "America/Los_Angeles",
        title: "Slept well",
        body: null,
        details: null,
      },
    });
    const saved = async (id: string) => {
      const entry = await timelineEntryService.getById({ authUser }, id);
      return !isError(entry) && !!entry;
    };

    // The default's one call doesn't take sync's.
    await api.me.get();
    const first = randomUUID();
    expect((await api.sync.upload({ ops: [put(first)] })).results).toEqual([
      { id: first, status: "applied" },
    ]);

    const second = randomUUID();
    const refused = await rejection(api.sync.upload({ ops: [put(second)] }));
    expect(refused.code).toBe("TOO_MANY_REQUESTS");
    expect(refused.status).toBe(429);
    expect(await saved(second)).toBe(false);

    // The device keeps the change queued and sends it again once the window has passed.
    time.advance(USER_LIMITS.sync.windowMs + 1);
    expect((await api.sync.upload({ ops: [put(second)] })).results).toEqual([
      { id: second, status: "applied" },
    ]);
    expect(await saved(first)).toBe(true);
    expect(await saved(second)).toBe(true);
  });

  it("is off unless turned on (outside production)", async () => {
    const limits = createUserLimits({ enabled: false, limits: { default: { limit: 0 } } });
    expect(await limits.hit("default", randomUUID())).toBeNull();
  });
});
