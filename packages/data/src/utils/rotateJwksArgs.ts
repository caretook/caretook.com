// `pnpm auth:rotate-jwks [--reason "why"]`: the command line, parsed. Pure,
// so it's unit-tested; scripts/authRotateJwks.ts runs it.

export const ROTATE_JWKS_USAGE = 'Usage: pnpm auth:rotate-jwks [--reason "why"]';

export type RotateJwksArgs = { reason?: string } | { error: string };

/** `argv` without node and the script: an optional `--reason` (1–500 characters). */
export const parseRotateJwksArgs = (argv: readonly string[]): RotateJwksArgs => {
  let reason: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined || arg === "--") continue;
    if (arg === "--reason" || arg.startsWith("--reason=")) {
      const value = arg === "--reason" ? argv[++i] : arg.slice("--reason=".length);
      if (!value?.trim()) return { error: "--reason needs a value" };
      reason = value.trim();
    } else {
      return { error: arg.startsWith("-") ? `Unknown option ${arg}` : `Unexpected argument ${arg}` };
    }
  }
  if (reason !== undefined && reason.length > 500) return { error: "--reason is 1–500 characters" };
  return reason ? { reason } : {};
};
