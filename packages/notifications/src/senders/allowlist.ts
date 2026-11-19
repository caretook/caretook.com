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

/** A fixed allowlist, or one read at send time (the `mail.allowlist` app setting). */
export type Allowlist = readonly string[] | (() => Promise<readonly string[]>);

/**
 * Outside production, real email goes only to allowlisted addresses; others
 * are skipped (recorded, not sent, not retried). An empty allowlist sends
 * nothing.
 */
export const withAllowlist = (sender: Sender, allowlist: Allowlist): Sender => ({
  name: `${sender.name}+allowlist`,
  send: async (message) => {
    const list = typeof allowlist === "function" ? await allowlist() : allowlist;
    return isAllowlisted(message.to, list)
      ? sender.send(message)
      : { status: "skipped", reason: "Not on the email allowlist (outside production)" };
  },
});
