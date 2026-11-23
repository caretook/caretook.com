import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_SUPPORT_EMAIL, getMailConfig, getSupportEmail, isCheckBuild, parseAllowlist } from "./config";
import { contactSubject, PRIVACY_SUBJECT_FLAG } from "./templates/contactMessage";
import { extractLinks } from "./devMail";
import { linkBuilder } from "./links";
import { inBackground, retryDelayMs, setBackgroundRunner } from "./outbox";
import { NOTIFICATIONS } from "./registry";
import { renderNotification } from "./render";
import { createMemorySender, isAllowlisted, withAllowlist } from "./senders";

const APP_URL = "https://app.example.test";
const ctx = { recipient: "someone@example.com", appUrl: APP_URL };

// Valid data for every notification. A new notification adds its sample
// here, so every template is rendered by the tests below.
const SAMPLES: { [N in keyof typeof NOTIFICATIONS]: Parameters<typeof renderNotification<N>>[1] } = {
  testMessage: { name: "Avery", message: "Hello from the dev mailbox", path: "/app/settings" },
  verifyEmail: { name: "Avery", token: "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImEifQ.sig-_x" },
  resetPassword: { name: "Avery", token: "resetToken123" },
  groupInvite: {
    groupName: "Grandma Example",
    inviterName: "Avery",
    role: "caretaker",
    token: "inviteTok_123-x",
  },
  joinRequested: {
    groupId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001",
    groupName: "Grandma Example",
    requesterName: "Robin",
    requesterEmail: "robin@example.com",
    role: "viewer",
  },
  joinApproved: {
    name: "Robin",
    groupId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001",
    groupName: "Grandma Example",
    role: "viewer",
  },
  joinDeclined: { name: "Robin", groupName: "Grandma Example" },
  ownerInvite: { groupName: "Grandpa Example", token: "ownerTok_456-y" },
  contactMessage: {
    messageId: "6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7",
    name: "Robin Example",
    email: "robin@example.com",
    topic: "question",
    message: "Can my brother use it on his phone?\nThanks!",
  },
  accessCodeExistingAccount: {},
  signInEmail: { token: "magicTokenABC", code: "135790", next: "/app/groups/x/timeline" },
  appointmentReminder: {
    summary: "Appointment for Pat",
    when: "Thu, Nov 19 · 9:00–10:00 AM PST",
    recipientName: "Pat",
    itemPath: "/app/groups/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001/entries/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0002",
    unsubscribePath: "/api/reminders/unsubscribe/tok.en.sig",
  },
  todoDue: {
    summary: "Todo for Pat",
    when: "Thu, Nov 19 · 9:00 AM PST",
    recipientName: "Pat",
    itemPath: "/app/groups/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001/todos/0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0003",
    unsubscribePath: "/api/reminders/unsubscribe/tok.en.sig",
  },
  assistantsRequested: {
    groupId: "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001",
    groupName: "Grandma Example",
    memberName: "Robin",
  },
};

// Notifications whose email carries no link.
const LINKLESS = new Set<keyof typeof NOTIFICATIONS>(["contactMessage"]);

describe("the registry", () => {
  it("has a sample for every notification, keyed by its own name", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(NOTIFICATIONS).sort());
    for (const [key, definition] of Object.entries(NOTIFICATIONS)) expect(definition.name).toBe(key);
  });

  it.each(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[])(
    "%s renders a subject, HTML and non-empty plain text",
    async (name) => {
      const out = await renderNotification(name, SAMPLES[name], ctx);
      if ("code" in out) throw new Error(String(out.code));
      expect(out.subject.length).toBeGreaterThan(0);
      expect(out.html).toContain("<html");
      expect(out.text.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[])(
    "%s builds every link on APP_URL",
    async (name) => {
      const out = await renderNotification(name, SAMPLES[name], ctx);
      if ("code" in out) throw new Error(String(out.code));
      const links = extractLinks(out.html);
      if (!LINKLESS.has(name)) expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(link.startsWith(`${APP_URL}/`)).toBe(true);
      // The plain text carries the same links.
      for (const link of links) expect(out.text).toContain(link);
    },
  );

  it("puts each account email's secret where the reader needs it", async () => {
    const render = async <N extends keyof typeof SAMPLES>(name: N) => {
      const out = await renderNotification(name, SAMPLES[name], ctx);
      if ("code" in out) throw new Error(String(out.code));
      return out;
    };
    const verify = await render("verifyEmail");
    expect(extractLinks(verify.html)).toEqual([`${APP_URL}/verify-email?token=${SAMPLES.verifyEmail.token}`]);
    expect(extractLinks((await render("resetPassword")).html)).toEqual([
      `${APP_URL}/reset-password?token=resetToken123`,
    ]);
    const signIn = await render("signInEmail");
    const [magic] = extractLinks(signIn.html);
    const url = new URL(magic ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(`${APP_URL}/api/auth/magic-link/verify`);
    expect(url.searchParams.get("token")).toBe("magicTokenABC");
    expect(url.searchParams.get("callbackURL")).toBe("/app/groups/x/timeline");
    expect(url.searchParams.get("errorCallbackURL")).toBe("/sign-in?with=email&expired=1");
    // One email, both ways in: the link and the code, in HTML and plain text.
    expect(signIn.html).toContain("135790");
    expect(signIn.text).toContain("135790");
    expect(signIn.subject).not.toContain("135790");
    const existing = await render("accessCodeExistingAccount");
    expect(extractLinks(existing.html)).toEqual([`${APP_URL}/sign-in?redirectTo=%2Fapp%2Fgroups%2Fnew`]);
  });

  it("refuses a sign-in code that isn't six digits, and a token with odd characters", async () => {
    expect(await renderNotification("signInEmail", { token: "t", code: "12345" }, ctx)).toMatchObject({
      code: "notify:invalidData",
    });
    expect(await renderNotification("resetPassword", { token: 'x" onclick="y' }, ctx)).toMatchObject({
      code: "notify:invalidData",
    });
    expect(
      await renderNotification("signInEmail", { token: "t", code: "123456", next: "//evil.example" }, ctx),
    ).toMatchObject({
      code: "notify:invalidData",
    });
  });

  it("refuses bad data before rendering", async () => {
    const out = await renderNotification("testMessage", { name: "", message: 42 } as never, ctx);
    expect(out).toMatchObject({ code: "notify:invalidData" });
    const issues = (out as { meta?: { issues?: { path: string }[] } }).meta?.issues ?? [];
    expect(issues.map((i) => i.path).sort()).toEqual(["message", "name"]);
  });

  it("refuses a link that leaves the app", async () => {
    const out = await renderNotification(
      "testMessage",
      { name: "A", message: "B", path: "//evil.example" },
      ctx,
    );
    expect(out).toMatchObject({ code: "notify:invalidData" });
  });
});

describe("linkBuilder", () => {
  const link = linkBuilder("http://localhost:6873");
  it("builds absolute links on APP_URL with query params", () => {
    expect(link("/invite/abc", { a: "1 2" })).toBe("http://localhost:6873/invite/abc?a=1+2");
  });
  it("refuses anything but an app path", () => {
    expect(() => link("https://evil.example/x")).toThrow();
    expect(() => link("//evil.example/x")).toThrow();
  });
});

describe("the allowlist", () => {
  const message = {
    name: "testMessage",
    from: "f@example.com",
    subject: "s",
    html: "<p>h</p>",
    text: "t",
    idempotencyKey: "k",
  };

  it("matches addresses and @domains, ignoring case and spaces", () => {
    const list = parseAllowlist(" Dev@Example.com , @team.example ");
    expect(isAllowlisted("dev@example.com", list)).toBe(true);
    expect(isAllowlisted(" DEV@example.COM ", list)).toBe(true);
    expect(isAllowlisted("anyone@team.example", list)).toBe(true);
    expect(isAllowlisted("other@example.com", list)).toBe(false);
    expect(isAllowlisted("x@evilteam.example", list)).toBe(false);
  });

  it("doesn't send to an address off the list", async () => {
    const inner = createMemorySender();
    const sender = withAllowlist(inner, ["dev@example.com"]);
    expect(await sender.send({ ...message, to: "stranger@example.com" })).toMatchObject({
      status: "skipped",
    });
    expect(inner.sent).toHaveLength(0);
    expect(await sender.send({ ...message, to: "dev@example.com" })).toMatchObject({ status: "sent" });
    expect(inner.sent.map((m) => m.to)).toEqual(["dev@example.com"]);
  });
});

describe("getMailConfig", () => {
  it("defaults to log in dev and memory in tests", () => {
    expect(getMailConfig({ NODE_ENV: "development" }).sender).toBe("log");
    expect(getMailConfig({ NODE_ENV: "test" }).sender).toBe("memory");
  });

  it("refuses production without a Resend key, or with a dev sender", () => {
    expect(() => getMailConfig({ NODE_ENV: "production", APP_URL })).toThrow(/RESEND_API_KEY/);
    expect(() =>
      getMailConfig({ NODE_ENV: "production", APP_URL, MAIL_SENDER: "log", RESEND_API_KEY: "re_x" }),
    ).toThrow(/not allowed/);
    expect(getMailConfig({ NODE_ENV: "production", APP_URL, RESEND_API_KEY: "re_x" }).sender).toBe("resend");
  });

  it("lets a check build on this machine use the dev mailbox in production", () => {
    const check = { NODE_ENV: "production", VITE_CHECK_BUILD: "1" } as const;
    expect(isCheckBuild({ ...check, APP_URL: "http://localhost:6673" })).toBe(true);
    expect(isCheckBuild({ ...check, APP_URL: "http://127.0.0.1:6673/" })).toBe(true);
    expect(getMailConfig({ ...check, APP_URL: "http://localhost:6673" }).sender).toBe("log");
    expect(getMailConfig({ ...check, APP_URL: "http://127.0.0.1:6673", MAIL_SENDER: "log" }).sender).toBe(
      "log",
    );
    // Never memory, even in a check build.
    expect(() =>
      getMailConfig({ ...check, APP_URL: "http://localhost:6673", MAIL_SENDER: "memory" }),
    ).toThrow(/not allowed/);
  });

  it("refuses a check build with a public APP_URL, and production without the flag", () => {
    const publicUrl = {
      NODE_ENV: "production",
      VITE_CHECK_BUILD: "1",
      APP_URL: "https://caretook.com",
    } as const;
    expect(isCheckBuild(publicUrl)).toBe(false);
    expect(() => getMailConfig(publicUrl)).toThrow(/RESEND_API_KEY/);
    expect(() => getMailConfig({ ...publicUrl, MAIL_SENDER: "log", RESEND_API_KEY: "re_x" })).toThrow(
      /not allowed/,
    );
    expect(isCheckBuild({ NODE_ENV: "production", APP_URL: "http://localhost:6673" })).toBe(false);
    expect(() =>
      getMailConfig({ NODE_ENV: "production", APP_URL: "http://localhost:6673", MAIL_SENDER: "log" }),
    ).toThrow(/not allowed/);
    expect(isCheckBuild({ NODE_ENV: "production", VITE_CHECK_BUILD: "1" })).toBe(false);
    expect(
      isCheckBuild({ NODE_ENV: "production", VITE_CHECK_BUILD: "1", APP_URL: "http://localhost.evil.com" }),
    ).toBe(false);
  });

  it("allowlists outside production and on staging, which runs as production (hosting slice 1)", () => {
    const resend = { NODE_ENV: "production", APP_URL, RESEND_API_KEY: "re_x" } as const;
    expect(getMailConfig(resend).allowlisted).toBe(false);
    expect(getMailConfig({ ...resend, APP_ENV: "production" }).allowlisted).toBe(false);
    expect(getMailConfig({ ...resend, APP_ENV: "staging" }).allowlisted).toBe(true);
    expect(getMailConfig({ NODE_ENV: "development" }).allowlisted).toBe(true);
    expect(getMailConfig({ NODE_ENV: "test" }).allowlisted).toBe(true);
  });

  it("trims a trailing slash from APP_URL", () => {
    expect(getMailConfig({ NODE_ENV: "test", APP_URL: "http://localhost:6873/" }).appUrl).toBe(
      "http://localhost:6873",
    );
  });
});

describe("setBackgroundRunner", () => {
  afterEach(() => {
    setBackgroundRunner(null);
    vi.restoreAllMocks();
  });

  // Vercel's waitUntil (hosting slice 1) gets each piece of work, already caught.
  it("hands the runner work that never rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: Promise<unknown>[] = [];
    setBackgroundRunner((work) => void seen.push(work));
    inBackground(() => Promise.reject(new Error("fictional failure")));
    inBackground(() => Promise.resolve("sent"));
    expect(seen).toHaveLength(2);
    await expect(seen[0]).resolves.toBeUndefined();
    await expect(seen[1]).resolves.toBe("sent");
  });
});

describe("retryDelayMs", () => {
  it("doubles from a minute and caps at six hours", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60_000);
  });
});

describe("groupInvite", () => {
  it("names the group and the inviter, and links to the invite on APP_URL", async () => {
    const out = await renderNotification("groupInvite", SAMPLES.groupInvite, ctx);
    if ("code" in out) throw new Error(String(out.code));
    expect(out.subject).toBe("Avery invited you to Grandma Example's care group on Caretook");
    expect(out.text).toContain("as a caretaker");
    expect(extractLinks(out.html)).toEqual([`${APP_URL}/invite/inviteTok_123-x`]);
  });

  it("never carries health details, even when handed some", async () => {
    const sentinel = "SENTINEL-HEALTH-9431";
    const out = await renderNotification(
      "groupInvite",
      {
        ...SAMPLES.groupInvite,
        // Fields a careless caller might pass: the template has no place for them.
        ...({ symptom: sentinel, note: sentinel, vitals: sentinel, dateOfBirth: sentinel } as object),
      },
      ctx,
    );
    if ("code" in out) throw new Error(String(out.code));
    expect(`${out.subject}${out.html}${out.text}`).not.toContain(sentinel);
  });

  it("falls back to 'Someone' without an inviter's name", async () => {
    const { inviterName: _omit, ...data } = SAMPLES.groupInvite;
    const out = await renderNotification("groupInvite", data, ctx);
    if ("code" in out) throw new Error(String(out.code));
    expect(out.subject.startsWith("Someone invited you")).toBe(true);
  });
});

describe("join request emails", () => {
  it("link to the group's Members page, the group and the app", async () => {
    const linksOf = async <N extends "joinRequested" | "joinApproved" | "joinDeclined">(name: N) => {
      const out = await renderNotification(name, SAMPLES[name], ctx);
      if ("code" in out) throw new Error(String(out.code));
      return { links: extractLinks(out.html), out };
    };
    const groupId = SAMPLES.joinRequested.groupId;
    const asked = await linksOf("joinRequested");
    expect(asked.links).toEqual([`${APP_URL}/app/groups/${groupId}/settings/members`]);
    expect(asked.out.subject).toBe("Robin asked to join Grandma Example's care group");
    expect(asked.out.text).toContain("robin@example.com");
    expect((await linksOf("joinApproved")).links).toEqual([`${APP_URL}/app/groups/${groupId}`]);
    expect((await linksOf("joinDeclined")).links).toEqual([`${APP_URL}/app`]);
  });

  it("refuses a role a link can't grant", async () => {
    const out = await renderNotification(
      "joinRequested",
      { ...SAMPLES.joinRequested, role: "admin" as never },
      ctx,
    );
    expect("code" in out && out.code).toBe("notify:invalidData");
  });
});

describe("assistantsRequested", () => {
  it("names the member and the group, and links to the group's Assistants page", async () => {
    const out = await renderNotification("assistantsRequested", SAMPLES.assistantsRequested, ctx);
    if ("code" in out) throw new Error(String(out.code));
    expect(out.subject).toBe("Robin asked to turn on assistants for Grandma Example's care group");
    expect(out.text).toContain("Robin would like to connect their own AI assistant");
    expect(extractLinks(out.html)).toEqual([
      `${APP_URL}/app/groups/${SAMPLES.assistantsRequested.groupId}/settings/assistants`,
    ]);
  });

  it("never carries health details, even when handed some", async () => {
    const sentinel = "SENTINEL-HEALTH-5520";
    const out = await renderNotification(
      "assistantsRequested",
      { ...SAMPLES.assistantsRequested, ...({ symptom: sentinel, note: sentinel } as object) },
      ctx,
    );
    if ("code" in out) throw new Error(String(out.code));
    expect(`${out.subject}${out.html}${out.text}`).not.toContain(sentinel);
  });
});

describe("contact messages", () => {
  it("flag privacy topics in the subject, and only those", () => {
    expect(contactSubject({ name: "Robin", topic: "privacy" })).toMatch(/^\[Privacy\] /);
    for (const topic of ["question", "help", "other"] as const)
      expect(contactSubject({ name: "Robin", topic })).not.toContain(PRIVACY_SUBJECT_FLAG);
  });

  it("carry the visitor's address and message in the body", async () => {
    const out = await renderNotification("contactMessage", SAMPLES.contactMessage, ctx);
    if ("code" in out) throw new Error(String(out.code));
    expect(out.text).toContain("robin@example.com");
    expect(out.text).toContain("Can my brother use it on his phone?");
  });

  it("go to SUPPORT_EMAIL, with a fictional default outside production", () => {
    expect(getSupportEmail({ SUPPORT_EMAIL: " help@caretook.test " })).toBe("help@caretook.test");
    expect(getSupportEmail({ NODE_ENV: "development" })).toBe(DEV_SUPPORT_EMAIL);
    expect(() => getSupportEmail({ NODE_ENV: "production" })).toThrow(/SUPPORT_EMAIL/);
  });
});
