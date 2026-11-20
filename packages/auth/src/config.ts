export type AuthConfig = {
  secret: string | undefined;
  /** Public origin of the server that mounts /api/auth (e.g. https://caretook.com). */
  baseURL: string | undefined;
  /** Extra origins allowed to call the auth API (comma-separated in env). */
  trustedOrigins: string[];
  /** The PowerSync service URL: the `aud` of the JWTs it accepts. */
  powersyncURL: string | undefined;
};

// Read lazily so importing never requires env vars (typecheck, builds).
export const getAuthConfig = (env: Record<string, string | undefined> = process.env): AuthConfig => ({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: (env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  powersyncURL: env.POWERSYNC_URL || undefined,
});
