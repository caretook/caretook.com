import {
  DETAILS_CONSENT_VERSION,
  memberCalendarSettingModel,
  reminderOverrideModel,
  SYSTEM_USER,
  timelineEntryService,
} from "@caretook/data";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { clientFor, rejection } from "../testing";

// The calendars area over the API (appointments-2 slice 4): each member's
// own calendar settings (`calendars.settings.*`), the consent that details
// record, the owners' switch (`calendars.group.setDetailsAllowed`), and a
// member's rows going when they leave or are removed. Names are made up.

const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;
type Who = (typeof ROLES)[number] | "owner2" | "outsider";

const setup = async () => {
  const people = {
    owner: await createUser("owner"),
    owner2: await createUser("owner2"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const roles = { owner2: "owner", admin: "admin", caretaker: "caretaker", viewer: "viewer" } as const;
  const { group, recipient } = await createGroup(
    people.owner,
    Object.entries(roles).map(([who, role]) => ({ user: people[who as keyof typeof roles].user, role })),
  );
  const ctx = (who: Who) => people[who].ctx;
  const api = (who: Who) => clientFor(people[who].ctx.authUser);
  const id = (who: Who) => people[who].user.id;
  return { group, recipient, api, ctx, id };
};

/** Every calendar row a user has in a group, read as the system. */
const rowsOf = async (groupId: string, userId: string) => {
  const filter = {
    groupId: { type: "eq" as const, value: groupId },
    userId: { type: "eq" as const, value: userId },
  };
  const settings = ok(await memberCalendarSettingModel.list({ authUser: SYSTEM_USER, filter })).data;
  const overrides = ok(await reminderOverrideModel.list({ authUser: SYSTEM_USER, filter })).data;
  return { settings: settings.length, overrides: overrides.length };
};

describe("calendars.settings", () => {
  it("starts every member, viewers included, at the defaults", async () => {
    const { group, api } = await setup();
    for (const who of ROLES) {
      expect(await api(who).calendars.settings.get({ groupId: group.id })).toEqual({
        groupId: group.id,
        role: who,
        remindersOn: false,
        reminderLeads: ["eveningBefore", 60],
        detailsConsent: false,
        detailsConsentAt: null,
        detailsConsentVersion: null,
        detailsConsentStale: false,
        groupAllowsDetails: true,
        shareLevel: "generic",
        feed: { active: false, rotatedAt: null },
      });
    }
  });

  it.each(ROLES)("lets a %s change only their own", async (who) => {
    const { group, api, id } = await setup();
    const saved = await api(who).calendars.settings.update({
      groupId: group.id,
      remindersOn: true,
      reminderLeads: [30, "morningOf"],
    });
    expect(saved).toMatchObject({ remindersOn: true, reminderLeads: ["morningOf", 30] });
    expect(await rowsOf(group.id, id(who))).toEqual({ settings: 1, overrides: 0 });
    // Everyone else still has the defaults.
    for (const other of ROLES.filter((r) => r !== who))
      expect(await api(other).calendars.settings.get({ groupId: group.id })).toMatchObject({
        remindersOn: false,
        reminderLeads: ["eveningBefore", 60],
      });
  });

  it("never lets one member read or change another's row, owners included", async () => {
    const { group, api, ctx, id } = await setup();
    await api("viewer").calendars.settings.update({ groupId: group.id, remindersOn: true });
    const filter = { userId: { type: "eq" as const, value: id("viewer") } };
    for (const who of ["owner", "admin", "caretaker"] as const) {
      expect(ok(await memberCalendarSettingModel.list({ ...ctx(who), filter })).data).toEqual([]);
      const changed = await memberCalendarSettingModel.update({
        ...ctx(who),
        filter,
        data: { remindersOn: false },
      });
      expect(changed).toMatchObject({ code: "baseModel:update:nothingUpdated" });
    }
    expect(await api("viewer").calendars.settings.get({ groupId: group.id })).toMatchObject({
      remindersOn: true,
    });
  });

  it("answers a non-member with a 404, and refuses bad leads", async () => {
    const { group, api } = await setup();
    expect((await rejection(api("outsider").calendars.settings.get({ groupId: group.id }))).code).toBe(
      "NOT_FOUND",
    );
    const update = api("outsider").calendars.settings.update({ groupId: group.id, remindersOn: true });
    expect((await rejection(update)).data?.code).toBe("calendarSettingService:notMember");
    const tooMany = api("caretaker").calendars.settings.update({
      groupId: group.id,
      reminderLeads: ["eveningBefore", "morningOf", 120, 60],
    });
    expect((await rejection(tooMany)).code).toBe("BAD_REQUEST");
  });

  it("records consent with its version when details go on, keeps it on a repeat, and clears it off", async () => {
    const { group, api } = await setup();
    const before = Date.now();
    const on = await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    expect(on).toMatchObject({
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
      shareLevel: "details",
    });
    expect(new Date(on.detailsConsentAt!).getTime()).toBeGreaterThanOrEqual(before - 1000);

    const again = await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    expect(again.detailsConsentAt).toBe(on.detailsConsentAt);

    const off = await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: false,
    });
    expect(off).toMatchObject({
      detailsConsent: false,
      detailsConsentAt: null,
      detailsConsentVersion: null,
      shareLevel: "generic",
    });
  });

  it("asks again when the wording changed, and records the current version on agreeing", async () => {
    const { group, api, id } = await setup();
    await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    await api("viewer").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    const agreedAt = "2026-03-02T18:00:00.000Z";
    ok(
      await memberCalendarSettingModel.update({
        authUser: SYSTEM_USER,
        filter: { groupId: { type: "eq", value: group.id }, userId: { type: "eq", value: id("caretaker") } },
        data: { detailsConsentAt: agreedAt, detailsConsentVersion: "2020-01-01" },
      }),
    );

    const stale = await api("caretaker").calendars.settings.get({ groupId: group.id });
    expect(stale).toMatchObject({
      detailsConsent: false,
      detailsConsentStale: true,
      detailsConsentVersion: "2020-01-01",
      shareLevel: "generic",
    });
    expect(new Date(stale.detailsConsentAt!).toISOString()).toBe(agreedAt);

    // Another change is not an agreement.
    expect(
      await api("caretaker").calendars.settings.update({ groupId: group.id, remindersOn: true }),
    ).toMatchObject({ detailsConsent: false, detailsConsentStale: true });

    const again = await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    expect(again).toMatchObject({
      detailsConsent: true,
      detailsConsentStale: false,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
      shareLevel: "details",
    });
    expect(new Date(again.detailsConsentAt!).getTime()).toBeGreaterThan(new Date(agreedAt).getTime());

    // A member on the current wording is unchanged.
    expect(await api("viewer").calendars.settings.get({ groupId: group.id })).toMatchObject({
      detailsConsent: true,
      detailsConsentStale: false,
      shareLevel: "details",
    });
  });

  it.each([
    ["outdated", { detailsConsentVersion: "2020-01-01" }],
    ["missing", {}],
  ])("records nothing for an %s version, and says why (B-659)", async (_name, version) => {
    const { group, api, id } = await setup();
    const refused = api("caretaker").calendars.settings.update({
      groupId: group.id,
      remindersOn: true,
      detailsConsent: true,
      ...version,
    });
    const error = await rejection(refused);
    expect(error.code).toBe("CONFLICT");
    expect(error.data?.code).toBe("calendarSettingService:consentOutdated");
    expect(await rowsOf(group.id, id("caretaker"))).toEqual({ settings: 0, overrides: 0 });
    expect(await api("caretaker").calendars.settings.get({ groupId: group.id })).toMatchObject({
      detailsConsent: false,
      detailsConsentAt: null,
      detailsConsentVersion: null,
      remindersOn: false,
    });
  });

  it("keeps a current consent as it was when a repeat names an outdated version (B-659)", async () => {
    const { group, api } = await setup();
    const on = await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    const refused = api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: "2020-01-01",
    });
    expect((await rejection(refused)).data?.code).toBe("calendarSettingService:consentOutdated");
    expect(await api("caretaker").calendars.settings.get({ groupId: group.id })).toMatchObject({
      detailsConsent: true,
      detailsConsentAt: on.detailsConsentAt,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
  });

  it("turns details off without a version (B-659)", async () => {
    const { group, api } = await setup();
    await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    expect(
      await api("caretaker").calendars.settings.update({ groupId: group.id, detailsConsent: false }),
    ).toMatchObject({ detailsConsent: false, detailsConsentAt: null, detailsConsentVersion: null });
  });

  it("never returns the feed's hash", async () => {
    const { group, api, id } = await setup();
    await api("viewer").calendars.settings.update({ groupId: group.id, remindersOn: true });
    const filter = { userId: { type: "eq" as const, value: id("viewer") } };
    ok(
      await memberCalendarSettingModel.update({
        authUser: SYSTEM_USER,
        filter,
        data: { feedTokenHash: "a".repeat(64), feedRotatedAt: new Date().toISOString() },
      }),
    );
    const view = await api("viewer").calendars.settings.get({ groupId: group.id });
    expect(view.feed.active).toBe(true);
    expect(JSON.stringify(view)).not.toContain("a".repeat(64));
  });

  it("refuses a member setting the feed's fields through the model", async () => {
    const { group, ctx, id } = await setup();
    const created = await memberCalendarSettingModel.create({
      ...ctx("caretaker"),
      data: { userId: id("caretaker"), groupId: group.id, feedTokenHash: "b".repeat(64) },
    });
    expect(created).toMatchObject({ code: "permissions:fieldUnauthorized" });
  });
});

describe("calendars.group.setDetailsAllowed", () => {
  it.each(["owner", "owner2"] as const)("lets an %s forbid and allow details for everyone", async (who) => {
    const { group, api } = await setup();
    await api("caretaker").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });

    expect(await api(who).calendars.group.setDetailsAllowed({ groupId: group.id, allowed: false })).toEqual({
      groupId: group.id,
      detailsOutsideAllowed: false,
    });
    // Generic for everyone at once; the consent itself is kept.
    expect(await api("caretaker").calendars.settings.get({ groupId: group.id })).toMatchObject({
      groupAllowsDetails: false,
      detailsConsent: true,
      shareLevel: "generic",
    });
    const refused = api("viewer").calendars.settings.update({
      groupId: group.id,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    expect((await rejection(refused)).data?.code).toBe("calendarSettingService:detailsForbidden");
    // Turning it off is still allowed while forbidden.
    expect(
      await api("caretaker").calendars.settings.update({ groupId: group.id, detailsConsent: false }),
    ).toMatchObject({ detailsConsent: false });

    await api(who).calendars.group.setDetailsAllowed({ groupId: group.id, allowed: true });
    expect(
      await api("viewer").calendars.settings.update({
        groupId: group.id,
        detailsConsent: true,
        detailsConsentVersion: DETAILS_CONSENT_VERSION,
      }),
    ).toMatchObject({ shareLevel: "details" });
  });

  it.each(["admin", "caretaker", "viewer"] as const)("refuses a %s with a 403", async (who) => {
    const { group, api } = await setup();
    const error = await rejection(
      api(who).calendars.group.setDetailsAllowed({ groupId: group.id, allowed: false }),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(error.data?.code).toBe("calendarSettingService:detailsOwnerOnly");
    expect(await api("owner").calendars.settings.get({ groupId: group.id })).toMatchObject({
      groupAllowsDetails: true,
    });
  });

  it("answers a non-member with a 404", async () => {
    const { group, api } = await setup();
    const error = await rejection(
      api("outsider").calendars.group.setDetailsAllowed({ groupId: group.id, allowed: false }),
    );
    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("leaving and removal", () => {
  /** A setting and an override for `who`, on an upcoming appointment. */
  const withRows = async (s: Awaited<ReturnType<typeof setup>>, who: Who) => {
    await s.api(who).calendars.settings.update({
      groupId: s.group.id,
      remindersOn: true,
      detailsConsent: true,
      detailsConsentVersion: DETAILS_CONSENT_VERSION,
    });
    const event = ok(
      await timelineEntryService.create(s.ctx("owner"), {
        groupId: s.group.id,
        recipientId: s.recipient.id,
        kind: "event",
        title: "Physical therapy",
        occurredAt: new Date(Date.now() + 86_400_000).toISOString(),
        timeZone: "America/Los_Angeles",
      }),
    );
    ok(
      await reminderOverrideModel.create({
        ...s.ctx(who),
        data: { userId: s.id(who), groupId: s.group.id, entryId: event!.id, mode: "mute" },
      }),
    );
    expect(await rowsOf(s.group.id, s.id(who))).toEqual({ settings: 1, overrides: 1 });
  };

  it("deletes a removed member's settings and overrides, and no one else's", async () => {
    const s = await setup();
    await withRows(s, "viewer");
    await withRows(s, "caretaker");
    await s.api("admin").careGroup.removeMember({ groupId: s.group.id, userId: s.id("viewer") });
    expect(await rowsOf(s.group.id, s.id("viewer"))).toEqual({ settings: 0, overrides: 0 });
    expect(await rowsOf(s.group.id, s.id("caretaker"))).toEqual({ settings: 1, overrides: 1 });
  });

  it("deletes a leaving member's, and they read the group no more", async () => {
    const s = await setup();
    await withRows(s, "caretaker");
    await s.api("caretaker").careGroup.removeMember({ groupId: s.group.id, userId: s.id("caretaker") });
    expect(await rowsOf(s.group.id, s.id("caretaker"))).toEqual({ settings: 0, overrides: 0 });
    expect((await rejection(s.api("caretaker").calendars.settings.get({ groupId: s.group.id }))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("leaves everything when the removal is refused (the last owner)", async () => {
    const s = await setup();
    await withRows(s, "owner");
    await s.api("owner").careGroup.removeMember({ groupId: s.group.id, userId: s.id("owner2") });
    const refused = s.api("owner").careGroup.removeMember({ groupId: s.group.id, userId: s.id("owner") });
    const error = await rejection(refused);
    expect(error.code).toBe("CONFLICT");
    expect(error.data?.code).toBe("careGroupMemberService:lastOwner");
    expect(await rowsOf(s.group.id, s.id("owner"))).toEqual({ settings: 1, overrides: 1 });
  });
});
