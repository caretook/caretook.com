// The web app's door to @caretook/notifications (server only; see data.ts
// for why .server/).
import { isCheckBuild } from "@caretook/notifications";

export * from "@caretook/notifications";

/**
 * The dev mailbox exists outside production, and in a check build: one
 * built with `VITE_CHECK_BUILD=1` (baked in by Vite) and running as one on
 * this machine (`isCheckBuild`: the flag at run time and a localhost `APP_URL`).
 */
export const devMailEnabled = (
  env: NodeJS.ProcessEnv = process.env,
  builtForChecks: boolean = import.meta.env.VITE_CHECK_BUILD === "1",
) => env.NODE_ENV !== "production" || (builtForChecks && isCheckBuild(env));

/** Every /dev/mail route starts with this: a plain 404 in production (check builds aside). */
export const requireDevMail = () => {
  if (!devMailEnabled()) throw new Response("Not found", { status: 404 });
};
