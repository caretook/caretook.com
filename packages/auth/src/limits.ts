import type { RateLimiter } from "@caretook/data";

import { createRateLimiter, postgresStore } from "@caretook/data";
import { createHash } from "node:crypto";

// Our own limits on sign-in and sign-up (account-security slice 2), on top
// of Better Auth's per-IP ones, in our limiter (the Postgres store, so every
// instance shares one count). Per address, so a guesser spread over many
// machines still gets few tries, and an inbox can't be flooded:
//   - sign-in emails (the link and code, B-328): 5 an hour per address;
//   - code sign-in: 10 tries an hour per address. Every try counts before
//     the code is checked, so guesses sent at once can't race past it (a
//     right code is one try);
//   - link sign-up (B-333): per client IP and per link.
// Past a limit the answer is the one an unknown address, a wrong code or a
// used-up link gets. On only in production (check builds included) unless a
// test turns them on.

const HOUR = 60 * 60_000;

export const AUTH_LIMITS = {
  signInEmail: { limit: 5, windowMs: HOUR },
  signInCode: { limit: 10, windowMs: HOUR },
  // A household signing up from one network, with room for typos.
  linkSignUpIp: { limit: 10, windowMs: HOUR },
  // A link shared with a family or a care team, at most this many an hour.
  linkSignUpLink: { limit: 30, windowMs: HOUR },
} as const;

export type AuthLimitName = keyof typeof AUTH_LIMITS;

/** An address's key: normalized as accounts are (case, spaces), then hashed, so no address is stored. */
export const addressKey = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("base64url");

export type AuthLimits = {
  /** Count a hit on `name` for `key`; false when it's over the limit. Always true when the limits are off. */
  hit: (name: AuthLimitName, key: string) => Promise<boolean>;
};

/**
 * The limits, on (`enabled`) or off; on, they count in Postgres, scope
 * `auth.<name>`. `limits` lowers some for a test.
 */
export const createAuthLimits = ({
  enabled = process.env.NODE_ENV === "production",
  limits = {},
}: { enabled?: boolean; limits?: Partial<Record<AuthLimitName, number>> } = {}): AuthLimits => {
  if (!enabled) return { hit: () => Promise.resolve(true) };
  const limiters = Object.fromEntries(
    Object.entries(AUTH_LIMITS).map(([name, { limit, windowMs }]) => [
      name,
      createRateLimiter({
        limit: limits[name as AuthLimitName] ?? limit,
        windowMs,
        store: postgresStore(`auth.${name}`),
      }),
    ]),
  ) as Record<AuthLimitName, RateLimiter>;
  return { hit: (name, key) => limiters[name].hit(key) };
};
