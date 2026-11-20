import {
  emailSuppressionSchema,
  emailSuppressionService,
  getDb,
  isError,
  notificationOutboxSchema as outbox,
} from "@caretook/data";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { notify } from "./outbox";
import { handleResendWebhook } from "./resendWebhook";
import { signWebhook } from "./webhookSignature";

// Resend's webhook end to end (hosting slice 4): a signed request in, the
// outbox row and the suppression out.

const SECRET = `whsec_${Buffer.from(`test-webhook-secret-${randomUUID()}`).toString("base64")}`;
const run = randomUUID().slice(0, 8);
let seq = 0;
const address = () => `wh-${run}-${++seq}@example.com`;

/** A sent outbox row to `to`, with Resend's message id. */
const sentRow = async (to: string) => {
  const queued = await notify("testMessage", {
    to,
    data: { name: "Avery", message: "Hello" },
    idempotencyKey: `wh:${run}:${++seq}`,
    deliver: false,
  });
  if (isError(queued)) throw new Error(String(queued.code));
  const emailId = randomUUID();
  await getDb()
    .update(outbox)
    .set({ status: "sent", providerMessageId: emailId, sentAt: new Date().toISOString() })
    .where(eq(outbox.id, queued.id));
  return { id: queued.id, emailId };
};

const statusOf = async (id: string) =>
  (await getDb().select({ status: outbox.status }).from(outbox).where(eq(outbox.id, id)))[0]?.status;

const suppressionsOf = (to: string) =>
  getDb().select().from(emailSuppressionSchema).where(eq(emailSuppressionSchema.address, to));

const bounce = (to: string, emailId: string, type = "Permanent") => ({
  type: "email.bounced",
  created_at: new Date().toISOString(),
  data: {
    email_id: emailId,
    from: "Caretook <no-reply@mail.caretook.com>",
    to: [to],
    subject: "Hello",
    bounce: { type, subType: "General", message: "The mailbox doesn't exist." },
  },
});

const post = (event: unknown, opts: { id?: string; sign?: boolean; secret?: string } = {}) => {
  const body = JSON.stringify(event);
  const id = opts.id ?? `msg_${randomUUID()}`;
  const signed =
    opts.sign === false
      ? {}
      : signWebhook({ id, body, secret: opts.secret ?? SECRET, timestamp: Math.floor(Date.now() / 1000) });
  return handleResendWebhook(
    new Request("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers: { "content-type": "application/json", ...signed },
      body,
    }),
    { secret: SECRET },
  );
};

// Other tests' rows mustn't be swept: park what's pending.
afterEach(async () => {
  await getDb()
    .update(outbox)
    .set({ status: "failed" })
    .where(inArray(outbox.status, ["pending", "sending"]));
});

describe("/api/webhooks/resend", () => {
  it("a signed hard bounce suppresses the address and marks its outbox row", async () => {
    const to = address();
    const row = await sentRow(to);
    const res = await post(bounce(to, row.emailId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: true });
    expect(await statusOf(row.id)).toBe("bounced");
    const rows = await suppressionsOf(to);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: "bounce", clearedAt: null });
  });

  it("the same Svix id twice changes nothing", async () => {
    const to = address();
    const row = await sentRow(to);
    const id = `msg_${randomUUID()}`;
    expect((await post(bounce(to, row.emailId), { id })).status).toBe(200);
    const [first] = await suppressionsOf(to);

    // Staff clear it; the replayed event must not suppress it again.
    await getDb()
      .update(emailSuppressionSchema)
      .set({ clearedAt: new Date().toISOString() })
      .where(eq(emailSuppressionSchema.address, to));
    await getDb().update(outbox).set({ status: "sent" }).where(eq(outbox.id, row.id));

    const again = await post(bounce(to, row.emailId), { id });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, applied: false });
    expect(await statusOf(row.id)).toBe("sent");
    const rows = await suppressionsOf(to);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(first?.id);
    expect(await emailSuppressionService.isSuppressed(to)).toBe(false);
  });

  it("a soft bounce changes nothing", async () => {
    const to = address();
    const row = await sentRow(to);
    const res = await post(bounce(to, row.emailId, "Transient"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: false });
    expect(await statusOf(row.id)).toBe("sent");
    expect(await suppressionsOf(to)).toHaveLength(0);
  });

  it("a complaint suppresses", async () => {
    const to = address();
    const row = await sentRow(to);
    const res = await post({
      type: "email.complained",
      created_at: new Date().toISOString(),
      data: { email_id: row.emailId, to: [to], subject: "Hello" },
    });
    expect(res.status).toBe(200);
    expect(await statusOf(row.id)).toBe("complained");
    expect((await suppressionsOf(to))[0]).toMatchObject({ reason: "complaint" });
  });

  it("other events are a 200 and nothing else", async () => {
    const to = address();
    const row = await sentRow(to);
    const res = await post({ type: "email.delivered", data: { email_id: row.emailId, to: [to] } });
    expect(res.status).toBe(200);
    expect(await statusOf(row.id)).toBe("sent");
    expect(await suppressionsOf(to)).toHaveLength(0);
  });

  it("an unsigned or wrongly signed request is a 401", async () => {
    const to = address();
    const row = await sentRow(to);
    expect((await post(bounce(to, row.emailId), { sign: false })).status).toBe(401);
    const otherSecret = `whsec_${Buffer.from("someone else's secret").toString("base64")}`;
    expect((await post(bounce(to, row.emailId), { secret: otherSecret })).status).toBe(401);
    expect(await statusOf(row.id)).toBe("sent");
    expect(await suppressionsOf(to)).toHaveLength(0);
  });

  it("refuses everything without a secret, and anything but POST", async () => {
    const request = new Request("http://localhost/api/webhooks/resend", { method: "POST", body: "{}" });
    expect((await handleResendWebhook(request, { secret: "" })).status).toBe(503);
    const get = new Request("http://localhost/api/webhooks/resend");
    expect((await handleResendWebhook(get, { secret: SECRET })).status).toBe(405);
  });
});
