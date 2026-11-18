import type { Sender } from "./types";

/**
 * Is `email` on the allowlist? Entries are full addresses or `@domain`s,
 * compared case-insensitively after trimming.
 */
export const isAllowlisted = (email: string, allowlist: readonly string[]) => {
  const address = email.trim().toLowerCase();
  const domain = address.slice(address.lastIndexOf("@"));
  return allowlist.some((entry) => entry === address || (entry.startsWith("@") && entry === domain));
};

/**
 * Outside production, real email goes only to allowlisted addresses; others
 * are skipped (recorded, not sent, not retried). An empty allowlist sends
 * nothing.
 */
export const withAllowlist = (sender: Sender, allowlist: readonly string[]): Sender => ({
  name: `${sender.name}+allowlist`,
  send: async (message) =>
    isAllowlisted(message.to, allowlist)
      ? sender.send(message)
      : { status: "skipped", reason: "Not on MAIL_ALLOWLIST (outside production)" },
});
