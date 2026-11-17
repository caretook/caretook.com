import type { AuthUser } from "@caretook/data";

import { DEFAULT_UNITS } from "@caretook/data";
import { createRouterClient, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createGroup, createUser } from "../../data/test/fixtures";
import { createRpcHandler, router } from ".";

// Each test makes its own users and group, so tests never depend on each other.

const clientFor = (authUser: AuthUser | null) => createRouterClient(router, { context: { authUser } });

/** An AuthUser as getAuthUser would build it, with the user's group roles. */
const withRoles = (authUser: AuthUser, groupRoles: AuthUser["groupRoles"]) => ({ ...authUser, groupRoles });

const setup = async () => {
  const owner = await createUser("owner");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");
  const { group, recipient } = await createGroup(owner, [{ user: viewer.user, role: "viewer" }]);
  return {
    group,
    recipient,
    owner: { ...owner, api: clientFor(withRoles(owner.ctx.authUser, { [group.id]: "owner" })) },
    viewer: { ...viewer, api: clientFor(withRoles(viewer.ctx.authUser, { [group.id]: "viewer" })) },
    outsider: { ...outsider, api: clientFor(withRoles(outsider.ctx.authUser, {})) },
  };
};

const note = (groupId: string) => ({
  groupId,
  kind: "note" as const,
  body: "Ate lunch",
  occurredAt: "2026-11-17T12:00:00-08:00",
  timeZone: "America/Los_Angeles",
});

/** The oRPC error a call rejects with. */
const rejection = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ORPCError)) throw new Error(`Expected an ORPCError, got ${String(error)}`);
  return error as ORPCError<string, { code?: string; issues?: { path: string; message: string }[] }>;
};

describe("auth", () => {
  it("rejects every procedure without a user", async () => {
    const api = clientFor(null);
    expect((await rejection(api.me.get())).code).toBe("UNAUTHORIZED");
    expect((await rejection(api.careGroup.listMine())).code).toBe("UNAUTHORIZED");
  });

  it("returns the signed-in user with their group roles", async () => {
    const { owner, group } = await setup();
    expect(await owner.api.me.get()).toEqual({
      id: owner.user.id,
      email: owner.user.email,
      name: "owner",
      image: null,
      groupRoles: { [group.id]: "owner" },
      preferences: {},
      units: DEFAULT_UNITS,
    });
  });
});

describe("me.updatePreferences", () => {
  it("merges unit choices into the user's own preferences", async () => {
    const { owner, viewer } = await setup();
    expect(await owner.api.me.updatePreferences({ units: { temperature: "c" } })).toEqual({
      preferences: { units: { temperature: "c" } },
      units: { ...DEFAULT_UNITS, temperature: "c" },
    });
    await owner.api.me.updatePreferences({ units: { weight: "kg" } });
    expect((await owner.api.me.get()).units).toEqual({ ...DEFAULT_UNITS, temperature: "c", weight: "kg" });
    // Someone else's settings are untouched.
    expect((await viewer.api.me.get()).units).toEqual(DEFAULT_UNITS);
  });

  it("rejects unknown units and unknown settings", async () => {
    const { owner } = await setup();
    const bad = [{ units: { temperature: "k" } }, { theme: "dark" }] as never[];
    for (const input of bad) {
      expect((await rejection(owner.api.me.updatePreferences(input))).code).toBe("BAD_REQUEST");
    }
  });
});

describe("careGroup", () => {
  it("lists only the user's groups, with role and recipient", async () => {
    const { viewer, outsider, group, recipient } = await setup();
    expect(await viewer.api.careGroup.listMine()).toEqual([
      {
        id: group.id,
        name: group.name,
        role: "viewer",
        recipient: { id: recipient.id, displayName: recipient.displayName },
      },
    ]);
    expect(await outsider.api.careGroup.listMine()).toEqual([]);
  });

  it("shows members as public profiles, without email", async () => {
    const { viewer, outsider, group, owner } = await setup();
    const members = await viewer.api.careGroup.members({ groupId: group.id });
    expect(members).toEqual(
      expect.arrayContaining([
        { userId: owner.user.id, role: "owner", name: "owner", image: null },
        { userId: viewer.user.id, role: "viewer", name: "viewer", image: null },
      ]),
    );
    expect(JSON.stringify(members)).not.toContain("@example.com");
    expect(await outsider.api.careGroup.members({ groupId: group.id })).toEqual([]);
  });
});

describe("timeline", () => {
  it("creates, lists, edits and deletes, with ISO timestamps", async () => {
    const { owner, viewer, group, recipient } = await setup();

    const created = await owner.api.timeline.create(note(group.id));
    expect(created).toMatchObject({ recipientId: recipient.id, occurredAt: "2026-11-17T20:00:00.000Z" });
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const page = await viewer.api.timeline.list({ groupId: group.id });
    expect(page).toEqual({ data: [created], nextCursor: null });

    const updated = await owner.api.timeline.update({ id: created.id, data: { body: "Ate all of lunch" } });
    expect(updated.body).toBe("Ate all of lunch");

    expect(await owner.api.timeline.remove({ id: created.id })).toEqual({ id: created.id });
    expect((await viewer.api.timeline.list({ groupId: group.id })).data).toEqual([]);
    const deleted = await viewer.api.timeline.list({ groupId: group.id, includeDeleted: true });
    expect(deleted.data[0]?.deletedAt).toMatch(/Z$/);
  });

  it("maps permission and not-found errors to HTTP-style codes", async () => {
    const { owner, viewer, outsider, group } = await setup();
    expect((await rejection(viewer.api.timeline.create(note(group.id)))).code).toBe("FORBIDDEN");
    expect((await rejection(outsider.api.timeline.create(note(group.id)))).code).toBe("FORBIDDEN");

    const entry = await owner.api.timeline.create(note(group.id));
    const missing = await rejection(outsider.api.timeline.remove({ id: entry.id }));
    expect(missing.code).toBe("NOT_FOUND");
    expect(missing.data).toEqual({ code: "timelineEntryService:notFound" });
  });

  it("returns validation issues as BAD_REQUEST", async () => {
    const { owner, group } = await setup();
    // Caught by the procedure's input schema.
    expect((await rejection(owner.api.timeline.create({ ...note(group.id), body: "" }))).code).toBe(
      "BAD_REQUEST",
    );
    // Caught by the service, against the merged entry.
    const entry = await owner.api.timeline.create(note(group.id));
    const error = await rejection(owner.api.timeline.update({ id: entry.id, data: { body: null } }));
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.data?.code).toBe("timelineEntryService:invalid");
    expect(error.data?.issues?.[0]).toMatchObject({ path: "body" });
  });

  it("pages with an opaque cursor", async () => {
    const { owner, group } = await setup();
    for (const occurredAt of ["2026-11-17T08:00:00Z", "2026-11-17T09:00:00Z", "2026-11-17T10:00:00Z"]) {
      await owner.api.timeline.create({ ...note(group.id), occurredAt });
    }
    const first = await owner.api.timeline.list({ groupId: group.id, limit: 2 });
    const second = await owner.api.timeline.list({ groupId: group.id, limit: 2, cursor: first.nextCursor });
    expect([...first.data, ...second.data]).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
  });
});

describe("HTTP handler", () => {
  const handle = createRpcHandler({ prefix: "/rpc", allowedOrigins: ["capacitor://localhost"] });

  const call = (path: string, init: RequestInit = {}) =>
    new Request(`http://localhost/rpc/${path}`, {
      method: "POST",
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      body: init.body ?? JSON.stringify({ json: {} }),
    });

  it("serves procedures to calls with the CSRF header", async () => {
    const { owner } = await setup();
    const res = await handle(call("me/get", { headers: { "x-csrf-token": "orpc" } }), owner.ctx.authUser);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(owner.user.id);
  });

  it("refuses calls without the CSRF header", async () => {
    const { owner } = await setup();
    const res = await handle(call("me/get"), owner.ctx.authUser);
    expect(res.status).toBe(403);
  });

  it("returns 401 without a user, and 404 for unknown paths", async () => {
    const headers = { "x-csrf-token": "orpc" };
    expect((await handle(call("me/get", { headers }), null)).status).toBe(401);
    expect((await handle(call("nope/nothing", { headers }), null)).status).toBe(404);
  });

  it("allows CORS only for listed origins", async () => {
    const preflight = (origin: string) =>
      handle(
        new Request("http://localhost/rpc/me/get", {
          method: "OPTIONS",
          headers: { origin, "access-control-request-method": "POST" },
        }),
        null,
      );
    expect((await preflight("capacitor://localhost")).headers.get("access-control-allow-origin")).toBe(
      "capacitor://localhost",
    );
    expect((await preflight("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
  });
});
