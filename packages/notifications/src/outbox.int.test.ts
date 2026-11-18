import {
  getDb,
  isError,
  newError,
  notificationOutboxSchema as outbox,
  withTransaction,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { handleOutboxCron } from "./cron";
import { MAX_ATTEMPTS, deliverDue, notify, purgeSent } from "./outbox";
import { createMemorySender } from "./senders";

const run = randomUUID().slice(0, 8);
let seq = 0;
const key = () => `test:${run}:${++seq}`;
const data = { name: "Avery", message: "Hello" };

const queue = async (opts: { to?: string } = {}) => {
  const queued = await notify("testMessage", {
    to: opts.to ?? `ob-${run}@example.com`,
    data,
    idempotencyKey: key(),
    deliver: false,
  });
  if (isError(queued)) throw new Error(String(queued.code));
  return queued.id;
};

const rowOf = async (id: string) => {
  const [row] = await getDb().select().from(outbox).where(eq(outbox.id, id));
  return row;
};

/** Make rows due now (as if their backoff had passed). */
const makeDue = (ids: string[]) =>
  getDb()
    .update(outbox)
    .set({ nextAttemptAt: sql`now() - interval '1 second'` })
    .where(inArray(outbox.id, ids));

// Other tests' rows mustn't be swept by these: park everything not ours.
afterEach(async () => {
  await getDb()
    .update(outbox)
    .set({ status: "failed" })
    .where(inArray(outbox.status, ["pending", "sending"]));
});

describe("notify", () => {
  it("writes nothing when the caller's transaction rolls back", async () => {
    const idempotencyKey = key();
    const res = await withTransaction(async (tx) => {
      const queued = await notify("testMessage", {
        to: "rollback@example.com",
        data,
        idempotencyKey,
        tx,
      });
      if (isError(queued)) return queued;
      // Visible inside the transaction…
      const [inside] = await tx.select().from(outbox).where(eq(outbox.idempotencyKey, idempotencyKey));
      expect(inside?.status).toBe("pending");
      // The caller's change fails: withTransaction rolls back.
      return newError({ code: "error" });
    });
    expect(res).toMatchObject({ code: "error" });
    // …and gone after the rollback.
    const rows = await getDb().select().from(outbox).where(eq(outbox.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(0);
  });

  it("commits with the caller's transaction, rendered", async () => {
    const idempotencyKey = key();
    const res = await withTransaction((tx) =>
      notify("testMessage", { to: "commit@example.com", data, idempotencyKey, tx }),
    );
    if (isError(res)) throw new Error(String(res.code));
    const row = await rowOf(res.id);
    expect(row).toMatchObject({ status: "pending", attempts: 0, recipient: "commit@example.com" });
    expect(row?.subject).toContain("Avery");
    expect(row?.text).toContain("Hello");
    expect(row?.html).toContain("http://localhost:5173/app");
  });

  it("queues one row per idempotency key", async () => {
    const idempotencyKey = key();
    const opts = { to: "once@example.com", data, idempotencyKey, deliver: false };
    const first = await notify("testMessage", opts);
    const second = await notify("testMessage", opts);
    if (isError(first) || isError(second)) throw new Error("notify failed");
    expect(second).toEqual({ id: first.id, created: false });
  });

  it("refuses bad data and a bad address without writing", async () => {
    const idempotencyKey = key();
    expect(
      await notify("testMessage", { to: "x@example.com", data: { name: "" } as never, idempotencyKey }),
    ).toMatchObject({ code: "notify:invalidData" });
    expect(await notify("testMessage", { to: "not-an-email", data, idempotencyKey })).toMatchObject({
      code: "notify:invalidData",
    });
    const rows = await getDb().select().from(outbox).where(eq(outbox.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(0);
  });
});

describe("deliverDue", () => {
  it("sends due rows, passes the idempotency key, and marks them sent", async () => {
    const id = await queue();
    const sender = createMemorySender();
    const summary = await deliverDue({ sender });
    expect(summary).toMatchObject({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    const row = await rowOf(id);
    expect(row).toMatchObject({ status: "sent", attempts: 1, lastError: null });
    expect(row?.sentAt).not.toBeNull();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({ to: row?.recipient, idempotencyKey: row?.idempotencyKey });
    expect(sender.sent[0]?.text).toBe(row?.text);
    // Sent rows aren't sent again.
    expect(await deliverDue({ sender })).toMatchObject({ claimed: 0 });
  });

  it("backs off after a failure, retries, and fails after the last attempt", async () => {
    const id = await queue();
    const failing = createMemorySender({ fail: () => true });

    const before = Date.now();
    expect(await deliverDue({ sender: failing })).toMatchObject({ claimed: 1, retried: 1 });
    let row = await rowOf(id);
    expect(row).toMatchObject({ status: "pending", attempts: 1 });
    expect(row?.lastError).toContain("failing on purpose");
    // Not due again for about a minute…
    expect(new Date(row?.nextAttemptAt ?? 0).getTime()).toBeGreaterThan(before + 50_000);
    expect(await deliverDue({ sender: failing })).toMatchObject({ claimed: 0 });

    // …then retried; the second wait is longer.
    await makeDue([id]);
    await deliverDue({ sender: failing });
    row = await rowOf(id);
    expect(row).toMatchObject({ status: "pending", attempts: 2 });
    expect(new Date(row?.nextAttemptAt ?? 0).getTime()).toBeGreaterThan(Date.now() + 110_000);

    // A retry that works marks it sent.
    await makeDue([id]);
    const working = createMemorySender();
    expect(await deliverDue({ sender: working })).toMatchObject({ sent: 1 });
    expect(await rowOf(id)).toMatchObject({ status: "sent", attempts: 3 });
    expect(working.sent).toHaveLength(1);

    // A row that keeps failing is marked failed after MAX_ATTEMPTS.
    const doomed = await queue();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await makeDue([doomed]);
      await deliverDue({ sender: failing });
    }
    expect(await rowOf(doomed)).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    await makeDue([doomed]);
    expect(await deliverDue({ sender: failing })).toMatchObject({ claimed: 0 });
  });

  it("never sends one row twice across concurrent sweeps", async () => {
    const ids = await Promise.all(Array.from({ length: 12 }, () => queue()));
    const sender = createMemorySender({ delayMs: 20 });
    const sweeps = await Promise.all([
      deliverDue({ sender }),
      deliverDue({ sender }),
      deliverDue({ sender }),
    ]);
    const claimed = sweeps.reduce((n, s) => n + (isError(s) ? 0 : s.claimed), 0);
    expect(claimed).toBe(12);
    const keys = sender.sent.map((m) => m.idempotencyKey);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    const rows = await getDb().select().from(outbox).where(inArray(outbox.id, ids));
    expect(rows.every((r) => r.status === "sent" && r.attempts === 1)).toBe(true);
  });

  it("takes back a row a crashed sweep left sending", async () => {
    const id = await queue();
    await getDb()
      .update(outbox)
      .set({ status: "sending", attempts: 1, claimedAt: sql`now() - interval '11 minutes'` })
      .where(eq(outbox.id, id));
    const sender = createMemorySender();
    expect(await deliverDue({ sender })).toMatchObject({ claimed: 1, sent: 1 });
    expect(await rowOf(id)).toMatchObject({ status: "sent", attempts: 2 });
  });
});

describe("purgeSent", () => {
  it("removes sent rows older than 30 days, and keeps newer and unsent ones", async () => {
    const [old, recent, pending] = [await queue(), await queue(), await queue()];
    await deliverDue({ ids: [old, recent], sender: createMemorySender() });
    await getDb()
      .update(outbox)
      .set({ sentAt: sql`now() - interval '31 days'` })
      .where(eq(outbox.id, old));
    await getDb()
      .update(outbox)
      .set({ createdAt: sql`now() - interval '40 days'` })
      .where(eq(outbox.id, pending));

    const purged = await purgeSent();
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await rowOf(old)).toBeUndefined();
    expect(await rowOf(recent)).toMatchObject({ status: "sent" });
    expect(await rowOf(pending)).toMatchObject({ status: "pending" });
  });
});

describe("/api/cron/outbox", () => {
  const secret = `cron-${run}`;
  const request = (authorization?: string) =>
    new Request("http://localhost/api/cron/outbox", {
      headers: authorization ? { authorization } : {},
    });

  it("refuses a missing or wrong secret without sending", async () => {
    const id = await queue();
    const sender = createMemorySender();
    expect((await handleOutboxCron(request(), { secret, sender })).status).toBe(401);
    expect((await handleOutboxCron(request("Bearer nope"), { secret, sender })).status).toBe(401);
    expect((await handleOutboxCron(request(secret), { secret, sender })).status).toBe(401);
    // No secret configured: everything is refused.
    expect((await handleOutboxCron(request(`Bearer ${secret}`), { secret: "", sender })).status).toBe(503);
    expect(sender.sent).toHaveLength(0);
    expect(await rowOf(id)).toMatchObject({ status: "pending" });
  });

  it("delivers due rows with the right secret", async () => {
    const id = await queue();
    const sender = createMemorySender();
    const res = await handleOutboxCron(request(`Bearer ${secret}`), { secret, sender });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    expect(await rowOf(id)).toMatchObject({ status: "sent" });
  });
});
