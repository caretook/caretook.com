import { emailSuppressionService, getDb, isError, notificationOutboxSchema as outbox } from "@caretook/data";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { deliverDue, notify } from "./outbox";
import { createMemorySender } from "./senders";

// notify to a suppressed address (hosting slice 4): every notification is
// skipped (`suppressed`) except sign-in and account mail, which always goes.

const run = randomUUID().slice(0, 8);
let seq = 0;
const key = () => `sup:${run}:${++seq}`;

const rowOf = async (id: string) => (await getDb().select().from(outbox).where(eq(outbox.id, id)))[0];

const ids = (queued: Awaited<ReturnType<typeof notify>>) => {
  if (isError(queued)) throw new Error(String(queued.code));
  return queued.id;
};

afterEach(async () => {
  await getDb()
    .update(outbox)
    .set({ status: "failed" })
    .where(inArray(outbox.status, ["pending", "sending"]));
});

describe("notify to a suppressed address", () => {
  it("skips a group invite and still sends a sign-in email", async () => {
    const to = `suppressed-${run}@example.com`;
    const suppressed = await emailSuppressionService.suppress(to, "bounce", `msg_${run}_suppress`);
    expect(isError(suppressed)).toBe(false);

    const invite = ids(
      await notify("groupInvite", {
        // Compared case-insensitively.
        to: to.toUpperCase(),
        data: { groupName: "Avery", role: "caretaker", token: "invite-token" },
        idempotencyKey: key(),
        deliver: false,
      }),
    );
    const signIn = ids(
      await notify("signInEmail", {
        to,
        data: { token: "sign-in-token", code: "123456" },
        idempotencyKey: key(),
        deliver: false,
      }),
    );
    const other = ids(
      await notify("groupInvite", {
        to: `fine-${run}@example.com`,
        data: { groupName: "Avery", role: "viewer", token: "invite-token-2" },
        idempotencyKey: key(),
        deliver: false,
      }),
    );

    const sender = createMemorySender();
    const summary = await deliverDue({ ids: [invite, signIn, other], sender });
    expect(summary).toMatchObject({ claimed: 3, sent: 2, skipped: 1 });
    expect(sender.sent.map((m) => [m.name, m.to])).toEqual(
      expect.arrayContaining([
        ["signInEmail", to],
        ["groupInvite", `fine-${run}@example.com`],
      ]),
    );
    expect(await rowOf(invite)).toMatchObject({ status: "skipped", lastError: "suppressed" });
    expect(await rowOf(signIn)).toMatchObject({ status: "sent" });
  });
});
