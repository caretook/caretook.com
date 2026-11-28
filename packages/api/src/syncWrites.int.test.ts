import type { AuthUser } from "@caretook/data";

import {
  appointmentSeriesService,
  getDb,
  isError,
  noteDocumentService,
  providerService,
  timelineEntryService,
} from "@caretook/data";
import { seriesVisitId } from "@caretook/data/domain";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGroup, createUser, newYDoc, ok, typeParagraph } from "../../data/test/fixtures";
import { clientFor, codeOf, patchOp, putOp, upload } from "./testing";

// sync.upload a write at a time (sync-safety-3 slice 2, B-294): consecutive
// ops sharing a `write` (one save on the device) run in one transaction, so
// a save lands whole or not at all. Each test makes its own users and groups.

afterEach(() => {
  vi.restoreAllMocks();
});

const AT = "2026-11-18T18:00:00.000000Z";
const LA = "America/Los_Angeles";

const setup = async () => {
  const owner = await createUser("owner");
  const { group, recipient } = await createGroup(owner);
  // Another family's group, with a provider the owner can't reach.
  const stranger = await createUser("stranger");
  const other = await createGroup(stranger);
  const strangerApi = clientFor(stranger.ctx.authUser);
  const theirs = randomUUID();
  expect(
    await upload(strangerApi, [putOp("provider", theirs, providerRow(other.group.id, "Dr. Far"))]),
  ).toEqual([{ id: theirs, status: "applied" }]);
  return { group, recipient, theirs, owner: { ...owner, api: clientFor(owner.ctx.authUser) } };
};

const providerRow = (group_id: string, name: string) => ({
  group_id,
  type: "clinician",
  name,
  specialty: null,
  practice_id: null,
  phones: "[]",
  email: null,
  address: null,
  website: null,
  status: "current",
  is_primary: 0,
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
});

const seriesRow = (groupId: string, recipientId: string) => ({
  group_id: groupId,
  recipient_id: recipientId,
  kind: "event",
  rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
  starts_on: "2027-03-01",
  start_time: "06:00",
  all_day: 0,
  time_zone: LA,
  title: "Dialysis",
  duration_minutes: 240,
  place: null,
  provider_ids: "[]",
  topped_up_through: "2027-03-05",
  deleted_at: null,
  created_at: AT,
  updated_at: AT,
});

const visitRow = (groupId: string, recipientId: string, seriesId: string, day: string) => ({
  group_id: groupId,
  recipient_id: recipientId,
  kind: "event",
  occurred_at: `${day}T14:00:00.000000Z`,
  time_zone: LA,
  title: "Dialysis",
  body: null,
  details: null,
  ends_at: null,
  all_day: 0,
  series_id: seriesId,
  series_day: day,
  series_detached: 0,
  deleted_at: null,
});

/** A PATCH of the stranger's provider: refused. */
const refusedPatch = (theirs: string, write?: number) =>
  patchOp("provider", theirs, { name: "Dr. Mine Now" }, write);

const stored = async (ctx: { authUser: AuthUser }, id: string) => {
  const row = await providerService.getById(ctx, id);
  return !isError(row) && row !== null;
};

describe("sync.upload: a write is one transaction", () => {
  it("saves nothing of a refused write, answers writeRefused for its other ops, and goes on", async () => {
    const { group, recipient, theirs, owner } = await setup();
    const series = randomUUID();
    const visit = seriesVisitId(series, "2027-03-01");
    const next = randomUUID();
    const ops = [
      putOp("appointment_series", series, seriesRow(group.id, recipient.id), 1),
      putOp("timeline_entry", visit, visitRow(group.id, recipient.id, series, "2027-03-01"), 1),
      refusedPatch(theirs, 1),
      putOp("provider", next, providerRow(group.id, "Dr. Next"), 2),
    ];
    // What the PATCH answers alone.
    const [alone] = await upload(owner.api, [refusedPatch(theirs)]);
    expect(alone).toMatchObject({ status: "rejected" });
    const code = (alone as { code: string }).code;

    const results = await upload(owner.api, ops);

    expect(results).toEqual([
      { id: series, status: "rejected", code: "sync:writeRefused", refusedId: theirs },
      { id: visit, status: "rejected", code: "sync:writeRefused", refusedId: theirs },
      { id: theirs, status: "rejected", code },
      { id: next, status: "applied" },
    ]);
    expect(await appointmentSeriesService.getById(owner.ctx, series)).toBeNull();
    expect(await timelineEntryService.getById(owner.ctx, visit)).toBeNull();
    expect(await stored(owner.ctx, next)).toBe(true);
  });

  it("answers failed at a write's first op when its second throws, saves nothing, and stops", async () => {
    const { group, owner } = await setup();
    const ops = [
      putOp("provider", randomUUID(), providerRow(group.id, "Dr. First"), 1),
      putOp("provider", randomUUID(), providerRow(group.id, "Dr. Second"), 1),
      putOp("provider", randomUUID(), providerRow(group.id, "Dr. Third"), 2),
    ];
    const real = providerService.upsert.bind(providerService);
    vi.spyOn(providerService, "upsert").mockImplementation(async (...args) => {
      if (args[1].name !== "Dr. Second") return real(...args);
      await getDb().$client.query("SELECT 1 / 0");
      throw new Error("unreachable");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await upload(owner.api, ops)).toEqual([{ id: ops[0]!.id, status: "failed", code: "sync:failed" }]);
    for (const op of ops) expect(await stored(owner.ctx, op.id)).toBe(false);
  });

  it("keeps op-by-op results for ops with no write", async () => {
    const { group, theirs, owner } = await setup();
    const [a, b] = [randomUUID(), randomUUID()];
    const results = await upload(owner.api, [
      putOp("provider", a, providerRow(group.id, "Dr. Before")),
      refusedPatch(theirs),
      putOp("provider", b, providerRow(group.id, "Dr. After")),
    ]);
    expect(results.map((r) => r.status)).toEqual(["applied", "rejected", "applied"]);
    expect(results[1]).not.toHaveProperty("refusedId");
    expect(await stored(owner.ctx, a)).toBe(true);
    expect(await stored(owner.ctx, b)).toBe(true);
  });

  it("accepts one write past the batch limit, but not as many ops over two writes", async () => {
    const { group, owner } = await setup();
    const many = (write: (i: number) => number) =>
      Array.from({ length: 101 }, (_, i) =>
        putOp("provider", randomUUID(), providerRow(group.id, `Dr. Number ${i}`), write(i)),
      );

    const one = many(() => 7);
    const results = await upload(owner.api, one);
    expect(results).toHaveLength(101);
    expect(results.every((r) => r.status === "applied")).toBe(true);

    expect(await codeOf(owner.api.sync.upload({ ops: many((i) => (i < 100 ? 8 : 9)) }))).toBe("BAD_REQUEST");
  });

  it("retries a write that hits a deadlock once, and applies it", async () => {
    const { group, owner } = await setup();
    const [a, b] = [randomUUID(), randomUUID()];
    await upload(owner.api, [
      putOp("provider", a, providerRow(group.id, "Dr. A")),
      putOp("provider", b, providerRow(group.id, "Dr. B")),
    ]);
    const updates = vi.spyOn(providerService, "update");

    // A second connection holds b; the write takes a, then waits for b.
    const other = await getDb().$client.connect();
    try {
      await other.query("BEGIN");
      await other.query("SELECT 1 FROM provider WHERE id = $1 FOR UPDATE", [b]);
      const { rows } = await other.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const holder = rows[0]!.pid;

      const pending = upload(owner.api, [
        patchOp("provider", a, { name: "Dr. A Renamed" }, 1),
        patchOp("provider", b, { name: "Dr. B Renamed" }, 1),
      ]);
      await vi.waitFor(
        async () => {
          const blocked = await getDb().$client.query(
            "SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))",
            [holder],
          );
          expect(blocked.rowCount).toBeGreaterThan(0);
        },
        { timeout: 10_000, interval: 50 },
      );
      // Now wanting a closes the cycle: the write, waiting longest, is the one Postgres aborts.
      await other.query("SELECT 1 FROM provider WHERE id = $1 FOR UPDATE", [a]);
      await other.query("COMMIT");

      expect(await pending).toEqual([
        { id: a, status: "applied" },
        { id: b, status: "applied" },
      ]);
    } finally {
      await other.query("ROLLBACK").catch(() => undefined);
      other.release();
    }
    expect(ok(await providerService.getById(owner.ctx, a))).toMatchObject({ name: "Dr. A Renamed" });
    expect(ok(await providerService.getById(owner.ctx, b))).toMatchObject({ name: "Dr. B Renamed" });
    // a's update ran in the first try and again in the retry.
    expect(updates.mock.calls.filter((call) => call[1] === a)).toHaveLength(2);
  });

  it("compacts a live note only for an update whose write committed", async () => {
    const { group, recipient, theirs, owner } = await setup();
    const entryId = randomUUID();
    const ydoc = newYDoc();
    const edit = (text: string, write: number) =>
      putOp(
        "note_update",
        randomUUID(),
        { group_id: group.id, document_id: entryId, data: typeParagraph(ydoc, text) },
        write,
      );
    const made = await upload(owner.api, [
      putOp("timeline_entry", entryId, {
        group_id: group.id,
        recipient_id: recipient.id,
        kind: "note",
        occurred_at: AT,
        time_zone: LA,
        title: null,
        body: null,
        details: null,
        deleted_at: null,
      }),
      putOp("note_document", entryId, { group_id: group.id, subject: "entry", entry_id: entryId }),
    ]);
    expect(made.map((r) => r.status)).toEqual(["applied", "applied"]);
    const compactions = vi.spyOn(noteDocumentService, "compactIfDue");

    const refused = await upload(owner.api, [edit("Refused line", 3), refusedPatch(theirs, 3)]);
    expect(refused.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(compactions).not.toHaveBeenCalled();
    expect(await noteDocumentService.currentText(owner.ctx, entryId)).not.toContain("Refused line");

    const applied = await upload(owner.api, [edit("Saved line", 4)]);
    expect(applied.map((r) => r.status)).toEqual(["applied"]);
    expect(compactions).toHaveBeenCalledWith(entryId);
  });
});
