export const SENDER_NAMES = ["resend", "log", "memory"] as const;
export type SenderName = (typeof SENDER_NAMES)[number];

export type MailConfig = {
  production: boolean;
  sender: SenderName;
  /** The origin every link is built from. Never the request's Host header. */
  appUrl: string;
  from: string;
  resendApiKey: string | undefined;
  /** Outside production, the only addresses (or `@domain`s) Resend may mail. */
  allowlist: readonly string[];
};

const DEFAULT_APP_URL = "http://localhost:5173";
const DEFAULT_FROM = "Caretook <no-reply@mail.caretook.com>";

const defaultSender = (env: string | undefined): SenderName =>
  env === "production" ? "resend" : env === "test" ? "memory" : "log";

export const parseAllowlist = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

/**
 * Read the mail settings from env (lazily, so importing never needs them).
 * Throws on a configuration that must never run: production without a
 * Resend key or an `APP_URL`, or production sending to the dev mailbox or
 * to memory. That's a deploy mistake, not a per-message failure.
 */
export const getMailConfig = (env: NodeJS.ProcessEnv = process.env): MailConfig => {
  const production = env.NODE_ENV === "production";
  const raw = env.MAIL_SENDER?.trim() || defaultSender(env.NODE_ENV);
  if (!(SENDER_NAMES as readonly string[]).includes(raw)) {
    throw new Error(`MAIL_SENDER must be one of ${SENDER_NAMES.join(", ")} (got "${raw}")`);
  }
  const sender = raw as SenderName;
  const resendApiKey = env.RESEND_API_KEY?.trim() || undefined;

  if (production) {
    if (sender !== "resend") throw new Error(`MAIL_SENDER=${sender} is not allowed in production`);
    if (!resendApiKey) throw new Error("RESEND_API_KEY is required in production");
    if (!env.APP_URL?.trim()) throw new Error("APP_URL is required in production");
  } else if (sender === "resend" && !resendApiKey) {
    throw new Error("MAIL_SENDER=resend needs RESEND_API_KEY");
  }

  return {
    production,
    sender,
    appUrl: (env.APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, ""),
    from: env.MAIL_FROM?.trim() || DEFAULT_FROM,
    resendApiKey,
    allowlist: parseAllowlist(env.MAIL_ALLOWLIST),
  };
};
