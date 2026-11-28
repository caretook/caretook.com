import type { WorldUser } from "../../test/fixtures";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createGroup, createUser, ok, system } from "../../test/fixtures";
import { getDb, withTransaction } from "../db";
import { appSettingSchema, careGroupSchema, userSchema } from "../db/schema";
import { isError } from "../errors";
import { appSettingModel } from "../models";
import {
  accessCodeService,
  appSettingService,
  careGroupMemberService,
  careGroupService,
  staffGroupService,
  userService,
} from ".";

// The free plan's cap on starting care groups (free-limits slice 1): only
// groups a member started and still owns count; the setting moves the cap;
// two creates at once can't both take the last slot.

const AT_LIMIT_MESSAGE =
  "You've started as many care groups as the free plan allows. Contact us if you need more.";

const codeOf = (res: unknown) => (isError(res) ? res.code : "ok");

/** Start a group as `who`, through the service a member's create uses. */
const start = (who: WorldUser, name = "Limit Family") =>
  careGroupService.create(who.ctx, {
    name,
    recipient: { name: "Pat Example", timeZone: "America/Los_Angeles" },
  });

const startedBy = async (who: WorldUser) =>
  (await getDb().select().from(careGroupSchema).where(eq(careGroupSchema.createdBy, who.user.id))).length;

/** Set the cap behind the service's back, as staff would, and forget this process's copy. */
const setLimit = async (limit: number) => {
  ok(await withTransaction((tx) => appSettingModel.put(tx, "limits.groupsStarted", limit, null)));
  appSettingService.clearSettingsCache();
};

afterEach(async () => {
  await getDb().delete(appSettingSchema).where(eq(appSettingSchema.key, "limits.groupsStarted"));
  appSettingService.clearSettingsCache();
});

const membershipId = async (groupId: string, userId: string) => {
  const m = ok(
    await careGroupMemberService.get(system, {
      filter: { groupId: { type: "eq", value: groupId }, userId: { type: "eq", value: userId } },
    }),
  );
  if (!m) throw new Error("no membership");
  return m.id;
};

describe("starting care groups on the free plan", () => {
  it("refuses a member's 4th group with the limit's message, and creates nothing", async () => {
    appSettingService.clearSettingsCache();
    const member = await createUser("limit-four");
    for (let i = 0; i < 3; i++) ok(await start(member));

    const refused = await start(member, "One Too Many");
    expect(codeOf(refused)).toBe("groupLimitService:atLimit");
    expect(isError(refused) && refused.message).toBe(AT_LIMIT_MESSAGE);
    expect(isError(refused) && refused.statusCode).toBe(409);
    expect(await startedBy(member)).toBe(3);
  });

  it("doesn't count groups they were invited to, made owner of, or that staff or an access code started", async () => {
    appSettingService.clearSettingsCache();
    const member = await createUser("limit-joiner");
    const other = await createUser("limit-other");

    // Invited to two groups, one as an owner.
    for (const role of ["caretaker", "owner"] as const) {
      const { group } = await createGroup(other);
      ok(
        await careGroupMemberService.create(system, {
          groupId: group.id,
          userId: member.user.id,
          role,
          invitedBy: other.user.id,
        }),
      );
    }
    // Made an owner by another owner.
    const { group: promoted } = await createGroup(other, [{ user: member.user, role: "viewer" }]);
    ok(
      await careGroupMemberService.updateRole(other.ctx, {
        id: await membershipId(promoted.id, member.user.id),
        role: "owner",
      }),
    );
    // A group staff started for them, its owner invite taken up.
    const staff = await createUser("limit-staff", "admin");
    const made = ok(
      await staffGroupService.createWithOwnerInvite(
        staff.ctx,
        {
          groupName: "Staff-made family",
          recipientName: "Lou Example",
          ownerEmail: member.user.email,
          attested: true,
        },
        { mail: () => Promise.resolve({ id: randomUUID() }) },
      ),
    );
    ok(
      await careGroupMemberService.create(system, {
        groupId: made.groupId,
        userId: member.user.id,
        role: "owner",
      }),
    );
    // A group from an access code.
    const code = ok(await accessCodeService.create(staff.ctx, { label: "Limit test", expiresInDays: 7 }));
    ok(
      await withTransaction((tx) =>
        accessCodeService.redeem(tx, {
          code: code.code,
          userId: member.user.id,
          group: { recipientName: "Ada Example", timeZone: "America/Denver" },
        }),
      ),
    );

    // Five groups, three of them owned, none started: all three of their own still fit.
    for (let i = 0; i < 3; i++) ok(await start(member));
    expect(codeOf(await start(member))).toBe("groupLimitService:atLimit");
  });

  it("stops counting a group they started once they hand it on and leave", async () => {
    appSettingService.clearSettingsCache();
    const member = await createUser("limit-leaver");
    const heir = await createUser("limit-heir");
    const groups = [];
    for (let i = 0; i < 3; i++) groups.push(ok(await start(member)).group);
    expect(codeOf(await start(member))).toBe("groupLimitService:atLimit");

    const handedOn = groups[0]!;
    ok(
      await careGroupMemberService.create(member.ctx, {
        groupId: handedOn.id,
        userId: heir.user.id,
        role: "owner",
      }),
    );
    ok(await careGroupMemberService.leave(member.ctx, handedOn.id));

    expect(codeOf(await start(member))).toBe("ok");
    expect(codeOf(await start(member))).toBe("groupLimitService:atLimit");
  });

  it("stops counting a group they started once they're no longer an owner of it", async () => {
    appSettingService.clearSettingsCache();
    const member = await createUser("limit-demoted");
    const heir = await createUser("limit-new-owner");
    const groups = [];
    for (let i = 0; i < 3; i++) groups.push(ok(await start(member)).group);

    const handedOn = groups[0]!;
    ok(
      await careGroupMemberService.create(member.ctx, {
        groupId: handedOn.id,
        userId: heir.user.id,
        role: "owner",
      }),
    );
    ok(
      await careGroupMemberService.updateRole(heir.ctx, {
        id: await membershipId(handedOn.id, member.user.id),
        role: "caretaker",
      }),
    );

    expect(codeOf(await start(member))).toBe("ok");
  });

  it("follows the setting: at 1, the 2nd group is refused", async () => {
    await setLimit(1);
    const member = await createUser("limit-one");
    ok(await start(member));
    expect(codeOf(await start(member))).toBe("groupLimitService:atLimit");
    expect(await startedBy(member)).toBe(1);
  });

  it("never applies to the system", async () => {
    await setLimit(1);
    const member = await createUser("limit-system");
    ok(await start(member));
    // The system starting a group in their name (an access code's path) isn't refused.
    const staff = await createUser("limit-system-staff", "admin");
    const code = ok(await accessCodeService.create(staff.ctx, { label: "System test", expiresInDays: 7 }));
    expect(
      codeOf(
        await withTransaction((tx) =>
          accessCodeService.redeem(tx, {
            code: code.code,
            userId: member.user.id,
            group: { recipientName: "Ray Example", timeZone: "America/Denver" },
          }),
        ),
      ),
    ).toBe("ok");
  });

  it("lets exactly one of two creates at once take the last slot", async () => {
    await setLimit(2);
    const member = await createUser("limit-race");
    ok(await start(member));

    const results = await Promise.all([start(member, "Race A"), start(member, "Race B")]);
    expect(results.map(codeOf).sort()).toEqual(["groupLimitService:atLimit", "ok"]);
    expect(await startedBy(member)).toBe(2);
  });
});

// One account's own limit (free-limits slice 2): `user.group_limit`, set only
// as the system, wins over the setting; null follows it.
describe("one account's own limit", () => {
  const ownLimit = async (who: WorldUser) =>
    (
      await getDb()
        .select({ n: userSchema.groupLimit })
        .from(userSchema)
        .where(eq(userSchema.id, who.user.id))
    )[0]?.n;

  /** Set `who`'s own limit as the system, the way staff's change writes it. */
  const setOwnLimit = async (who: WorldUser, groupLimit: number | null) =>
    ok(
      await userService.update(system, {
        filter: { id: { type: "eq", value: who.user.id } },
        data: { groupLimit },
      }),
    );

  it("lets a member with their own limit of 5 start a 4th and 5th group, and refuses the 6th", async () => {
    appSettingService.clearSettingsCache();
    const member = await createUser("own-limit-five");
    await setOwnLimit(member, 5);
    for (let i = 0; i < 3; i++) ok(await start(member));

    expect(codeOf(await start(member, "Fourth"))).toBe("ok");
    expect(codeOf(await start(member, "Fifth"))).toBe("ok");
    expect(codeOf(await start(member, "Sixth"))).toBe("groupLimitService:atLimit");
    expect(await startedBy(member)).toBe(5);
  });

  it("holds an own limit of 1 under a setting of 3, and falls back to the setting when cleared", async () => {
    await setLimit(3);
    const member = await createUser("own-limit-one");
    await setOwnLimit(member, 1);
    ok(await start(member));
    expect(codeOf(await start(member))).toBe("groupLimitService:atLimit");

    await setOwnLimit(member, null);
    expect(codeOf(await start(member))).toBe("ok");
    expect(codeOf(await start(member))).toBe("ok");
    expect(codeOf(await start(member))).toBe("groupLimitService:atLimit");
    expect(await startedBy(member)).toBe(3);
  });

  it("refuses a member setting their own limit, and leaves it unchanged", async () => {
    const member = await createUser("own-limit-self");
    await setOwnLimit(member, 2);

    const res = await userService.update(member.ctx, {
      filter: { id: { type: "eq", value: member.user.id } },
      data: { groupLimit: 1000 },
    });
    expect(codeOf(res)).toBe("permissions:fieldUnauthorized");
    expect(await ownLimit(member)).toBe(2);
  });

  it("is refused by the database outside 1 to 1000", async () => {
    const member = await createUser("own-limit-range");
    for (const groupLimit of [0, 1001]) {
      await expect(
        getDb().update(userSchema).set({ groupLimit }).where(eq(userSchema.id, member.user.id)),
      ).rejects.toThrow();
    }
    expect(await ownLimit(member)).toBeNull();
  });
});
