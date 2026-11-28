import { SYNC_WRITE_LIMIT } from "@caretook/data/domain";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { fx, series, TEST_GROUP } from "../../../test/fixtures";
import { fixClock } from "../../../test/found";
import { laTime, NOW } from "../../routes/app/groups/planner/plannerWorld";
import { applySeriesEdit } from "../appointments/series.sync";

// One save, one local transaction (sync-safety-3 slice 4, B-294): a save
// that writes several rows queues them in one PowerSync transaction, so the
// uploader can send it whole. The largest device write is a series split
// ("This and later") that turns a monthly series daily over the full window:
// every new visit with its document and provider links. Its op count is
// pinned here, under the write limit the server takes for one write. The
// clock: Wed 2026-11-18, 10:00 AM in Los Angeles.

const PROVIDERS = [
  fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fd101", name: "Dr. Mira Lark" }),
  fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fd102", name: "Dr. Tomas Reyes" }),
  fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fd103", name: "Dr. Ana Kim" }),
];
const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

/** Infusion on the 19th of each month, 6:00 for 4 h, since 19 Oct, with three providers. */
const INFUSION = series({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fd201",
  title: "Infusion",
  rule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=19",
  startsOn: "2026-10-19",
  providerIds: JSON.stringify(PROVIDER_IDS),
});
/** A visit `days` from today, with notes and its providers' links. */
const visit = (n: number, days: number, day: string) => {
  const entry = fx.event({
    id: `7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fd3${String(n).padStart(2, "0")}`,
    title: "Infusion",
    occurredAt: laTime(days, 6),
    endsAt: laTime(days, 10),
    seriesId: INFUSION.id,
    seriesDay: day,
    text: "Bring the pump log",
  });
  return [entry, ...PROVIDER_IDS.map((p) => fx.link(entry.id, p))];
};
const VISITS = [visit(1, 1, "2026-11-19"), visit(2, 31, "2026-12-19"), visit(3, 62, "2027-01-19")];
const NOV_19 = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2fd301";

/**
 * The ops the split queues: the new series, the old one's PATCH (it ends on
 * 18 Nov), the three visits moved in place, and 87 new visits (19 Nov to
 * 16 Feb, less those three), each an entry, its document and three links.
 */
const SPLIT_OPS = 2 + 3 + 87 * (1 + 1 + 3);

const device = () =>
  renderWithDevice({
    element: <p>Device</p>,
    url: `/app/groups/${TEST_GROUP.id}/planner`,
    fixtures: [PROVIDERS, INFUSION, VISITS],
  });
type Db = Awaited<ReturnType<typeof device>>["db"];

/** The queued uploads as "OP table", each with its local transaction. */
const queued = (db: Db) =>
  db.powersync
    .getAll<{ tx_id: number; data: string }>("SELECT tx_id, data FROM ps_crud ORDER BY id")
    .then((rows) =>
      rows.map((r) => {
        const op = JSON.parse(r.data) as { op: string; type: string };
        return { tx: r.tx_id, op: `${op.op} ${op.type}` };
      }),
    );

const count = (ops: { op: string }[], op: string) => ops.filter((o) => o.op === op).length;

beforeEach(() => fixClock(NOW));
afterEach(() => vi.useRealTimers());

describe("the series split, the largest device write", () => {
  test("a monthly series made daily from tomorrow queues one transaction, its ops under the write limit", async () => {
    const { db } = await device();
    const res = await applySeriesEdit(db, {
      visitId: NOV_19,
      scope: "later",
      change: { action: "edit", rule: "FREQ=DAILY;INTERVAL=1", startTime: "08:00" },
      now: NOW,
    });
    if (!res.ok) throw new Error(res.error);

    const ops = await queued(db);
    expect(new Set(ops.map((o) => o.tx)).size).toBe(1);
    expect(count(ops, "PUT appointment_series")).toBe(1);
    expect(count(ops, "PATCH appointment_series")).toBe(1);
    expect(count(ops, "PATCH timeline_entry")).toBe(3);
    expect(count(ops, "PUT timeline_entry")).toBe(87);
    expect(count(ops, "PUT note_document")).toBe(87);
    expect(count(ops, "PUT timeline_entry_provider")).toBe(87 * 3);
    expect(ops).toHaveLength(SPLIT_OPS);
    expect(SPLIT_OPS).toBeLessThanOrEqual(SYNC_WRITE_LIMIT);
  });
});
