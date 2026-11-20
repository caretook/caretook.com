export type AuthSecret = { version: number; value: string };

export type AuthConfig = {
  /**
   * BETTER_AUTH_SECRET. Alone, it's the one secret. Beside a secret list,
   * it's Better Auth's legacy secret: it still decrypts what was encrypted
   * before the list (the JWKS private key until `pnpm auth:rotate-jwks`).
   */
  secret: string | undefined;
  /**
   * BETTER_AUTH_SECRETS, `<version>:<secret>` comma-separated, current
   * first (ops/runbook.md, _Rotation_). Undefined when unset.
   */
  secrets: AuthSecret[] | undefined;
  /** Public origin of the server that mounts /api/auth (e.g. https://caretook.com). */
  baseURL: string | undefined;
  /** Extra origins allowed to call the auth API (comma-separated in env). */
  trustedOrigins: string[];
  /** The PowerSync service URL: the `aud` of the JWTs it accepts. */
  powersyncURL: string | undefined;
};

/**
 * BETTER_AUTH_SECRETS parsed as Better Auth parses it (versions are
 * non-negative integers; the first entry is current). A malformed list
 * throws, naming the position, never a value.
 */
export const parseAuthSecrets = (raw: string | undefined): AuthSecret[] | undefined => {
  if (!raw?.trim()) return undefined;
  return raw.split(",").map((entry, i) => {
    const trimmed = entry.trim();
    const colon = trimmed.indexOf(":");
    const version = colon > 0 ? trimmed.slice(0, colon) : "";
    const value = colon > 0 ? trimmed.slice(colon + 1).trim() : "";
    if (!/^\d+$/.test(version) || !value)
      throw new Error(`BETTER_AUTH_SECRETS entry ${i + 1} must be <version>:<secret>`);
    return { version: Number(version), value };
  });
};

// Read lazily so importing never requires env vars (typecheck, builds).
export const getAuthConfig = (env: Record<string, string | undefined> = process.env): AuthConfig => ({
  secret: env.BETTER_AUTH_SECRET || undefined,
  secrets: parseAuthSecrets(env.BETTER_AUTH_SECRETS),
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: (env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  powersyncURL: env.POWERSYNC_URL || undefined,
});
