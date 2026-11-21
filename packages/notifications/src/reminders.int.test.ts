import type { OutgoingMessage } from "./senders";

import {
  appSettingSchema,
  calendarReminderService,
  calendarSettingService,
  careGroupMemberService,
  emailSuppressionService,
  entryProviderService,
  getDb,
  isError,
  notificationOutboxSchema as outbox,
  providerService,
  taskService,
  timelineEntryService,
} from "@caretook/data";
import { addDays, dayInZone, zonedInstant } from "@caretook/data/schema";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../data/test/fixtures";
import { deliverDue } from "./outbox";
import { handleReminderUnsubscribe, sweepReminders } from "./reminders";
import { createMemorySender } from "./senders";

// The reminder sweep (appointments-2 slice 6) on the test database, with the
// memory sender: a send goes once however often the cron runs, a moved
// visit sends again, the wording is generic until a member consents, a
// suppressed address is skipped, the unsubscribe link turns reminders off,
// and a former member gets nothing. Times are a few days ahead of the real
// clock (entries are made now), at fixed Los Angeles times. Made-up people.

const LA = "America/Los_Angeles";
const MINUTE = 60_000;
const DAY = dayInZone(new Date(Date.now() + 3 * 86_400_000), LA);
const at = (day: string, time: string) => zonedInstant(day, time, LA);
const NINE = at(DAY, "09:00");
const HOUR_BEFORE = new Date(NINE.getTime() - 60 * MINUTE);
const EVENING_BEFORE = at(addDays(DAY, -1), "18:00");
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MINUTE);

const resetLastRun = () =>
  getDb().delete(appSettingSchema).where(eq(appSettingSchema.key, calendarReminderService.LAST_RUN_KEY));

beforeEach(async () => {
  await resetLastRun();
});

const setup = async () => {
  const ana = await createUser("ana");
  const ben = await createUser("ben");
  const cy = await createUser("cy");
  const { group } = await createGroup(ana, [
    { user: ben.user, role: "caretaker" },
    { user: cy.user, role: "viewer" },
  ]);
  const remindersOn = async (who: typeof ana, change: Record<string, unknown> = {}) =>
    ok(await calendarSettingService.update(who.ctx, group.id, { remindersOn: true, ...change }));
  const addAppointment = async (v: Record<string, unknown> = {}) => {
    const entry = ok(
      await timelineEntryService.create(ana.ctx, {
        groupId: group.id,
        kind: "event",
        title: "Dialysis",
        place: "Riverside Clinic",
        occurredAt: NINE.toISOString(),
        endsAt: plus(NINE, 60).toISOString(),
        timeZone: LA,
        ...v,
      } as never),
    );
    if (!entry) throw new Error("entry not readable");
    return entry;
  };
  return { ana, ben, cy, group, remindersOn, addAppointment };
};

/** Run the sweep at `now` and deliver what it queued to a fresh memory sender. */
const sweep = async (now: Date) => {
  const res = await sweepReminders(now, { deliver: false });
  if (isError(res)) throw new Error(String(res.code));
  const sender = createMemorySender();
  if (res.ids.length) {
    const delivered = await deliverDue({ ids: res.ids, sender });
    if (isError(delivered)) throw new Error(String(delivered.code));
  }
  return { ...res, sent: sender.sent };
};

const to = (sent: OutgoingMessage[], email: string) => sent.filter((m) => m.to === email);

describe("sweepReminders", () => {
  it("sends each reminder once, however often or late the cron runs", async () => {
    const { ana, remindersOn, addAppointment } = await setup();
    await remindersOn(ana);
    await addAppointment();

    const first = await sweep(HOUR_BEFORE);
    const mine = to(first.sent, ana.user.email);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "appointmentReminder" });
    // The next minute, the same minute again, and a run that lost its last-run time: nothing new.
    expect(to((await sweep(plus(HOUR_BEFORE, 1))).sent, ana.user.email)).toEqual([]);
    expect(to((await sweep(HOUR_BEFORE)).sent, ana.user.email)).toEqual([]);
    await resetLastRun();
    expect(to((await sweep(plus(HOUR_BEFORE, 2))).sent, ana.user.email)).toEqual([]);

    // The evening before, caught up 5 h late (the 1 h one isn't due yet).
    await resetLastRun();
    await sweep(plus(EVENING_BEFORE, -1));
    const late = to((await sweep(plus(EVENING_BEFORE, 5 * 60))).sent, ana.user.email);
    expect(late).toHaveLength(1);
  });

  it("sends again when a visit moves, and nothing once it's cancelled", async () => {
    const { ana, remindersOn, addAppointment } = await setup();
    await remindersOn(ana, { reminderLeads: [60] });
    const visit = await addAppointment();
    expect(to((await sweep(HOUR_BEFORE)).sent, ana.user.email)).toHaveLength(1);

    // Moved to 10:00: its new 1 h reminder goes at 9:00.
    ok(
      await timelineEntryService.update(ana.ctx, visit.id, {
        occurredAt: plus(NINE, 60).toISOString(),
        endsAt: plus(NINE, 120).toISOString(),
      }),
    );
    expect(to((await sweep(NINE)).sent, ana.user.email)).toHaveLength(1);

    // Cancelled before its next reminder: none.
    const other = await addAppointment({ occurredAt: plus(NINE, 180).toISOString(), endsAt: null });
    ok(await timelineEntryService.update(ana.ctx, other.id, { cancelledAt: new Date().toISOString() }));
    expect(to((await sweep(plus(NINE, 120))).sent, ana.user.email)).toEqual([]);
  });

  it("says nothing but the kind, the time and a link until the member consents to details", async () => {
    const { ana, group, remindersOn, addAppointment } = await setup();
    await remindersOn(ana, { reminderLeads: [60] });
    const visit = await addAppointment();
    const provider = ok(
      await providerService.create(ana.ctx, {
        groupId: group.id,
        type: "clinician",
        name: "Dr. Rivera Example",
      }),
    );
    ok(
      await entryProviderService.link(ana.ctx, {
        groupId: group.id,
        entryId: visit.id,
        providerId: provider!.id,
      }),
    );

    const [generic] = to((await sweep(HOUR_BEFORE)).sent, ana.user.email);
    expect(generic?.subject).toMatch(/^Appointment for Pat Example · .+ · 9:00–10:00$/);
    for (const part of [generic!.subject, generic!.text, generic!.html]) {
      expect(part).not.toContain("Dialysis");
      expect(part).not.toContain("Riverside");
      expect(part).not.toContain("Rivera");
    }
    expect(generic!.text).toContain(`/app/groups/${group.id}/entries/${visit.id}`);
    expect(generic!.headers).toMatchObject({ "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

    // With consent: the title, place and provider.
    ok(await calendarSettingService.update(ana.ctx, group.id, { detailsConsent: true }));
    const moved = plus(NINE, 30);
    ok(await timelineEntryService.update(ana.ctx, visit.id, { occurredAt: moved.toISOString() }));
    const [detailed] = to((await sweep(plus(moved, -60))).sent, ana.user.email);
    expect(detailed?.subject).toContain("Appointment for Pat Example: Dialysis");
    expect(detailed!.text).toContain("At Riverside Clinic");
    expect(detailed!.text).toContain("With Dr. Rivera Example");

    // The owners keep details private: generic again, consent or not.
    ok(await calendarSettingService.setDetailsAllowed(ana.ctx, group.id, false));
    const later = plus(NINE, 90);
    ok(
      await timelineEntryService.update(ana.ctx, visit.id, {
        occurredAt: later.toISOString(),
        endsAt: plus(later, 60).toISOString(),
      }),
    );
    const [forbidden] = to((await sweep(plus(later, -60))).sent, ana.user.email);
    expect(forbidden?.subject).not.toContain("Dialysis");
  });

  it("reminds a task's assignee, and skips a suppressed address", async () => {
    const { ana, ben, cy, group, remindersOn, addAppointment } = await setup();
    await remindersOn(ana, { reminderLeads: [60] });
    await remindersOn(ben, { reminderLeads: [60] });
    await remindersOn(cy, { reminderLeads: [60] });
    await addAppointment();
    ok(
      await taskService.create(ana.ctx, {
        groupId: group.id,
        title: "Pick up the prescription",
        assigneeId: ben.user.id,
        dueOn: DAY,
        dueTime: "09:00",
      }),
    );
    ok(await emailSuppressionService.suppress(cy.user.email, "bounce", `evt-${randomUUID()}`));

    const { ids, sent } = await sweep(HOUR_BEFORE);
    expect(to(sent, ana.user.email).map((m) => m.name)).toEqual(["appointmentReminder"]);
    expect(
      to(sent, ben.user.email)
        .map((m) => m.name)
        .sort(),
    ).toEqual(["appointmentReminder", "taskDue"]);
    const task = to(sent, ben.user.email).find((m) => m.name === "taskDue");
    expect(task?.subject).toMatch(/^Task for Pat Example · .+ · 9:00$/);
    expect(task?.text).not.toContain("prescription");
    // Cy's was queued and then skipped, not sent.
    expect(to(sent, cy.user.email)).toEqual([]);
    const rows = await getDb().select().from(outbox).where(inArray(outbox.id, ids));
    expect(rows.filter((r) => r.recipient === cy.user.email).map((r) => [r.status, r.lastError])).toEqual([
      ["skipped", "suppressed"],
    ]);
  });

  it("turns reminders off from the email's unsubscribe link", async () => {
    const { ana, group, remindersOn, addAppointment } = await setup();
    await remindersOn(ana);
    await addAppointment();
    const [message] = to((await sweep(EVENING_BEFORE)).sent, ana.user.email);
    const header = message?.headers?.["List-Unsubscribe"] ?? "";
    const url = new URL(header.slice(1, -1));
    expect(message!.text).toContain(url.toString());
    const token = url.pathname.split("/").at(-1)!;

    // Opening it asks first and changes nothing; a forged one is refused.
    const asked = await handleReminderUnsubscribe(new Request(url, { method: "GET" }), token);
    expect(asked.status).toBe(200);
    expect(await asked.text()).toContain('<form method="post">');
    expect(ok(await calendarSettingService.get(ana.ctx, group.id)).remindersOn).toBe(true);
    const forged = `${token.slice(0, -2)}xx`;
    expect((await handleReminderUnsubscribe(new Request(url, { method: "POST" }), forged)).status).toBe(404);

    // A mail app's one-click POST turns them off; the 1 h reminder doesn't come.
    const res = await handleReminderUnsubscribe(
      new Request(url, { method: "POST", body: "List-Unsubscribe=One-Click" }),
      token,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Reminder emails are off");
    expect(ok(await calendarSettingService.get(ana.ctx, group.id)).remindersOn).toBe(false);
    expect(to((await sweep(HOUR_BEFORE)).sent, ana.user.email)).toEqual([]);
  });

  it("sends nothing to someone who left the group", async () => {
    const { ana, ben, remindersOn, addAppointment, group } = await setup();
    await remindersOn(ana, { reminderLeads: [60] });
    await remindersOn(ben, { reminderLeads: [60] });
    await addAppointment();
    ok(await careGroupMemberService.leave(ben.ctx, group.id));
    const { sent } = await sweep(HOUR_BEFORE);
    expect(to(sent, ana.user.email)).toHaveLength(1);
    expect(to(sent, ben.user.email)).toEqual([]);
  });
});
