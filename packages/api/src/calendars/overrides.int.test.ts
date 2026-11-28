import {
  calendarReminderService,
  calendarSettingService,
  isError,
  timelineEntryService,
  withTransaction,
} from "@caretook/data";
import { createMemorySender, deliverDue, sweepReminders } from "@caretook/notifications";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import { clientFor, rejection } from "../testing";
import { dayInZone, zonedInstant } from "@caretook/data/domain";

// "Remind me" over the API (appointments-2 slice 8): each member's own
// choice for one appointment, whatever their role; an entry in another group
// is refused; and the reminder sweep honours a mute and an extra. Made-up people.

const LA = "America/Los_Angeles";
const MINUTE = 60_000;
const DAY = dayInZone(new Date(Date.now() + 3 * 86_400_000), LA);
const NINE = zonedInstant(DAY, "09:00", LA);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MINUTE);

// Start each test's sweeps just before its first run (the last run is shared state).
const startSweepsAt = (at: Date) =>
  withTransaction(async (tx) => {
    const set = await calendarReminderService.setLastRun(tx, at);
    if (isError(set)) throw new Error(String(set.code));
  });

const ROLES = ["owner", "admin", "caretaker", "viewer"] as const;

const setup = async () => {
  const people = {
    owner: await createUser("owner"),
    admin: await createUser("admin"),
    caretaker: await createUser("caretaker"),
    viewer: await createUser("viewer"),
    outsider: await createUser("outsider"),
  };
  const { group } = await createGroup(people.owner, [
    { user: people.admin.user, role: "admin" },
    { user: people.caretaker.user, role: "caretaker" },
    { user: people.viewer.user, role: "viewer" },
  ]);
  const other = await createGroup(people.outsider, []);
  const api = (who: keyof typeof people) => clientFor(people[who].ctx.authUser);
  const entryIn = async (
    groupId: string,
    owner: typeof people.owner,
    kind: "event" | "note" | "symptom" = "event",
  ) =>
    ok(
      await timelineEntryService.create(owner.ctx, {
        groupId,
        kind,
        title: "Dialysis",
        occurredAt: NINE.toISOString(),
        endsAt: plus(NINE, 60).toISOString(),
        timeZone: LA,
        ...(kind === "symptom"
          ? {
              title: null,
              endsAt: undefined,
              occurredAt: new Date(Date.now() - 3600_000).toISOString(),
              details: { name: "Pain" },
            }
          : {}),
      } as never),
    )!;
  return { people, group, other, api, entryIn };
};

describe("calendars.overrides", () => {
  it("starts at default and saves each choice, for every role, for themself only", async () => {
    const s = await setup();
    const entry = await s.entryIn(s.group.id, s.people.owner);
    for (const who of ROLES) {
      const api = s.api(who);
      const ids = { groupId: s.group.id, entryId: entry.id };
      expect(await api.calendars.overrides.get(ids)).toEqual({ mode: "default" });
      expect(await api.calendars.overrides.set({ ...ids, choice: { mode: "mute" } })).toEqual({
        mode: "mute",
      });
      expect(await api.calendars.overrides.get(ids)).toEqual({ mode: "mute" });
      expect(
        await api.calendars.overrides.set({
          ...ids,
          choice: { mode: "extra", leads: [30, "eveningBefore"] },
        }),
      ).toEqual({
        mode: "extra",
        leads: ["eveningBefore", 30],
      });
      expect(await api.calendars.overrides.get(ids)).toEqual({ mode: "extra", leads: ["eveningBefore", 30] });
    }
    // Each member's choice is their own: the owner's is still extra, and clearing the viewer's leaves it.
    const ids = { groupId: s.group.id, entryId: entry.id };
    expect(await s.api("viewer").calendars.overrides.set({ ...ids, choice: { mode: "default" } })).toEqual({
      mode: "default",
    });
    expect(await s.api("viewer").calendars.overrides.get(ids)).toEqual({ mode: "default" });
    expect(await s.api("owner").calendars.overrides.get(ids)).toEqual({
      mode: "extra",
      leads: ["eveningBefore", 30],
    });
  });

  it("refuses an entry in another group, a non-member, a symptom and bad leads", async () => {
    const s = await setup();
    const mine = await s.entryIn(s.group.id, s.people.owner);
    const theirs = await s.entryIn(s.other.group.id, s.people.outsider);
    const symptom = await s.entryIn(s.group.id, s.people.owner, "symptom");
    const set = (who: "owner" | "outsider", groupId: string, entryId: string) =>
      s.api(who).calendars.overrides.set({ groupId, entryId, choice: { mode: "mute" } });

    expect((await rejection(set("owner", s.group.id, theirs.id))).data?.code).toBe(
      "reminderOverrideService:notFound",
    );
    expect((await rejection(set("owner", s.other.group.id, theirs.id))).data?.code).toBe(
      "reminderOverrideService:notFound",
    );
    expect((await rejection(set("outsider", s.group.id, mine.id))).data?.code).toBe(
      "reminderOverrideService:notFound",
    );
    expect(
      (await rejection(s.api("owner").calendars.overrides.get({ groupId: s.group.id, entryId: theirs.id })))
        .data?.code,
    ).toBe("reminderOverrideService:notFound");
    expect((await rejection(set("owner", s.group.id, symptom.id))).data?.code).toBe(
      "reminderOverrideService:notFound",
    );
    await rejection(
      s.api("owner").calendars.overrides.set({
        groupId: s.group.id,
        entryId: mine.id,
        choice: { mode: "extra", leads: [30, 60, 120, "morningOf"] as never },
      }),
    );
    await rejection(
      s.api("owner").calendars.overrides.set({
        groupId: s.group.id,
        entryId: mine.id,
        choice: { mode: "extra", leads: [] },
      }),
    );
  });

  it("has the sweep honour a mute and an extra", async () => {
    const s = await setup();
    const entry = await s.entryIn(s.group.id, s.people.owner);
    for (const who of ["owner", "admin", "caretaker"] as const)
      ok(
        await calendarSettingService.update(s.people[who].ctx, s.group.id, {
          remindersOn: true,
          reminderLeads: [60],
        }),
      );
    const ids = { groupId: s.group.id, entryId: entry.id };
    await s.api("admin").calendars.overrides.set({ ...ids, choice: { mode: "mute" } });
    await s.api("caretaker").calendars.overrides.set({ ...ids, choice: { mode: "extra", leads: [30] } });

    await startSweepsAt(plus(NINE, -62));
    const sent: Record<string, number> = {};
    for (const now of [plus(NINE, -59), plus(NINE, -29)]) {
      const res = await sweepReminders(now, { deliver: false });
      if (isError(res)) throw new Error(String(res.code));
      const sender = createMemorySender();
      if (res.ids.length) {
        const delivered = await deliverDue({ ids: res.ids, sender });
        if (isError(delivered)) throw new Error(String(delivered.code));
      }
      for (const m of sender.sent) sent[m.to] = (sent[m.to] ?? 0) + 1;
    }
    const count = (who: keyof typeof s.people) => sent[s.people[who].user.email] ?? 0;
    expect(count("owner")).toBe(1); // the 1 h reminder
    expect(count("admin")).toBe(0); // muted
    expect(count("caretaker")).toBe(2); // 1 h plus the extra 30 min
  });
});
