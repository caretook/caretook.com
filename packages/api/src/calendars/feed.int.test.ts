import type { AuthUser } from "@caretook/data";

import { createHash } from "node:crypto";
import { createRouterClient, ORPCError } from "@orpc/server";
import {
  calendarFeedService,
  entryProviderService,
  memberCalendarSettingModel,
  providerService,
  SYSTEM_USER,
  todoService,
  timelineEntryModel,
  timelineEntryService,
} from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../../data/test/fixtures";
import { router } from "..";
import { createRateLimiter, memoryStore } from "../rateLimit";
import { createFeedHandler, FEED_MAX_AGE } from "./feed";

// The calendar feed (appointments-2 slice 5): the service's tokens (stored
// as a hash, shown once, rotated, revoked, a former member's dead), the
// procedures, and `GET /api/calendar/<token>.ics` through its handler:
// headers, the 90-day window, the rate limit, generic versus details. All
// people and places are made up.

const NOW = new Date("2026-11-18T18:00:00Z");
const DAY = 86_400_000;
const APP_URL = "https://app.caretook.test";
const daysFrom = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

const clientFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

const rejection = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error as ORPCError<string, { code?: string }>;
};

const setup = async () => {
  const people = {
    owner: await createUser("owner"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const { group, recipient } = await createGroup(people.owner, [
    { user: people.caretaker.user, role: "caretaker" },
    { user: people.viewer.user, role: "viewer" },
  ]);
  type Who = keyof typeof people;
  const api = (who: Who) => clientFor(people[who].ctx.authUser);
  const ctx = (who: Who) => people[who].ctx;
  const id = (who: Who) => people[who].user.id;

  const entry = async (overrides: Record<string, unknown>) =>
    ok(
      await timelineEntryService.create(ctx("caretaker"), {
        groupId: group.id,
        kind: "event",
        title: "Kidney check",
        place: "Mercy Clinic",
        occurredAt: daysFrom(2),
        endsAt: new Date(NOW.getTime() + 2 * DAY + 3_600_000).toISOString(),
        timeZone: "America/Los_Angeles",
        ...overrides,
      }),
    )!;

  /** A fresh handler with generous limits, unless the test sets its own. */
  const handler = (limits?: { perIp: number; perToken: number }) =>
    createFeedHandler({
      appUrl: () => APP_URL,
      now: () => NOW,
      ipLimiter: createRateLimiter({ limit: limits?.perIp ?? 1000, windowMs: 60_000, store: memoryStore() }),
      tokenLimiter: createRateLimiter({
        limit: limits?.perToken ?? 1000,
        windowMs: 60_000,
        store: memoryStore(),
      }),
    });

  return { group, recipient, api, ctx, id, entry, handler };
};

type Setup = Awaited<ReturnType<typeof setup>>;

const tokenOf = (url: string) => /\/api\/calendar\/([^/]+)\.ics$/.exec(url)![1]!;

const fetchFeed = (
  handle: ReturnType<Setup["handler"]>,
  file: string,
  init: { method?: string; ip?: string } = {},
) =>
  handle(new Request(`${APP_URL}/api/calendar/${file}`, { method: init.method ?? "GET" }), {
    file,
    clientIp: init.ip ?? "203.0.113.7",
  });

/** The member's feed: its URL (from the API) and its token. */
const makeFeed = async (s: Setup, who: "owner" | "caretaker" | "viewer") => {
  const { url } = await s.api(who).calendars.feed.create({ groupId: s.group.id });
  return { url, token: tokenOf(url), file: `${tokenOf(url)}.ics` };
};

const hashOf = async (groupId: string, userId: string) => {
  const row = ok(
    await memberCalendarSettingModel.get({
      authUser: SYSTEM_USER,
      filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
    }),
  );
  return row?.feedTokenHash ?? null;
};

describe("calendars.feed: tokens", () => {
  it.each(["owner", "caretaker", "viewer"] as const)(
    "lets a %s make a feed, and stores only a hash",
    async (who) => {
      const s = await setup();
      const { url, token } = await makeFeed(s, who);
      expect(url).toMatch(/^https?:\/\/[^/]+\/api\/calendar\/[A-Za-z0-9_-]{43}\.ics$/);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const stored = await hashOf(s.group.id, s.id(who));
      expect(stored).toBe(createHash("sha256").update(token).digest("hex"));
      expect(stored).not.toContain(token);

      // Never returned again: the settings say only that one is on, and when it was made.
      const view = await s.api(who).calendars.settings.get({ groupId: s.group.id });
      expect(view.feed).toMatchObject({ active: true });
      expect(view.feed.rotatedAt).toEqual(expect.any(String));
      expect(JSON.stringify(view)).not.toContain(token);
      expect(JSON.stringify(view)).not.toContain(stored!);
    },
  );

  it("refuses a second create (regenerate instead), a non-member, and keeps one feed per member", async () => {
    const s = await setup();
    await makeFeed(s, "caretaker");
    const again = await rejection(s.api("caretaker").calendars.feed.create({ groupId: s.group.id }));
    expect(again.data?.code).toBe("calendarFeedService:exists");
    const outsider = await rejection(s.api("outsider").calendars.feed.create({ groupId: s.group.id }));
    expect(outsider.data?.code).toBe("calendarFeedService:notMember");
    expect(await hashOf(s.group.id, s.id("outsider"))).toBeNull();
  });

  it("rotates: the new link works and the old one is a 404", async () => {
    const s = await setup();
    const handle = s.handler();
    const first = await makeFeed(s, "caretaker");
    expect((await fetchFeed(handle, first.file)).status).toBe(200);

    const { url } = await s.api("caretaker").calendars.feed.rotate({ groupId: s.group.id });
    const second = tokenOf(url);
    expect(second).not.toBe(first.token);
    expect((await fetchFeed(handle, first.file)).status).toBe(404);
    expect((await fetchFeed(handle, `${second}.ics`)).status).toBe(200);
  });

  it("rotates a member with no feed yet (it makes one)", async () => {
    const s = await setup();
    const { url } = await s.api("viewer").calendars.feed.rotate({ groupId: s.group.id });
    expect((await fetchFeed(s.handler(), `${tokenOf(url)}.ics`)).status).toBe(200);
  });

  it("revokes: the link is a 404 and the settings say it's off; revoking again is harmless", async () => {
    const s = await setup();
    const handle = s.handler();
    const { file } = await makeFeed(s, "viewer");
    expect(await s.api("viewer").calendars.feed.revoke({ groupId: s.group.id })).toEqual({ revoked: true });
    expect((await fetchFeed(handle, file)).status).toBe(404);
    expect(await hashOf(s.group.id, s.id("viewer"))).toBeNull();
    expect((await s.api("viewer").calendars.settings.get({ groupId: s.group.id })).feed).toEqual({
      active: false,
      rotatedAt: null,
    });
    expect(await s.api("viewer").calendars.feed.revoke({ groupId: s.group.id })).toEqual({ revoked: false });
  });

  it("only changes the caller's own feed", async () => {
    const s = await setup();
    const handle = s.handler();
    const mine = await makeFeed(s, "caretaker");
    const theirs = await makeFeed(s, "viewer");
    await s.api("caretaker").calendars.feed.revoke({ groupId: s.group.id });
    expect((await fetchFeed(handle, mine.file)).status).toBe(404);
    expect((await fetchFeed(handle, theirs.file)).status).toBe(200);
  });

  it("resolves a token to its member and group, and nothing for junk", async () => {
    const s = await setup();
    const { token } = await makeFeed(s, "caretaker");
    expect(await calendarFeedService.resolve(token)).toMatchObject({
      userId: s.id("caretaker"),
      groupId: s.group.id,
      role: "caretaker",
      level: "generic",
    });
    expect(await calendarFeedService.resolve("x".repeat(43))).toBeNull();
    expect(await calendarFeedService.resolve("short")).toBeNull();
  });

  it("kills the feed of a member who leaves or is removed", async () => {
    const s = await setup();
    const handle = s.handler();
    const caretaker = await makeFeed(s, "caretaker");
    const viewer = await makeFeed(s, "viewer");
    expect((await fetchFeed(handle, caretaker.file)).status).toBe(200);

    await s.api("caretaker").careGroup.removeMember({ groupId: s.group.id, userId: s.id("caretaker") });
    await s.api("owner").careGroup.removeMember({ groupId: s.group.id, userId: s.id("viewer") });
    for (const file of [caretaker.file, viewer.file]) {
      const gone = await fetchFeed(handle, file);
      expect(gone.status).toBe(404);
      expect(await gone.text()).toBe("");
    }
  });
});

describe("GET /api/calendar/<token>.ics", () => {
  it("answers text/calendar, private for five minutes, with the group's calendar", async () => {
    const s = await setup();
    await s.entry({});
    const { file } = await makeFeed(s, "caretaker");
    const res = await fetchFeed(s.handler(), file);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/calendar/);
    expect(res.headers.get("cache-control")).toBe(`private, max-age=${FEED_MAX_AGE}`);
    expect(FEED_MAX_AGE).toBe(300);
    const ics = await res.text();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:Caretook: Pat Example");
    expect(ics).toContain("SUMMARY:Appointment for Pat Example");
  });

  it("lets a viewer have a feed too", async () => {
    const s = await setup();
    await s.entry({});
    const { file } = await makeFeed(s, "viewer");
    const ics = await (await fetchFeed(s.handler(), file)).text();
    expect(ics).toContain("SUMMARY:Appointment for Pat Example");
  });

  it("holds appointments and dated open todos from 90 days back to 90 ahead", async () => {
    const s = await setup();
    const inside = await s.entry({ occurredAt: daysFrom(-60), endsAt: null });
    const early = await s.entry({ occurredAt: daysFrom(-120), endsAt: null });
    const far = await s.entry({ occurredAt: daysFrom(120), endsAt: null });
    const logged = await s.entry({
      kind: "note",
      title: "Slept well",
      place: null,
      endsAt: null,
      occurredAt: daysFrom(-1),
    });
    // A stored future note (left from before notes were past-only) is no item either.
    const planned = ok(
      await timelineEntryModel.create({
        ...system,
        data: {
          groupId: s.group.id,
          recipientId: s.recipient.id,
          kind: "note",
          title: "Call the pharmacy",
          occurredAt: daysFrom(2),
          timeZone: "America/Los_Angeles",
        },
      }),
    )!;
    const cancelled = await s.entry({ occurredAt: daysFrom(3), endsAt: null });
    ok(
      await timelineEntryService.update(s.ctx("caretaker"), cancelled.id, { cancelledAt: NOW.toISOString() }),
    );
    const deleted = await s.entry({ occurredAt: daysFrom(4), endsAt: null });
    ok(await timelineEntryService.remove(s.ctx("caretaker"), deleted.id));
    const due = ok(
      await todoService.create(s.ctx("caretaker"), {
        groupId: s.group.id,
        title: "Pick up walker",
        dueOn: "2026-11-25",
      }),
    )!;
    const undated = ok(
      await todoService.create(s.ctx("caretaker"), { groupId: s.group.id, title: "Someday" }),
    )!;
    const done = ok(
      await todoService.create(s.ctx("caretaker"), {
        groupId: s.group.id,
        title: "Done one",
        dueOn: "2026-11-26",
      }),
    )!;
    ok(await todoService.complete(s.ctx("caretaker"), done.id));

    const { file } = await makeFeed(s, "viewer");
    const ics = (await (await fetchFeed(s.handler(), file)).text()).replaceAll("\r\n", "\n");
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    const has = (uid: string) => uids.includes(`${uid}@app.caretook.test`);
    expect(has(`entry:${inside.id}`)).toBe(true);
    expect(has(`entry:${cancelled.id}`)).toBe(true);
    expect(has(`todo:${due.id}`)).toBe(true);
    for (const left of [early, far, logged, planned, deleted]) expect(has(`entry:${left.id}`)).toBe(false);
    for (const left of [undated, done]) expect(has(`todo:${left.id}`)).toBe(false);
    // Only the cancelled appointment is marked cancelled.
    expect(ics.match(/STATUS:CANCELLED/g)).toHaveLength(1);
    expect(ics).toContain(`UID:entry:${cancelled.id}@app.caretook.test\n`);
    expect(ics.split("BEGIN:VEVENT").filter((part) => part.includes("STATUS:CANCELLED"))[0]).toContain(
      `entry:${cancelled.id}`,
    );
  });

  it("is generic until the member opts in, and generic again if the owners forbid details", async () => {
    const s = await setup();
    const event = await s.entry({});
    const clinic = ok(
      await providerService.create(s.ctx("caretaker"), {
        groupId: s.group.id,
        type: "practice",
        name: "Mercy Clinic Group",
      }),
    )!;
    ok(
      await entryProviderService.link(s.ctx("caretaker"), {
        groupId: s.group.id,
        entryId: event.id,
        providerId: clinic.id,
      }),
    );
    const handle = s.handler();
    const { file } = await makeFeed(s, "caretaker");
    const read = async () => (await (await fetchFeed(handle, file)).text()).replaceAll("\r\n", "\n");

    const generic = await read();
    for (const secret of ["Kidney check", "Mercy Clinic", "Mercy Clinic Group"])
      expect(generic).not.toContain(secret);

    await s.api("caretaker").calendars.settings.update({ groupId: s.group.id, detailsConsent: true });
    const details = await read();
    expect(details).toContain("Appointment for Pat Example: Kidney check");
    expect(details).toContain("LOCATION:Mercy Clinic");
    expect(details).toContain("With Mercy Clinic Group");

    await s.api("owner").calendars.group.setDetailsAllowed({ groupId: s.group.id, allowed: false });
    const forbidden = await read();
    expect(forbidden).not.toContain("Kidney check");

    await s.api("caretaker").calendars.settings.update({ groupId: s.group.id, detailsConsent: false });
    await s.api("owner").calendars.group.setDetailsAllowed({ groupId: s.group.id, allowed: true });
    expect(await read()).not.toContain("Kidney check");
  });

  it("answers an unknown, malformed or wrongly named token with a bodyless 404", async () => {
    const s = await setup();
    const handle = s.handler();
    const { token } = await makeFeed(s, "caretaker");
    const cases = [
      `${"A".repeat(43)}.ics`,
      "nope.ics",
      ".ics",
      token, // no extension
      `${token}.ical`,
      `${token}.ics.txt`,
    ];
    for (const file of cases) {
      const res = await fetchFeed(handle, file);
      expect(res.status, file).toBe(404);
      expect(await res.text()).toBe("");
    }
  });

  it("serves GET and HEAD only", async () => {
    const s = await setup();
    const { file } = await makeFeed(s, "caretaker");
    const post = await fetchFeed(s.handler(), file, { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD");
    expect((await fetchFeed(s.handler(), file, { method: "HEAD" })).status).toBe(200);
  });

  it("limits requests per client IP and per token, with Retry-After", async () => {
    const s = await setup();
    const { file } = await makeFeed(s, "caretaker");

    const perIp = s.handler({ perIp: 2, perToken: 100 });
    expect((await fetchFeed(perIp, file, { ip: "198.51.100.1" })).status).toBe(200);
    expect((await fetchFeed(perIp, "nope.ics", { ip: "198.51.100.1" })).status).toBe(404);
    const blocked = await fetchFeed(perIp, file, { ip: "198.51.100.1" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    expect(await blocked.text()).toBe("");
    // Another address is counted on its own.
    expect((await fetchFeed(perIp, file, { ip: "198.51.100.2" })).status).toBe(200);

    const perToken = s.handler({ perIp: 100, perToken: 2 });
    expect((await fetchFeed(perToken, file, { ip: "198.51.100.3" })).status).toBe(200);
    expect((await fetchFeed(perToken, file, { ip: "198.51.100.4" })).status).toBe(200);
    expect((await fetchFeed(perToken, file, { ip: "198.51.100.5" })).status).toBe(429);
  });

  it("never says the token in its answers or the limiter's keys", async () => {
    const s = await setup();
    const { file, token } = await makeFeed(s, "caretaker");
    const keys: string[] = [];
    const spy = {
      hit: (key: string) => (keys.push(key), Promise.resolve(true)),
      reset: () => Promise.resolve(),
    };
    const handle = createFeedHandler({
      appUrl: () => APP_URL,
      now: () => NOW,
      ipLimiter: spy,
      tokenLimiter: spy,
    });
    const res = await fetchFeed(handle, file);
    expect(await res.text()).not.toContain(token);
    expect(keys).toHaveLength(2);
    for (const key of keys) expect(key).not.toContain(token);
    expect(keys[1]).toBe(createHash("sha256").update(token).digest("hex"));
  });
});
