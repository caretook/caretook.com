import {
  contactMessageService,
  getDb,
  isError,
  MIN_FORM_MS,
  newError,
  SYSTEM_USER,
  waitlistService,
} from "@caretook/data";
import { DEV_SUPPORT_EMAIL, setBackgroundRunner, sharedMemorySender } from "@caretook/notifications";
import { createRouterClient, ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createUser } from "../../data/test/fixtures";
import { router } from ".";
import { PUBLIC_FORM_LIMIT, resetPublicFormLimits } from "./publicForms";
import { createRateLimiter } from "./rateLimit";

// The marketing site's public forms (marketing slice 4) through the router,
// as an anonymous visitor, with the memory sender.

const visitor = (clientIp = `203.0.113.${Math.floor(Math.random() * 250) + 1}`) =>
  createRouterClient(router, { context: { authUser: null, clientIp } });

const pending: Promise<unknown>[] = [];
beforeAll(() => setBackgroundRunner((work) => void pending.push(work)));
afterAll(() => setBackgroundRunner(null));
beforeEach(() => resetPublicFormLimits());

const mailTo = async (to: string) => {
  while (pending.length) await Promise.allSettled(pending.splice(0));
  return sharedMemorySender().sent.filter((m) => m.to === to);
};

const tag = () => `pf${randomUUID().slice(0, 8)}`;
const human = { elapsedMs: MIN_FORM_MS + 1000 };

const system = { authUser: SYSTEM_USER };
const rows = async <T>(result: Promise<{ data: T[] } | Error>) => {
  const value = await result;
  if (isError(value)) throw value;
  return (value as { data: T[] }).data;
};
const byEmail = (email: string) => ({
  filter: { email: { type: "eq" as const, value: email.toLowerCase() } },
});
const entriesFor = (email: string) => rows(waitlistService.list(system, byEmail(email)));
const messagesFrom = (email: string) => rows(contactMessageService.list(system, byEmail(email)));
/** Outbox rows by idempotency key, or whose text mentions `text`. */
const outboxWith = ({ key, text }: { key?: string; text?: string }) =>
  getDb().query.notificationOutboxSchema.findMany({
    where: (t, { eq, like }) => (key ? eq(t.idempotencyKey, key) : like(t.text, `%${text}%`)),
  });

const codeOf = async (call: Promise<unknown>) => {
  try {
    await call;
    return "ok";
  } catch (e) {
    if (e instanceof ORPCError) return String(e.code);
    throw e;
  }
};

describe("public.waitlist.join", () => {
  it("stores one entry with the email normalized, and thanks the visitor", async () => {
    const email = `${tag()}@example.com`;
    const answer = await visitor().public.waitlist.join({
      email: `  ${email.toUpperCase()} `,
      firstName: "Robin",
      caringFor: "parent",
      heardFrom: "A friend at church",
      source: { page: "/", utmSource: "newsletter", utmCampaign: "fall" },
      ...human,
    });
    expect(answer).toEqual({ ok: true });
    const rows = await entriesFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email,
      firstName: "Robin",
      caringFor: "parent",
      heardFrom: "A friend at church",
      source: { page: "/", utmSource: "newsletter", utmCampaign: "fall" },
    });
  });

  it("updates the entry on a repeat (any case), with the same answer, keeping what's left out", async () => {
    const email = `${tag()}@example.com`;
    const api = visitor();
    const first = await api.public.waitlist.join({
      email,
      firstName: "Robin",
      caringFor: "parent",
      ...human,
    });
    const again = await api.public.waitlist.join({
      email: email.toUpperCase(),
      heardFrom: "Search",
      caringFor: "spouse",
      ...human,
    });
    expect(again).toEqual(first);
    const rows = await entriesFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ firstName: "Robin", caringFor: "spouse", heardFrom: "Search" });
  });

  it("stores nothing for a filled honeypot or a too-fast submit, and thanks them all the same", async () => {
    const trapped = `${tag()}@example.com`;
    const fast = `${tag()}@example.com`;
    const untimed = `${tag()}@example.com`;
    const api = visitor();
    expect(
      await api.public.waitlist.join({ email: trapped, website: "https://spam.example", ...human }),
    ).toEqual({
      ok: true,
    });
    expect(await api.public.waitlist.join({ email: fast, elapsedMs: 200 })).toEqual({ ok: true });
    expect(await api.public.waitlist.join({ email: untimed })).toEqual({ ok: true });
    for (const email of [trapped, fast, untimed]) expect(await entriesFor(email)).toHaveLength(0);
  });

  it("refuses bad input with field issues", async () => {
    try {
      await visitor().public.waitlist.join({ email: "nope", caringFor: "cousin" as never, ...human });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ORPCError);
      expect((e as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
    }
  });

  it(`refuses the ${PUBLIC_FORM_LIMIT + 1}th call in a minute from one address, not from another`, async () => {
    const api = visitor("198.51.100.7");
    const base = tag();
    for (let i = 0; i < PUBLIC_FORM_LIMIT; i++) {
      expect(await codeOf(api.public.waitlist.join({ email: `${base}-${i}@example.com`, ...human }))).toBe(
        "ok",
      );
    }
    expect(await codeOf(api.public.waitlist.join({ email: `${base}-over@example.com`, ...human }))).toBe(
      "TOO_MANY_REQUESTS",
    );
    expect(await entriesFor(`${base}-over@example.com`)).toHaveLength(0);
    // Another address has its own count.
    expect(
      await codeOf(
        visitor("198.51.100.8").public.waitlist.join({ email: `${base}-b@example.com`, ...human }),
      ),
    ).toBe("ok");
    // The contact form keeps its own count.
    expect(
      await codeOf(
        api.public.contact.send({
          name: "R",
          email: `${base}@example.com`,
          topic: "other",
          message: "Hi",
          ...human,
        }),
      ),
    ).toBe("ok");
  });

  it("is staff-only to read: admins list entries, members and visitors get none", async () => {
    const email = `${tag()}@example.com`;
    await visitor().public.waitlist.join({ email, ...human });
    const admin = await createUser("pf-admin", "admin");
    const member = await createUser("pf-member");
    const filter = { email: { type: "eq" as const, value: email } };
    const seen = await waitlistService.list(admin.ctx, { filter });
    expect(!isError(seen) && seen.data.map((e) => e.email)).toEqual([email]);
    const hidden = await waitlistService.list(member.ctx, { filter });
    expect(isError(hidden) || hidden.data.length === 0).toBe(true);
    const anonymous = await waitlistService.list({ authUser: null }, { filter });
    expect(isError(anonymous) || anonymous.data.length === 0).toBe(true);
  });
});

describe("public.contact.send", () => {
  it("stores the message and queues its email to the support address in one go", async () => {
    const email = `${tag()}@example.com`;
    const answer = await visitor().public.contact.send({
      name: "Robin Example",
      email,
      topic: "question",
      message: "Can my brother use it on his phone?",
      ...human,
    });
    expect(answer).toEqual({ ok: true });
    const [row, ...more] = await messagesFrom(email);
    expect(more).toHaveLength(0);
    expect(row).toMatchObject({ name: "Robin Example", topic: "question" });
    const outbox = await outboxWith({ key: `contactMessage:${row!.id}` });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ name: "contactMessage", recipient: DEV_SUPPORT_EMAIL });
    expect(outbox[0]!.subject).not.toContain("[Privacy]");
    const sent = (await mailTo(DEV_SUPPORT_EMAIL)).filter((m) => m.text.includes(email));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain("Can my brother use it on his phone?");
  });

  it("flags a privacy topic in the subject", async () => {
    const email = `${tag()}@example.com`;
    await visitor().public.contact.send({
      name: "Robin",
      email,
      topic: "privacy",
      message: "Please delete my data.",
      ...human,
    });
    const [row] = await messagesFrom(email);
    const [mail] = await outboxWith({ key: `contactMessage:${row!.id}` });
    expect(mail!.subject).toMatch(/^\[Privacy\] /);
  });

  it("stores and sends nothing for a honeypot or a too-fast submit", async () => {
    const email = `${tag()}@example.com`;
    const api = visitor();
    const message = { name: "Bot", email, topic: "other" as const, message: "Buy now" };
    expect(await api.public.contact.send({ ...message, website: "x", ...human })).toEqual({ ok: true });
    expect(await api.public.contact.send({ ...message, elapsedMs: 10 })).toEqual({ ok: true });
    expect(await messagesFrom(email)).toHaveLength(0);
    const outbox = await outboxWith({ text: email });
    expect(outbox).toHaveLength(0);
  });

  it("keeps no message when its email can't be queued (one transaction)", async () => {
    const email = `${tag()}@example.com`;
    const result = await contactMessageService.send(
      { name: "Robin", email, topic: "help", message: "Hello", ...human },
      { mail: () => Promise.resolve(newError({ code: "notify:enqueue" })) },
    );
    expect(isError(result)).toBe(true);
    expect(await messagesFrom(email)).toHaveLength(0);
  });

  it("refuses an over-long message", async () => {
    const code = await codeOf(
      visitor().public.contact.send({
        name: "Robin",
        email: `${tag()}@example.com`,
        topic: "help",
        message: "x".repeat(5001),
        ...human,
      }),
    );
    expect(code).toBe("BAD_REQUEST");
  });
});

describe("createRateLimiter", () => {
  it("allows `limit` hits per window per key, sliding", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(await limiter.hit("a", 0)).toBe(true);
    expect(await limiter.hit("a", 100)).toBe(true);
    expect(await limiter.hit("a", 200)).toBe(false);
    expect(await limiter.hit("b", 200)).toBe(true);
    // The first hit leaves the window; refused hits weren't counted.
    expect(await limiter.hit("a", 1001)).toBe(true);
    expect(await limiter.hit("a", 1050)).toBe(false);
    await limiter.reset();
    expect(await limiter.hit("a", 1050)).toBe(true);
  });
});
