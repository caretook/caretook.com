import type { AuthUser } from "@caretook/data";

import {
  DEFAULT_TIMELINE_VIEW,
  DEFAULT_UNITS,
  isError,
  noteDocumentService,
  timelineEntryService,
} from "@caretook/data";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
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
  title: "Ate lunch",
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
      timelineView: DEFAULT_TIMELINE_VIEW,
      easyMode: "full",
      daySummary: "highlights",
    });
  });
});

describe("me.updatePreferences", () => {
  it("merges unit choices into the user's own preferences", async () => {
    const { owner, viewer } = await setup();
    expect(await owner.api.me.updatePreferences({ units: { temperature: "c" } })).toEqual({
      preferences: { units: { temperature: "c" } },
      units: { ...DEFAULT_UNITS, temperature: "c" },
      timelineView: DEFAULT_TIMELINE_VIEW,
      easyMode: "full",
      daySummary: "highlights",
    });
    await owner.api.me.updatePreferences({ units: { weight: "kg" } });
    expect((await owner.api.me.get()).units).toEqual({ ...DEFAULT_UNITS, temperature: "c", weight: "kg" });
    // Someone else's settings are untouched.
    expect((await viewer.api.me.get()).units).toEqual(DEFAULT_UNITS);
  });

  it("saves the timeline view without touching units", async () => {
    const { owner } = await setup();
    await owner.api.me.updatePreferences({ units: { temperature: "c" } });
    await owner.api.me.updatePreferences({ timelineView: "cards" });
    const me = await owner.api.me.get();
    expect(me.timelineView).toBe("cards");
    expect(me.units.temperature).toBe("c");
  });

  it("saves the day summaries setting", async () => {
    const { owner } = await setup();
    await owner.api.me.updatePreferences({ daySummary: "off" });
    const me = await owner.api.me.get();
    expect(me.daySummary).toBe("off");
    expect(me.timelineView).toBe(DEFAULT_TIMELINE_VIEW);
  });

  it("rejects unknown units and unknown settings", async () => {
    const { owner } = await setup();
    const bad = [
      { units: { temperature: "k" } },
      { theme: "dark" },
      { timelineView: "grid" },
      { easyMode: "sometimes" },
      { daySummary: "some" },
    ] as never[];
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

describe("careGroup: group settings", () => {
  const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;

  /** A new group with one member per role, plus someone outside it. */
  const settingsSetup = async () => {
    const owner = await createUser("owner");
    const admin = await createUser("admin");
    const caretaker = await createUser("caretaker");
    const viewer = await createUser("viewer");
    const outsider = await createUser("outsider");
    const { group, recipient } = await createGroup(owner, [
      { user: admin.user, role: "admin" },
      { user: caretaker.user, role: "caretaker" },
      { user: viewer.user, role: "viewer" },
    ]);
    const api = (who: typeof owner, role?: (typeof ROLES)[number]) =>
      clientFor(withRoles(who.ctx.authUser, role ? { [group.id]: role } : {}));
    return {
      group,
      recipient,
      owner: api(owner, "owner"),
      admin: api(admin, "admin"),
      caretaker: api(caretaker, "caretaker"),
      viewer: api(viewer, "viewer"),
      outsider: api(outsider),
      ids: {
        owner: owner.user.id,
        admin: admin.user.id,
        caretaker: caretaker.user.id,
        viewer: viewer.user.id,
        outsider: outsider.user.id,
      },
    };
  };

  const profileOf = (recipient: { id: string; groupId: string }, over: object = {}) => ({
    id: recipient.id,
    groupId: recipient.groupId,
    name: "Pat Example",
    preferredName: null,
    dateOfBirth: null,
    codeStatus: null,
    bloodType: null,
    primaryLanguage: null,
    pronouns: null,
    notes: null,
    timeZone: "America/Los_Angeles",
    ...over,
  });

  describe("update", () => {
    it.each(["owner", "admin"] as const)("lets an %s rename the group, trimmed", async (role) => {
      const s = await settingsSetup();
      expect(await s[role].careGroup.update({ groupId: s.group.id, name: "  Example Family  " })).toEqual({
        id: s.group.id,
        name: "Example Family",
        easyTiles: null,
      });
      expect((await s.viewer.careGroup.listMine())[0]?.name).toBe("Example Family");
    });

    it.each(["caretaker", "viewer"] as const)(
      "refuses a %s with a 403, and changes nothing",
      async (role) => {
        const s = await settingsSetup();
        const error = await rejection(s[role].careGroup.update({ groupId: s.group.id, name: "Renamed" }));
        expect(error.code).toBe("FORBIDDEN");
        expect((await s.owner.careGroup.listMine())[0]?.name).toBe(s.group.name);
      },
    );

    it("answers a non-member with a 404, and changes nothing", async () => {
      const s = await settingsSetup();
      const error = await rejection(s.outsider.careGroup.update({ groupId: s.group.id, name: "Renamed" }));
      expect(error.code).toBe("NOT_FOUND");
      expect((await s.owner.careGroup.listMine())[0]?.name).toBe(s.group.name);
    });

    it("refuses an empty, blank or overlong name", async () => {
      const s = await settingsSetup();
      for (const name of ["", "   ", "x".repeat(121)]) {
        expect((await rejection(s.owner.careGroup.update({ groupId: s.group.id, name }))).code).toBe(
          "BAD_REQUEST",
        );
      }
      expect((await s.owner.careGroup.listMine())[0]?.name).toBe(s.group.name);
    });
  });

  describe("recipient", () => {
    it.each(ROLES)("shows the profile to a member (%s), and nothing else", async (role) => {
      const s = await settingsSetup();
      await s.owner.careGroup.updateRecipient({ groupId: s.group.id, dateOfBirth: "1941-03-09" });
      expect(await s[role].careGroup.recipient({ groupId: s.group.id })).toEqual(
        profileOf(s.recipient, { dateOfBirth: "1941-03-09" }),
      );
    });

    it("answers a non-member with a 404", async () => {
      const s = await settingsSetup();
      expect((await rejection(s.outsider.careGroup.recipient({ groupId: s.group.id }))).code).toBe(
        "NOT_FOUND",
      );
    });
  });

  describe("updateRecipient", () => {
    it.each(["owner", "admin", "caretaker"] as const)("lets a %s edit the profile", async (role) => {
      const s = await settingsSetup();
      const saved = await s[role].careGroup.updateRecipient({
        groupId: s.group.id,
        name: "  Patricia Example ",
        preferredName: " Pat ",
        dateOfBirth: "1941-03-09",
      });
      const expected = profileOf(s.recipient, {
        name: "Patricia Example",
        preferredName: "Pat",
        dateOfBirth: "1941-03-09",
      });
      expect(saved).toEqual(expected);
      expect(await s.viewer.careGroup.recipient({ groupId: s.group.id })).toEqual(expected);
      expect((await s.viewer.careGroup.listMine())[0]?.recipient?.displayName).toBe("Pat");
    });

    it("keeps fields left out, and clears a preferred name or date of birth", async () => {
      const s = await settingsSetup();
      const groupId = s.group.id;
      await s.owner.careGroup.updateRecipient({ groupId, preferredName: "Pat", dateOfBirth: "1941-03-09" });
      expect(await s.owner.careGroup.updateRecipient({ groupId, name: "Patricia Example" })).toEqual(
        profileOf(s.recipient, { name: "Patricia Example", preferredName: "Pat", dateOfBirth: "1941-03-09" }),
      );
      expect(await s.owner.careGroup.updateRecipient({ groupId })).toMatchObject({ preferredName: "Pat" });
      expect(
        await s.owner.careGroup.updateRecipient({ groupId, preferredName: "", dateOfBirth: null }),
      ).toEqual(profileOf(s.recipient, { name: "Patricia Example" }));
    });

    it("refuses a viewer with a 403, and changes nothing", async () => {
      const s = await settingsSetup();
      const error = await rejection(
        s.viewer.careGroup.updateRecipient({ groupId: s.group.id, name: "Renamed" }),
      );
      expect(error.code).toBe("FORBIDDEN");
      expect(await s.owner.careGroup.recipient({ groupId: s.group.id })).toEqual(profileOf(s.recipient));
    });

    it("answers a non-member with a 404, and changes nothing", async () => {
      const s = await settingsSetup();
      const error = await rejection(
        s.outsider.careGroup.updateRecipient({ groupId: s.group.id, name: "Renamed" }),
      );
      expect(error.code).toBe("NOT_FOUND");
      expect(await s.owner.careGroup.recipient({ groupId: s.group.id })).toEqual(profileOf(s.recipient));
    });

    it("refuses an empty name and a date of birth that isn't a date, naming the field", async () => {
      const s = await settingsSetup();
      const groupId = s.group.id;
      const bad = [
        { input: { name: "  " }, field: "name" },
        { input: { dateOfBirth: "not a date" }, field: "dateOfBirth" },
        { input: { dateOfBirth: "1941-02-30" }, field: "dateOfBirth" },
        { input: { preferredName: "x".repeat(121) }, field: "preferredName" },
      ];
      for (const { input, field } of bad) {
        const error = await rejection(s.owner.careGroup.updateRecipient({ groupId, ...input }));
        expect(error.code).toBe("BAD_REQUEST");
        expect(JSON.stringify(error.data?.issues)).toContain(field);
      }
      expect(await s.owner.careGroup.recipient({ groupId })).toEqual(profileOf(s.recipient));
    });

    it("changes the time zone alone, keeping the profile", async () => {
      const s = await settingsSetup();
      const groupId = s.group.id;
      await s.owner.careGroup.updateRecipient({ groupId, preferredName: "Pat" });
      const expected = profileOf(s.recipient, { preferredName: "Pat", timeZone: "America/New_York" });
      expect(await s.caretaker.careGroup.updateRecipient({ groupId, timeZone: "America/New_York" })).toEqual(
        expected,
      );
      expect(await s.viewer.careGroup.recipient({ groupId })).toEqual(expected);
    });

    it("refuses an unknown time zone, naming the field, and keeps the old one", async () => {
      const s = await settingsSetup();
      const groupId = s.group.id;
      for (const timeZone of ["Mars/Olympus_Mons", "", "not a zone"]) {
        const error = await rejection(s.owner.careGroup.updateRecipient({ groupId, timeZone }));
        expect(error.code).toBe("BAD_REQUEST");
        expect(JSON.stringify(error.data?.issues)).toContain("timeZone");
      }
      expect(await s.owner.careGroup.recipient({ groupId })).toEqual(profileOf(s.recipient));
    });

    it("refuses a viewer's time zone change with a 403", async () => {
      const s = await settingsSetup();
      const error = await rejection(
        s.viewer.careGroup.updateRecipient({ groupId: s.group.id, timeZone: "America/New_York" }),
      );
      expect(error.code).toBe("FORBIDDEN");
      expect(await s.owner.careGroup.recipient({ groupId: s.group.id })).toEqual(profileOf(s.recipient));
    });

    it("accepts a future date of birth (the shared schema has no such rule)", async () => {
      const s = await settingsSetup();
      expect(
        await s.owner.careGroup.updateRecipient({ groupId: s.group.id, dateOfBirth: "2999-01-01" }),
      ).toMatchObject({ dateOfBirth: "2999-01-01" });
    });
  });

  // Members (app-shell slice 6).
  type Settings = Awaited<ReturnType<typeof settingsSetup>>;
  type Role = (typeof ROLES)[number];
  const OWNER_ONLY = "Only an owner can add, change or remove owners";
  const LAST_OWNER = "A care group needs at least one owner. Make someone else an owner first.";

  /** Each member's role, by the label `settingsSetup` gave them (as `who` sees it). */
  const rolesOf = async (s: Settings, who: Role = "owner") => {
    const members = await s[who].careGroup.members({ groupId: s.group.id });
    const label = (userId: string) => ROLES.find((r) => s.ids[r] === userId) ?? userId;
    return Object.fromEntries(members.map((m) => [label(m.userId), m.role]));
  };
  const SEEDED = { owner: "owner", admin: "admin", caretaker: "caretaker", viewer: "viewer" };

  describe("changeRole", () => {
    const change = (s: Settings, actor: Role | "outsider", target: Role | "outsider", role: Role) =>
      s[actor].careGroup.changeRole({ groupId: s.group.id, userId: s.ids[target], role });

    it("lets an owner give any member any role, owner included, as a public profile", async () => {
      for (const target of ["admin", "caretaker", "viewer"] as const) {
        for (const role of ROLES) {
          const s = await settingsSetup();
          const saved = await change(s, "owner", target, role);
          expect(saved).toEqual({ userId: s.ids[target], role, name: target, image: null });
          expect(JSON.stringify(saved)).not.toContain("@example.com");
          expect(await rolesOf(s)).toEqual({ ...SEEDED, [target]: role });
        }
      }
    });

    it("lets an admin change roles below owner, their own included", async () => {
      const s = await settingsSetup();
      expect(await change(s, "admin", "caretaker", "viewer")).toMatchObject({ role: "viewer" });
      expect(await change(s, "admin", "viewer", "admin")).toMatchObject({ role: "admin" });
      expect(await change(s, "admin", "admin", "caretaker")).toMatchObject({ role: "caretaker" });
      expect(await rolesOf(s)).toEqual({
        owner: "owner",
        admin: "caretaker",
        caretaker: "viewer",
        viewer: "admin",
      });
    });

    it("refuses an admin who makes someone an owner, or changes an owner", async () => {
      const s = await settingsSetup();
      const attempts = [
        () => change(s, "admin", "caretaker", "owner"),
        () => change(s, "admin", "admin", "owner"),
        () => change(s, "admin", "owner", "viewer"),
      ];
      for (const attempt of attempts) {
        const error = await rejection(attempt());
        expect(error.code).toBe("FORBIDDEN");
        expect(error.data?.code).toBe("careGroupMemberService:ownerOnly");
        expect(error.message).toBe(OWNER_ONLY);
      }
      expect(await rolesOf(s)).toEqual(SEEDED);
    });

    it.each(["caretaker", "viewer"] as const)(
      "refuses a %s with a 403, whoever the target, and changes nothing",
      async (role) => {
        const s = await settingsSetup();
        for (const target of ROLES) {
          for (const to of ROLES) {
            if (SEEDED[target] === to) continue;
            expect((await rejection(change(s, role, target, to))).code).toBe("FORBIDDEN");
          }
        }
        expect(await rolesOf(s)).toEqual(SEEDED);
      },
    );

    it("keeps the last owner an owner (409), until there's another", async () => {
      const s = await settingsSetup();
      const error = await rejection(change(s, "owner", "owner", "admin"));
      expect(error.code).toBe("CONFLICT");
      expect(error.data?.code).toBe("careGroupMemberService:lastOwner");
      expect(error.message).toBe(LAST_OWNER);
      expect(await rolesOf(s)).toEqual(SEEDED);

      await change(s, "owner", "admin", "owner");
      expect(await change(s, "owner", "owner", "viewer")).toMatchObject({ role: "viewer" });
      expect(await rolesOf(s)).toEqual({ ...SEEDED, owner: "viewer", admin: "owner" });
      // The new owner is now the last one.
      expect((await rejection(change(s, "admin", "admin", "caretaker"))).code).toBe("CONFLICT");
    });

    it("answers a non-member, and a user who isn't in the group, with a 404", async () => {
      const s = await settingsSetup();
      expect((await rejection(change(s, "outsider", "viewer", "caretaker"))).code).toBe("NOT_FOUND");
      expect((await rejection(change(s, "outsider", "outsider", "owner"))).code).toBe("NOT_FOUND");
      expect((await rejection(change(s, "owner", "outsider", "viewer"))).code).toBe("NOT_FOUND");
      expect(await rolesOf(s)).toEqual(SEEDED);
    });

    it("refuses a role that isn't one", async () => {
      const s = await settingsSetup();
      const error = await rejection(
        s.owner.careGroup.changeRole({ groupId: s.group.id, userId: s.ids.viewer, role: "boss" as "owner" }),
      );
      expect(error.code).toBe("BAD_REQUEST");
      expect(await rolesOf(s)).toEqual(SEEDED);
    });
  });

  describe("removeMember", () => {
    const remove = (s: Settings, actor: Role | "outsider", target: Role | "outsider") =>
      s[actor].careGroup.removeMember({ groupId: s.group.id, userId: s.ids[target] });
    const without = (...gone: Role[]) =>
      Object.fromEntries(Object.entries(SEEDED).filter(([label]) => !gone.includes(label as Role)));

    it.each(["admin", "caretaker", "viewer"] as const)(
      "lets an owner remove a %s, who then loses the group",
      async (target) => {
        const s = await settingsSetup();
        const result = await remove(s, "owner", target);
        expect(result).toEqual({ groupId: s.group.id, userId: s.ids[target] });
        expect(await rolesOf(s)).toEqual(without(target));
        expect(await s[target].careGroup.listMine()).toEqual([]);
        expect(await s[target].careGroup.members({ groupId: s.group.id })).toEqual([]);
      },
    );

    it("lets an owner remove another owner, but an admin can't remove an owner", async () => {
      const s = await settingsSetup();
      await s.owner.careGroup.changeRole({ groupId: s.group.id, userId: s.ids.caretaker, role: "owner" });
      const error = await rejection(remove(s, "admin", "caretaker"));
      expect(error.code).toBe("FORBIDDEN");
      expect(error.data?.code).toBe("careGroupMemberService:ownerOnly");
      expect(error.message).toBe(OWNER_ONLY);
      expect((await rejection(remove(s, "admin", "owner"))).message).toBe(OWNER_ONLY);
      expect(await rolesOf(s)).toEqual({ ...SEEDED, caretaker: "owner" });

      await remove(s, "owner", "caretaker");
      expect(await rolesOf(s)).toEqual(without("caretaker"));
    });

    it("lets an admin remove a caretaker and a viewer", async () => {
      const s = await settingsSetup();
      await remove(s, "admin", "caretaker");
      await remove(s, "admin", "viewer");
      expect(await rolesOf(s)).toEqual(without("caretaker", "viewer"));
    });

    it.each(["caretaker", "viewer"] as const)(
      "refuses a %s who removes anyone else with a 403, and removes nothing",
      async (role) => {
        const s = await settingsSetup();
        for (const target of ROLES.filter((r) => r !== role)) {
          expect((await rejection(remove(s, role, target))).code).toBe("FORBIDDEN");
        }
        expect(await rolesOf(s)).toEqual(SEEDED);
      },
    );

    it.each(["admin", "caretaker", "viewer"] as const)(
      "lets a %s leave (remove themselves)",
      async (role) => {
        const s = await settingsSetup();
        expect(await remove(s, role, role)).toEqual({ groupId: s.group.id, userId: s.ids[role] });
        expect(await rolesOf(s)).toEqual(without(role));
        expect(await s[role].careGroup.listMine()).toEqual([]);
      },
    );

    it("keeps the last owner in the group (409), until there's another", async () => {
      const s = await settingsSetup();
      const error = await rejection(remove(s, "owner", "owner"));
      expect(error.code).toBe("CONFLICT");
      expect(error.data?.code).toBe("careGroupMemberService:lastOwner");
      expect(error.message).toBe(LAST_OWNER);
      expect(await rolesOf(s)).toEqual(SEEDED);

      await s.owner.careGroup.changeRole({ groupId: s.group.id, userId: s.ids.admin, role: "owner" });
      await remove(s, "owner", "owner");
      expect(await rolesOf(s, "admin")).toEqual({ ...without("owner"), admin: "owner" });
      expect(await s.owner.careGroup.listMine()).toEqual([]);
    });

    it("answers a non-member, and a user who isn't in the group, with a 404", async () => {
      const s = await settingsSetup();
      expect((await rejection(remove(s, "outsider", "viewer"))).code).toBe("NOT_FOUND");
      expect((await rejection(remove(s, "outsider", "outsider"))).code).toBe("NOT_FOUND");
      expect((await rejection(remove(s, "owner", "outsider"))).code).toBe("NOT_FOUND");
      expect(await rolesOf(s)).toEqual(SEEDED);
    });

    it("never returns an email", async () => {
      const s = await settingsSetup();
      const changed = await s.owner.careGroup.changeRole({
        groupId: s.group.id,
        userId: s.ids.viewer,
        role: "caretaker",
      });
      const gone = await remove(s, "owner", "viewer");
      const refused = await rejection(remove(s, "owner", "owner"));
      expect(Object.keys(changed).sort()).toEqual(["image", "name", "role", "userId"]);
      expect(JSON.stringify([changed, gone, refused.message, refused.data])).not.toMatch(/@|email/i);
    });
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

    const updated = await owner.api.timeline.update({ id: created.id, data: { title: "Ate all of lunch" } });
    expect(updated.title).toBe("Ate all of lunch");

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
    expect((await rejection(owner.api.timeline.create({ ...note(group.id), body: "" } as never))).code).toBe(
      "BAD_REQUEST",
    );
    // Caught by the service, against the merged entry.
    const entry = await owner.api.timeline.create(note(group.id));
    const error = await rejection(owner.api.timeline.update({ id: entry.id, data: { body: "Ate lunch" } }));
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

describe("timeline: a note's or event's text is its document", () => {
  /** A live document on `entryId` with one paragraph per line, compacted unless `pending`. */
  const writeDocument = async (
    ctx: { authUser: AuthUser },
    groupId: string,
    entryId: string,
    lines: string[],
    { pending = false } = {},
  ) => {
    ok(await noteDocumentService.create(ctx, { id: entryId, groupId }));
    const ydoc = newYDoc();
    for (const line of lines) {
      const data = typeParagraph(ydoc, line);
      ok(
        await noteDocumentService.appendUpdate(ctx, { id: randomUUID(), groupId, documentId: entryId, data }),
      );
    }
    if (!pending) ok(await noteDocumentService.compact(entryId));
  };

  const at = (hour: number) => `2026-11-17T${String(hour).padStart(2, "0")}:00:00Z`;

  it("returns the document text as body for notes and events, and the stored body otherwise", async () => {
    const { owner, viewer, group } = await setup();
    const api = owner.api.timeline;
    const noteEntry = await api.create({ ...note(group.id), occurredAt: at(8) });
    const eventEntry = await api.create({
      ...note(group.id),
      kind: "event",
      title: "Dr. Lee visit",
      occurredAt: at(9),
    });
    const symptom = await api.create({
      ...note(group.id),
      kind: "symptom",
      title: null,
      body: "After lunch",
      details: { name: "Dizziness", severity: 3 },
      occurredAt: at(10),
    });
    const vital = await api.create({
      ...note(group.id),
      kind: "vital",
      title: null,
      body: "Resting",
      details: { readings: [{ type: "heartRate", value: 71 }] },
      occurredAt: at(11),
    });
    await writeDocument(owner.ctx, group.id, noteEntry.id, ["Ate lunch", "Napped after"]);
    await writeDocument(owner.ctx, group.id, eventEntry.id, ["BP looked fine"]);

    const { data } = await viewer.api.timeline.list({ groupId: group.id });
    const bodies = Object.fromEntries(data.map((e) => [e.id, e.body]));
    expect(bodies).toEqual({
      [noteEntry.id]: "Ate lunch\nNapped after",
      [eventEntry.id]: "BP looked fine",
      [symptom.id]: "After lunch",
      [vital.id]: "Resting",
    });

    // Filtered lists and edits return the same text.
    const notes = await viewer.api.timeline.list({ groupId: group.id, kinds: ["note"] });
    expect(notes.data.map((e) => e.body)).toEqual(["Ate lunch\nNapped after"]);
    const renamed = await api.update({ id: eventEntry.id, data: { title: "Dr. Lee follow-up" } });
    expect(renamed).toMatchObject({ title: "Dr. Lee follow-up", body: "BP looked fine" });
  });

  it("returns a null body, without an error, for a note whose document hasn't arrived or compacted", async () => {
    const { owner, viewer, group } = await setup();
    const waiting = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(8) });
    const pending = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(9) });
    // Only compacted text is read: pending updates (still being typed) aren't.
    await writeDocument(owner.ctx, group.id, pending.id, ["Still typing"], { pending: true });

    const { data } = await viewer.api.timeline.list({ groupId: group.id });
    expect(data.map((e) => [e.id, e.body])).toEqual([
      [pending.id, null],
      [waiting.id, null],
    ]);
    expect(await noteDocumentService.currentText(owner.ctx, pending.id)).toBe("Still typing");
  });

  it("never returns a soft-deleted entry's document text", async () => {
    const { owner, viewer, group } = await setup();
    const kept = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(8) });
    const gone = await owner.api.timeline.create({ ...note(group.id), occurredAt: at(9) });
    await writeDocument(owner.ctx, group.id, kept.id, ["Kept"]);
    await writeDocument(owner.ctx, group.id, gone.id, ["Private thought"]);
    await owner.api.timeline.remove({ id: gone.id });

    expect((await viewer.api.timeline.list({ groupId: group.id })).data.map((e) => e.id)).toEqual([kept.id]);
    const all = await viewer.api.timeline.list({ groupId: group.id, includeDeleted: true });
    expect(all.data.map((e) => [e.id, e.body])).toEqual([
      [gone.id, null],
      [kept.id, "Kept"],
    ]);
    expect(all.data[0]?.deletedAt).toMatch(/Z$/);

    // The service's other reads hide it too.
    const entry = await timelineEntryService.getById(viewer.ctx, gone.id, { includeDeleted: true });
    expect(entry).toMatchObject({ id: gone.id, body: null });
    expect(await timelineEntryService.getById(viewer.ctx, gone.id)).toBeNull();
    for (const read of [noteDocumentService.getById, noteDocumentService.currentText]) {
      expect(await read(viewer.ctx, gone.id)).toMatchObject({ code: "noteDocumentService:notFound" });
    }
    expect((await rejection(owner.api.timeline.update({ id: gone.id, data: { title: "x" } }))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("reads documents in the actor's scope", async () => {
    const { owner, outsider, group } = await setup();
    const entry = await owner.api.timeline.create(note(group.id));
    await writeDocument(owner.ctx, group.id, entry.id, ["Members only"]);
    expect((await outsider.api.timeline.list({ groupId: group.id })).data).toEqual([]);
    expect(await timelineEntryService.getById(outsider.ctx, entry.id)).toBeNull();
    expect(await timelineEntryService.getById(owner.ctx, entry.id)).toMatchObject({ body: "Members only" });
  });
});

describe("sync.upload", () => {
  /** A row as a device's SQLite holds it: snake_case, microsecond timestamps, JSON as text. */
  const row = (groupId: string, recipientId: string) => ({
    group_id: groupId,
    recipient_id: recipientId,
    kind: "symptom",
    occurred_at: "2026-11-17T20:00:00.000000Z",
    time_zone: "America/Los_Angeles",
    title: null,
    body: "After lunch",
    details: JSON.stringify({ name: "Dizziness", severity: 3 }),
    created_by: "ignored",
  });

  it("applies a device's inserts, edits and deletes in order", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const id = randomUUID();

    const res = await owner.api.sync.upload({
      ops: [
        { op: "PUT", table: "timeline_entry", id, data: row(group.id, recipient.id) },
        { op: "PATCH", table: "timeline_entry", id, data: { body: "After a big lunch" } },
      ],
    });
    expect(res.results).toEqual([
      { id, status: "applied" },
      { id, status: "applied" },
    ]);
    const [entry] = (await viewer.api.timeline.list({ groupId: group.id })).data;
    expect(entry).toMatchObject({
      id,
      kind: "symptom",
      body: "After a big lunch",
      occurredAt: "2026-11-17T20:00:00.000Z",
      details: { name: "Dizziness", severity: 3 },
      createdBy: owner.user.id,
    });

    // A soft delete arrives as a PATCH of deleted_at.
    const patch = {
      op: "PATCH" as const,
      table: "timeline_entry",
      id,
      data: { deleted_at: "2026-11-17 21:00:00Z" },
    };
    expect((await owner.api.sync.upload({ ops: [patch] })).results).toEqual([{ id, status: "applied" }]);
    expect((await viewer.api.timeline.list({ groupId: group.id })).data).toEqual([]);
  });

  it("is safe to replay", async () => {
    const { owner, group, recipient } = await setup();
    const id = randomUUID();
    const ops = [
      { op: "PUT" as const, table: "timeline_entry", id, data: row(group.id, recipient.id) },
      { op: "DELETE" as const, table: "timeline_entry", id },
    ];
    await owner.api.sync.upload({ ops });
    const replay = await owner.api.sync.upload({ ops });
    expect(replay.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    const all = await owner.api.timeline.list({ groupId: group.id, includeDeleted: true });
    expect(all.data).toHaveLength(1);
  });

  it("acknowledges refused changes instead of failing the batch", async () => {
    const { owner, viewer, group, recipient } = await setup();
    const good = randomUUID();
    const res = await viewer.api.sync.upload({
      ops: [{ op: "PUT", table: "timeline_entry", id: randomUUID(), data: row(group.id, recipient.id) }],
    });
    expect(res.results[0]).toMatchObject({ status: "rejected", code: "permissions:unauthorized" });

    const mixed = await owner.api.sync.upload({
      ops: [
        {
          op: "PUT",
          table: "timeline_entry",
          id: randomUUID(),
          data: { ...row(group.id, recipient.id), details: "{" },
        },
        { op: "PUT", table: "care_group", id: group.id, data: { name: "Renamed" } },
        { op: "PUT", table: "timeline_entry", id: good, data: row(group.id, recipient.id) },
        { op: "PATCH", table: "timeline_entry", id: good, data: { kind: "note" } },
      ],
    });
    expect(mixed.results).toEqual([
      expect.objectContaining({ status: "rejected", code: "timelineEntryService:invalid" }),
      expect.objectContaining({ status: "rejected", code: "sync:readOnlyTable" }),
      { id: good, status: "applied" },
      expect.objectContaining({ status: "rejected", code: "timelineEntryService:immutable" }),
    ]);
    expect((await owner.api.careGroup.listMine())[0]?.name).toBe("Test Family");
  });

  it("needs a session", async () => {
    expect((await rejection(clientFor(null).sync.upload({ ops: [] }))).code).toBe("UNAUTHORIZED");
  });

  describe("live documents", () => {
    /** An event made offline, its live document, and `n` edits: one batch, in order. */
    const offlineDocument = (groupId: string, recipientId: string, n: number) => {
      const entryId = randomUUID();
      const ydoc = newYDoc();
      const ops = [
        {
          op: "PUT" as const,
          table: "timeline_entry",
          id: entryId,
          data: {
            ...row(groupId, recipientId),
            kind: "event",
            title: "Dr. Lee visit",
            body: null,
            details: null,
          },
        },
        { op: "PUT" as const, table: "note_document", id: entryId, data: { group_id: groupId } },
        ...Array.from({ length: n }, (_, i) => ({
          op: "PUT" as const,
          table: "note_update",
          id: randomUUID(),
          data: { group_id: groupId, document_id: entryId, data: typeParagraph(ydoc, `Line ${i + 1}`) },
        })),
      ];
      return { entryId, ops };
    };

    it("creates the document and its edits from one offline batch, and replays safely", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, ops } = offlineDocument(group.id, recipient.id, 2);
      const res = await owner.api.sync.upload({ ops });
      expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied", "applied"]);
      expect((await owner.api.sync.upload({ ops })).results.every((r) => r.status === "applied")).toBe(true);

      const text = await noteDocumentService.currentText(owner.ctx, entryId);
      expect(text).toBe("Line 1\nLine 2");
    });

    /** A note as a device saves it: no body (its text is the document), then its document and an edit. */
    const offlineNote = (groupId: string, recipientId: string) => {
      const entryId = randomUUID();
      const entry = {
        op: "PUT" as const,
        table: "timeline_entry",
        id: entryId,
        data: { ...row(groupId, recipientId), kind: "note", body: null, details: null },
      };
      const document = {
        op: "PUT" as const,
        table: "note_document",
        id: entryId,
        data: { group_id: groupId },
      };
      const edit = {
        op: "PUT" as const,
        table: "note_update",
        id: randomUUID(),
        data: { group_id: groupId, document_id: entryId, data: typeParagraph(newYDoc(), "Ate lunch") },
      };
      return { entryId, entry, document, edit };
    };

    it("accepts a note with no body and its document, in one batch", async () => {
      const { owner, viewer, group, recipient } = await setup();
      const { entryId, entry, document, edit } = offlineNote(group.id, recipient.id);
      const res = await owner.api.sync.upload({ ops: [entry, document, edit] });
      expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);

      const [stored] = (await viewer.api.timeline.list({ groupId: group.id })).data;
      expect(stored).toMatchObject({ id: entryId, kind: "note", body: null, createdBy: owner.user.id });
      expect(await noteDocumentService.currentText(owner.ctx, entryId)).toBe("Ate lunch");
    });

    it("accepts a note and its document split across two batches", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, entry, document, edit } = offlineNote(group.id, recipient.id);
      expect((await owner.api.sync.upload({ ops: [entry] })).results).toEqual([
        { id: entryId, status: "applied" },
      ]);
      const second = await owner.api.sync.upload({ ops: [document, edit] });
      expect(second.results.map((r) => r.status)).toEqual(["applied", "applied"]);
      expect(await noteDocumentService.currentText(owner.ctx, entryId)).toBe("Ate lunch");
    });

    it("rejects a note with a body", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, entry } = offlineNote(group.id, recipient.id);
      const res = await owner.api.sync.upload({
        ops: [{ ...entry, data: { ...entry.data, body: "Ate lunch" } }],
      });
      expect(res.results[0]).toMatchObject({
        id: entryId,
        status: "rejected",
        code: "timelineEntryService:invalid",
        issues: [expect.objectContaining({ path: "body" })],
      });
      // And once stored, a PATCH can't add one either.
      await owner.api.sync.upload({ ops: [entry] });
      const patch = { op: "PATCH" as const, table: "timeline_entry", id: entryId, data: { body: "x" } };
      expect((await owner.api.sync.upload({ ops: [patch] })).results[0]).toMatchObject({
        status: "rejected",
        code: "timelineEntryService:invalid",
      });
    });

    it('accepts an event saved as "Event" with no body, and its rename', async () => {
      const { owner, viewer, group, recipient } = await setup();
      const { entryId, entry, document } = offlineNote(group.id, recipient.id);
      const event = { ...entry, data: { ...entry.data, kind: "event", title: "Event" } };
      const rename = {
        op: "PATCH" as const,
        table: "timeline_entry",
        id: entryId,
        data: { title: "Dr. Lee" },
      };
      const res = await owner.api.sync.upload({ ops: [event, document, rename] });
      expect(res.results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
      const [stored] = (await viewer.api.timeline.list({ groupId: group.id })).data;
      expect(stored).toMatchObject({ id: entryId, kind: "event", title: "Dr. Lee", body: null });
    });

    it("rejects an event with a body or no title", async () => {
      const { owner, group, recipient } = await setup();
      const { entryId, entry } = offlineNote(group.id, recipient.id);
      const event = { ...entry, data: { ...entry.data, kind: "event", title: "Dr. Lee" } };
      const cases = [
        { data: { ...event.data, body: "Talked about the knee" }, path: "body" },
        { data: { ...event.data, title: null }, path: "title" },
        { data: { ...event.data, title: " " }, path: "title" },
      ];
      for (const { data, path } of cases) {
        const res = await owner.api.sync.upload({ ops: [{ ...event, data }] });
        expect(res.results[0]).toMatchObject({
          id: entryId,
          status: "rejected",
          code: "timelineEntryService:invalid",
          issues: [expect.objectContaining({ path })],
        });
      }
      // Once stored, a PATCH can't add a body or clear the title either.
      await owner.api.sync.upload({ ops: [event] });
      for (const data of [{ body: "x" }, { title: null }]) {
        const patch = { op: "PATCH" as const, table: "timeline_entry", id: entryId, data };
        expect((await owner.api.sync.upload({ ops: [patch] })).results[0]).toMatchObject({
          status: "rejected",
          code: "timelineEntryService:invalid",
        });
      }
    });

    it("compacts once enough edits arrive", async () => {
      const { owner, group, recipient } = await setup();
      const n = noteDocumentService.COMPACT_AFTER_UPDATES;
      const { entryId, ops } = offlineDocument(group.id, recipient.id, n);
      await owner.api.sync.upload({ ops });

      const doc = await noteDocumentService.getById(owner.ctx, entryId);
      if (isError(doc)) throw doc;
      // Compacted during the upload: the text is the server's, and nothing is pending.
      expect(doc.text.split("\n")).toEqual(Array.from({ length: n }, (_, i) => `Line ${i + 1}`));
      expect(doc.snapshot).not.toBeNull();
    });

    it("refuses viewers' edits, and any change but adding", async () => {
      const { owner, viewer, group, recipient } = await setup();
      const { entryId, ops } = offlineDocument(group.id, recipient.id, 1);
      await owner.api.sync.upload({ ops });

      const edit = {
        op: "PUT" as const,
        table: "note_update",
        id: randomUUID(),
        data: { group_id: group.id, document_id: entryId, data: typeParagraph(newYDoc(), "Hi") },
      };
      expect((await viewer.api.sync.upload({ ops: [edit] })).results[0]).toMatchObject({
        status: "rejected",
        code: "permissions:unauthorized",
      });

      const res = await owner.api.sync.upload({
        ops: [
          { op: "PATCH", table: "note_document", id: entryId, data: { text: "forged" } },
          { op: "DELETE", table: "note_document", id: entryId },
          { op: "PATCH", table: "note_update", id: ops[2]!.id, data: { data: "x" } },
          { op: "DELETE", table: "note_update", id: ops[2]!.id },
        ],
      });
      expect(res.results.map((r) => r.status === "rejected" && r.code)).toEqual(
        Array(4).fill("sync:readOnlyTable"),
      );
    });

    it("never takes editors from a device: compaction writes them from the updates' authors", async () => {
      const { owner, viewer, group, recipient } = await setup();
      const n = noteDocumentService.COMPACT_AFTER_UPDATES;
      const { entryId, ops } = offlineDocument(group.id, recipient.id, n);
      const forged = { [viewer.user.id]: new Date().toISOString() };
      const withForgery = ops.map((op) =>
        op.table === "note_document" ? { ...op, data: { ...op.data, editors: forged } } : op,
      );
      const res = await owner.api.sync.upload({ ops: withForgery });
      expect(res.results.every((r) => r.status === "applied")).toBe(true);

      // Compacted during the upload: only the real author is there.
      const doc = await noteDocumentService.getById(owner.ctx, entryId);
      if (isError(doc)) throw doc;
      expect(Object.keys(doc.editors)).toEqual([owner.user.id]);
      expect(Date.now() - Date.parse(doc.editors[owner.user.id]!)).toBeLessThan(60_000);

      // And a PATCH can't change them.
      const patch = { op: "PATCH" as const, table: "note_document", id: entryId, data: { editors: forged } };
      expect((await owner.api.sync.upload({ ops: [patch] })).results[0]).toMatchObject({
        status: "rejected",
        code: "sync:readOnlyTable",
      });
    });
  });
});

describe("HTTP handler", () => {
  const rpc = createRpcHandler({ prefix: "/rpc", allowedOrigins: ["capacitor://localhost"] });
  const handle = (request: Request, authUser: AuthUser | null) =>
    rpc(request, () => Promise.resolve(authUser));

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
