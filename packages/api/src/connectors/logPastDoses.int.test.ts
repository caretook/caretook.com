import type { AuthUser } from "@caretook/data";

import {
  assistantActionService,
  careGroupService,
  getDb,
  isError,
  medicationPassService,
  medicationService,
  SYSTEM_USER,
  timelineEntryModel,
  timelineEntryService,
} from "@caretook/data";
import { addDays, dayInZone, passRoundId, zonedInstant } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { createGroup, createUser, ok } from "../../../data/test/fixtures";
import {
  callTool,
  connectAssistant,
  enablePasswordSignIn,
  mcpHandler,
  mcpPost,
  toolRequest,
} from "./testing";

// log_past_doses through /mcp with real tokens: a fictional week of the
// paper sheet, seeded through the services. The clock is pinned to noon
// yesterday (Los Angeles, the recipient's zone), so "today" has a slot due
// earlier and one later, and every write is in the real past. Medications
// were added 20 days before it (their row and "started" entry), so every
// day read has its slots. All data is fictional.

const LA = "America/Los_Angeles";
const CLIENT = "Test Claude";
const TODAY = addDays(dayInZone(new Date(), LA), -1);
const CLOCK = zonedInstant(TODAY, "12:00", LA);
const day = (n: number) => addDays(TODAY, n);
const at = (d: string, time: string) => zonedInstant(d, time, LA).toISOString();

const handler = mcpHandler({ now: () => CLOCK });

type Mark = { medicationId: string; day: string; time: string; status: string; note?: string };
type Result = {
  outcome: string;
  mark: Mark;
  entryId: string | null;
  recorded?: { status: string; loggedBy: string | null };
};
type Structured = { results: Result[]; added: number; via: string; url: string };

const world = async () => {
  const owner = await createUser("owner");
  const caretaker = await createUser("caretaker");
  const viewer = await createUser("viewer");
  for (const who of [owner, caretaker, viewer]) await enablePasswordSignIn(who.user.id);
  const { group, recipient } = await createGroup(owner, [
    { user: caretaker.user, role: "caretaker" },
    { user: viewer.user, role: "viewer" },
  ]);
  ok(
    await careGroupService.update(owner.ctx, {
      filter: { id: { type: "eq", value: group.id } },
      data: { connectorsEnabled: true },
    }),
  );
  const passes = ok(await medicationPassService.list(owner.ctx, { groupId: group.id })).data;
  const morning = passes.find((p) => p.name === "Morning")!;
  const evening = passes.find((p) => p.name === "Evening")!;
  const added = new Date(CLOCK.getTime() - 20 * 24 * 60 * 60_000).toISOString();
  const addMedication = async (fields: Record<string, unknown>) => {
    const medication = ok(
      await medicationService.create(owner.ctx, { groupId: group.id, ...fields } as never, {
        changedAt: added,
      }),
    )!;
    // The row's own time too: the due-dose core gives no slots before the day it was added.
    await getDb().$client.query(`UPDATE medication SET created_at = $1 WHERE id = $2`, [
      added,
      medication.id,
    ]);
    return medication;
  };
  const metformin = await addMedication({
    name: "Metformin",
    strength: "500 mg",
    dose: "1 tablet",
    schedule: { type: "scheduled", slots: [{ passId: morning.id }, { passId: evening.id }] },
  });
  const lisinopril = await addMedication({
    name: "Lisinopril",
    strength: "10 mg",
    dose: "1 tablet",
    schedule: { type: "scheduled", slots: [{ passId: morning.id, amount: "2 tablets" }] },
  });
  const vitamin = await addMedication({
    name: "Vitamin D",
    dose: "1 capsule",
    schedule: { type: "scheduled", slots: [{ time: "13:00" }] },
  });
  /** A dose logged in the app. */
  const logged = async (
    who: { ctx: { authUser: AuthUser } },
    occurredAt: string,
    details: Record<string, unknown>,
  ) =>
    ok(
      await timelineEntryService.create(who.ctx, {
        groupId: group.id,
        recipientId: recipient.id,
        kind: "dose",
        occurredAt,
        timeZone: LA,
        details,
      } as never),
    )!;
  const connect = async (who: typeof owner, scope: "read" | "readWrite" = "readWrite") =>
    (await connectAssistant({ email: who.user.email, groupId: group.id, scope, clientName: CLIENT })).tokens
      .access_token;
  const doses = async () =>
    ok(
      await timelineEntryModel.list({
        authUser: SYSTEM_USER,
        filter: { groupId: { type: "eq", value: group.id }, kind: { type: "eq", value: "dose" } },
        paginate: { page: 1, limit: 500 },
      }),
    ).data;
  return {
    owner,
    caretaker,
    viewer,
    group,
    morning,
    evening,
    metformin,
    lisinopril,
    vitamin,
    logged,
    connect,
    doses,
  };
};
type World = Awaited<ReturnType<typeof world>>;

/** The sheet: a mark per box, and what each comes to. */
const sheetOf = (w: World) => {
  const mark = (medicationId: string, d: string, time: string, status = "given", note?: string): Mark => ({
    medicationId,
    day: d,
    time,
    status,
    ...(note && { note }),
  });
  return [
    // Three days back: Morning's two, Evening's one, Vitamin D's own time.
    [mark(w.metformin.id, day(-3), "08:00"), "add"],
    [mark(w.lisinopril.id, day(-3), "08:00"), "add"],
    [mark(w.metformin.id, day(-3), "20:00", "skipped"), "add"],
    [mark(w.vitamin.id, day(-3), "13:00"), "add"],
    // Four days back, with the sheet's note.
    [mark(w.lisinopril.id, day(-4), "08:00", "refused", "Said it tasted bad"), "add"],
    // Two days back: Morning's Metformin given in the app, Lisinopril joins its round; Evening's given, the sheet says refused.
    [mark(w.metformin.id, day(-2), "08:00"), "alreadyLogged"],
    [mark(w.lisinopril.id, day(-2), "08:00"), "add"],
    [mark(w.metformin.id, day(-2), "20:00", "refused"), "conflict"],
    // Today: Morning has passed, Evening is still ahead.
    [mark(w.metformin.id, day(0), "08:00"), "add"],
    [mark(w.metformin.id, day(0), "20:00"), "notYet"],
    // Vitamin D isn't taken at 08:00; fifteen days back is past the reach.
    [mark(w.vitamin.id, day(-3), "08:00"), "noSlot"],
    [mark(w.metformin.id, day(-15), "08:00"), "tooOld"],
  ] as const;
};

/** The app's doses two days back: Morning's Metformin (in a round) by the caretaker, Evening's by the owner. */
const seedApp = async (w: World) => {
  const round = crypto.randomUUID();
  const morning = await w.logged(w.caretaker, at(day(-2), "08:10"), {
    medicationId: w.metformin.id,
    status: "given",
    amount: "1 tablet",
    scheduledFor: "08:00",
    passId: w.morning.id,
    passLogId: round,
  });
  const evening = await w.logged(w.owner, at(day(-2), "20:05"), {
    medicationId: w.metformin.id,
    status: "given",
    scheduledFor: "20:00",
    passId: w.evening.id,
  });
  return { round, morning, evening };
};

describe("log_past_doses", { timeout: 60_000 }, () => {
  it("adds a sheet's open slots at their times in their rounds, and reports every other mark", async () => {
    const w = await world();
    const app = await seedApp(w);
    const token = await w.connect(w.caretaker);
    const sheet = sheetOf(w);
    const result = await callTool(handler, token, "log_past_doses", { marks: sheet.map(([m]) => m) });
    expect(result.isError).toBeUndefined();
    const out = result.structuredContent as unknown as Structured;
    expect(out.results.map((r) => r.outcome)).toEqual(sheet.map(([, o]) => o));
    expect(out.results.map((r) => r.mark)).toEqual(sheet.map(([m]) => m));
    expect(out.added).toBe(7);
    expect(out.via).toBe(CLIENT);

    // Each add a dose at its slot's moment, with the slot's amount, via the client.
    const byId = new Map((await w.doses()).map((d) => [d.id, d]));
    const dose = (i: number) => byId.get(out.results[i]!.entryId!)!;
    expect(dose(0)).toMatchObject({
      via: CLIENT,
      createdBy: w.caretaker.user.id,
      details: {
        medicationId: w.metformin.id,
        status: "given",
        amount: "1 tablet",
        scheduledFor: "08:00",
        passId: w.morning.id,
      },
    });
    expect(new Date(dose(0).occurredAt).toISOString()).toBe(at(day(-3), "08:00"));
    expect(dose(1).details).toMatchObject({ medicationId: w.lisinopril.id, amount: "2 tablets" });
    expect(dose(2).details).toMatchObject({ status: "skipped", passId: w.evening.id, scheduledFor: "20:00" });
    expect(new Date(dose(2).occurredAt).toISOString()).toBe(at(day(-3), "20:00"));
    expect(dose(4).details).toMatchObject({ status: "refused", note: "Said it tasted bad" });
    // One round per med time and day; a medication's own time has none; a started round is joined.
    const roundOf = (i: number) => (dose(i).details as { passLogId?: string | null }).passLogId ?? null;
    expect(roundOf(0)).toBe(passRoundId(`pass:${w.morning.id}`, day(-3)));
    expect(roundOf(1)).toBe(roundOf(0));
    expect(roundOf(2)).toBe(passRoundId(`pass:${w.evening.id}`, day(-3)));
    expect(roundOf(3)).toBeNull();
    expect(dose(3).details).toMatchObject({
      medicationId: w.vitamin.id,
      scheduledFor: "13:00",
      amount: "1 capsule",
    });
    expect(roundOf(6)).toBe(app.round);

    // The app's doses: reported with their ids, the conflict left as it was.
    expect(out.results[5]).toMatchObject({ entryId: app.morning.id });
    expect(out.results[7]).toMatchObject({
      entryId: app.evening.id,
      recorded: { status: "given", loggedBy: "owner" },
    });
    expect(byId.get(app.evening.id)!.details).toMatchObject({ status: "given" });
    for (const i of [9, 10, 11]) expect(out.results[i]!.entryId).toBeNull();

    const text = result.content[0]!.text;
    expect(text).toContain("Added 7 doses, 1 already logged, 1 to check, 3 not logged.");
    expect(text).toMatch(
      /Evening, Metformin 500 mg: the sheet says refused, the app says given \(logged by owner\)\. Ask the member; it can be changed in the app\./,
    );
    expect(text).toContain("Evening, Metformin 500 mg: not logged, that dose's time hasn't come yet.");
    expect(text).toContain("08:00, Metformin 500 mg: not logged, more than 14 days back");
    expect(text).toContain("08:00, Vitamin D: not logged, no scheduled dose");
    expect(text).toContain(`/app/groups/${w.group.id}/timeline`);
    expect(text).toContain(`Shown as "via ${CLIENT}".`);

    // past_doses then shows the added slots in their marks' states.
    const record = await callTool(handler, token, "past_doses", { from: day(-4), days: 5 });
    type Slot = { medicationId: string; time: string; state: string; dose: { entryId: string } | null };
    const days = (record.structuredContent as { days: { day: string; rounds: { slots: Slot[] }[] }[] }).days;
    const stateOf = (m: Mark) =>
      days
        .find((d) => d.day === m.day)!
        .rounds.flatMap((r) => r.slots)
        .find((s) => s.medicationId === m.medicationId && s.time === m.time)!;
    for (const [i, [m, o]] of sheet.entries())
      if (o === "add") {
        expect(stateOf(m).state, `${m.day} ${m.time}`).toBe(m.status);
        expect(stateOf(m).dose!.entryId).toBe(out.results[i]!.entryId);
      }

    // The same sheet again adds nothing.
    const again = await callTool(handler, token, "log_past_doses", { marks: sheet.map(([m]) => m) });
    const twice = again.structuredContent as unknown as Structured;
    expect(twice.added).toBe(0);
    expect(twice.results.map((r) => r.outcome)).toEqual(
      sheet.map(([, o]) => (o === "add" ? "alreadyLogged" : o)),
    );
    expect(again.content[0]!.text).toMatch(/^Nothing added, 8 already logged, 1 to check, 3 not logged\./);
    expect(again.content[0]!.text).not.toContain("Shown as");
    expect((await w.doses()).length).toBe(byId.size);
  });

  it("adds each dose once when two identical sheets arrive at once", async () => {
    const w = await world();
    const token = await w.connect(w.caretaker);
    const marks = sheetOf(w)
      .filter(([, o]) => o === "add")
      .map(([m]) => m);
    const [a, b] = await Promise.all([
      callTool(handler, token, "log_past_doses", { marks }),
      callTool(handler, token, "log_past_doses", { marks }),
    ]);
    const added = [a, b].map((r) => (r.structuredContent as unknown as Structured).added);
    expect(added.sort()).toEqual([0, marks.length]);
    expect((await w.doses()).length).toBe(marks.length);
  });

  it("refuses a sheet of 201 marks or one with a bad status whole, writing nothing", async () => {
    const w = await world();
    const token = await w.connect(w.caretaker);
    const good = { medicationId: w.metformin.id, day: day(-3), time: "08:00", status: "given" };
    const many = await callTool(handler, token, "log_past_doses", {
      marks: Array.from({ length: 201 }, () => good),
    });
    expect(many.isError).toBe(true);
    const bad = await callTool(handler, token, "log_past_doses", {
      marks: [good, { ...good, status: "missed" }],
    });
    expect(bad.isError).toBe(true);
    // The service refuses the same batch on its own.
    const direct = await assistantActionService.logPastDoses(
      w.caretaker.ctx,
      w.group.id,
      [good, { ...good, status: "missed" }],
      { via: CLIENT, now: CLOCK },
    );
    expect(direct).toMatchObject({ code: "assistantActionService:invalid" });
    expect(await w.doses()).toEqual([]);
  });

  it("isn't for a read grant, nor a viewer's", async () => {
    const w = await world();
    const marks = [{ medicationId: w.metformin.id, day: day(-3), time: "08:00", status: "given" }];
    for (const token of [await w.connect(w.caretaker, "read"), await w.connect(w.viewer, "read")]) {
      const res = await mcpPost(handler, token, toolRequest("log_past_doses", { marks }));
      expect(res.status).toBe(403);
    }
    // And the service refuses a viewer outright.
    const direct = await assistantActionService.logPastDoses(w.viewer.ctx, w.group.id, marks, {
      via: CLIENT,
      now: CLOCK,
    });
    expect(isError(direct)).toBe(true);
    expect(await w.doses()).toEqual([]);
  });
});
