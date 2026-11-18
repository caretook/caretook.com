import { describe, expect, it } from "vitest";
import { getMailConfig, parseAllowlist } from "./config";
import { extractLinks } from "./devMail";
import { linkBuilder } from "./links";
import { retryDelayMs } from "./outbox";
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
  magicLink: { token: "magicTokenABC", next: "/app/groups/x/timeline" },
  signInCode: { code: "135790" },
};

// Notifications whose email carries no link (a code to type in).
const LINKLESS = new Set<keyof typeof NOTIFICATIONS>(["signInCode"]);

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
    const [magic] = extractLinks((await render("magicLink")).html);
    const url = new URL(magic ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(`${APP_URL}/api/auth/magic-link/verify`);
    expect(url.searchParams.get("token")).toBe("magicTokenABC");
    expect(url.searchParams.get("callbackURL")).toBe("/app/groups/x/timeline");
    const code = await render("signInCode");
    expect(code.text).toContain("135790");
    expect(code.subject).not.toContain("135790");
  });

  it("refuses a sign-in code that isn't six digits, and a token with odd characters", async () => {
    expect(await renderNotification("signInCode", { code: "12345" }, ctx)).toMatchObject({
      code: "notify:invalidData",
    });
    expect(await renderNotification("resetPassword", { token: 'x" onclick="y' }, ctx)).toMatchObject({
      code: "notify:invalidData",
    });
    expect(await renderNotification("magicLink", { token: "t", next: "//evil.example" }, ctx)).toMatchObject({
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

  it("trims a trailing slash from APP_URL", () => {
    expect(getMailConfig({ NODE_ENV: "test", APP_URL: "http://localhost:6873/" }).appUrl).toBe(
      "http://localhost:6873",
    );
  });
});

describe("retryDelayMs", () => {
  it("doubles from a minute and caps at six hours", () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60_000);
  });
});
