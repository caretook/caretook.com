import type { AuthUser, FakeGoogleCalendar } from "@caretook/data";

import { createRouterClient, ORPCError } from "@orpc/server";
import { fakeGoogleCalendar, setCalendarBackgroundRunner, setGoogleCalendarClient } from "@caretook/data";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../../data/test/fixtures";
import { router } from "..";
import { handleGoogleCallback, handleGoogleConnect } from "./googleRoutes";

// Google Calendar over the API and its web-only routes (appointments-2
// slice 7), against the in-memory fake: Connect's redirect, the callback
// (a bad or expired state refused), `calendars.google.status` and
// `.disconnect`, and no token in anything they return. Made-up people.

let google: FakeGoogleCalendar;
// The pushes a connect starts after commit: awaited after each test, so none outlives it.
let pushes: Promise<unknown>[] = [];
beforeEach(() => {
  google = fakeGoogleCalendar();
  setGoogleCalendarClient(google);
  setCalendarBackgroundRunner((work) => pushes.push(work));
});
afterEach(async () => {
  await Promise.all(pushes);
  pushes = [];
});
afterAll(() => {
  setGoogleCalendarClient(undefined);
  setCalendarBackgroundRunner(null);
});

const APP = "http://localhost:5173";
const signedIn = (authUser: AuthUser | null) => ({ getAuthUser: () => Promise.resolve(authUser) });
const location = (res: Response) => res.headers.get("location") ?? "";

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return { owner, viewer, outsider, group };
};

/** Connect through both routes, as the browser would. */
const connectThroughRoutes = async (
  authUser: AuthUser,
  groupId: string,
  refreshToken = "1//fake-api-token",
) => {
  const started = await handleGoogleConnect(
    new Request(`${APP}/api/google/connect?groupId=${groupId}`),
    signedIn(authUser),
  );
  expect(started.status).toBe(302);
  const state = new URL(location(started)).searchParams.get("state")!;
  const code = google.grant({ refreshToken });
  return handleGoogleCallback(
    new Request(`${APP}/api/google/callback?code=${code}&state=${encodeURIComponent(state)}`),
    signedIn(authUser),
  );
};

describe("/api/google/connect", () => {
  it("sends a member on to Google's consent page", async () => {
    const { viewer, group } = await setup();
    const res = await handleGoogleConnect(
      new Request(`${APP}/api/google/connect?groupId=${group.id}`),
      signedIn(viewer.ctx.authUser),
    );
    expect(res.status).toBe(302);
    expect(location(res)).toMatch(
      /^https:\/\/accounts\.google\.example\/o\/oauth2\/auth\?state=.+&code_challenge=.+/,
    );
  });

  it("sends a signed-out visitor to sign in, an outsider a 404, and a bad id a 404", async () => {
    const { outsider, group } = await setup();
    const url = `${APP}/api/google/connect?groupId=${group.id}`;
    const out = await handleGoogleConnect(new Request(url), signedIn(null));
    expect(location(out)).toBe(
      `/sign-in?redirectTo=${encodeURIComponent(`/app/groups/${group.id}/settings/calendar`)}`,
    );
    expect((await handleGoogleConnect(new Request(url), signedIn(outsider.ctx.authUser))).status).toBe(404);
    const bad = await handleGoogleConnect(
      new Request(`${APP}/api/google/connect?groupId=nope`),
      signedIn(null),
    );
    expect(bad.status).toBe(404);
  });

  it("goes back to the page when Google isn't set up here", async () => {
    const { owner, group } = await setup();
    const res = await handleGoogleConnect(new Request(`${APP}/api/google/connect?groupId=${group.id}`), {
      ...signedIn(owner.ctx.authUser),
      client: null,
    });
    expect(location(res)).toBe(`/app/groups/${group.id}/settings/calendar?google=unavailable`);
  });
});

describe("/api/google/callback", () => {
  it("connects, then goes back to the group's Calendar & reminders page", async () => {
    const { owner, group } = await setup();
    const res = await connectThroughRoutes(owner.ctx.authUser, group.id);
    expect(location(res)).toBe(`/app/groups/${group.id}/settings/calendar?google=connected`);
    expect(google.calendars().map((c) => c.summary)).toEqual(["Caretook: Pat Example"]);
  });

  it("refuses an unknown, someone else's or an expired state", async () => {
    const { owner, viewer, group } = await setup();
    const code = google.grant();
    const unknown = await handleGoogleCallback(
      new Request(`${APP}/api/google/callback?code=${code}&state=made-up-state`),
      signedIn(owner.ctx.authUser),
    );
    expect(location(unknown)).toBe("/app?google=expired");

    const start = async (now?: Date) => {
      const res = await handleGoogleConnect(new Request(`${APP}/api/google/connect?groupId=${group.id}`), {
        ...signedIn(owner.ctx.authUser),
        now,
      });
      return new URL(location(res)).searchParams.get("state")!;
    };
    const callback = (state: string, who: AuthUser, now?: Date) =>
      handleGoogleCallback(
        new Request(`${APP}/api/google/callback?code=${google.grant()}&state=${encodeURIComponent(state)}`),
        { ...signedIn(who), now },
      );

    const theirs = await callback(await start(), viewer.ctx.authUser);
    expect(location(theirs)).toBe(`/app/groups/${group.id}/settings/calendar?google=expired`);

    const old = new Date(Date.now() - 11 * 60_000);
    const expired = await callback(await start(old), owner.ctx.authUser);
    expect(location(expired)).toBe(`/app/groups/${group.id}/settings/calendar?google=expired`);
    expect(google.calendars()).toEqual([]);
  });

  it("says so when the member says no at Google", async () => {
    const { owner, group } = await setup();
    const started = await handleGoogleConnect(
      new Request(`${APP}/api/google/connect?groupId=${group.id}`),
      signedIn(owner.ctx.authUser),
    );
    const state = new URL(location(started)).searchParams.get("state")!;
    const res = await handleGoogleCallback(
      new Request(`${APP}/api/google/callback?error=access_denied&state=${encodeURIComponent(state)}`),
      signedIn(owner.ctx.authUser),
    );
    expect(location(res)).toBe(`/app/groups/${group.id}/settings/calendar?google=denied`);
  });
});

describe("calendars.google", () => {
  const api = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });

  it("reports the member's own connection, never a token, and disconnects it", async () => {
    const { owner, viewer, group } = await setup();
    expect(await api(owner.ctx.authUser).calendars.google.status({ groupId: group.id })).toEqual({
      connected: false,
      configured: true,
    });
    await connectThroughRoutes(owner.ctx.authUser, group.id, "1//fake-never-returned");
    const status = await api(owner.ctx.authUser).calendars.google.status({ groupId: group.id });
    expect(status).toMatchObject({ connected: true, calendarName: "Caretook: Pat Example", error: null });
    expect(Object.keys(status).sort()).toEqual(
      ["calendarName", "configured", "connected", "error", "lastPulledAt", "lastPushedAt"].sort(),
    );
    expect(JSON.stringify(status)).not.toContain("fake-never-returned");
    // Each member sees only their own.
    expect(await api(viewer.ctx.authUser).calendars.google.status({ groupId: group.id })).toMatchObject({
      connected: false,
    });

    const done = await api(owner.ctx.authUser).calendars.google.disconnect({ groupId: group.id });
    expect(done).toEqual({ groupId: group.id, connected: false });
    expect(JSON.stringify(done)).not.toContain("fake-never-returned");
    expect(google.revoked()).toEqual(["1//fake-never-returned"]);
  });

  it("is for members only", async () => {
    const { outsider, group } = await setup();
    const error = await api(outsider.ctx.authUser)
      .calendars.google.status({ groupId: group.id })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, { code?: string }>).data?.code).toBe(
      "googleConnectionService:notMember",
    );
  });
});
