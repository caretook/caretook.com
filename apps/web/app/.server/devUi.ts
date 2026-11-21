// The dev UI gallery's gate (`/dev/ui`, server only; see data.ts for why .server/).
import { isCheckBuild } from "@caretook/notifications";

/**
 * The gallery exists outside production, and in a check build on this machine
 * (as the dev mailbox does): one built with `VITE_CHECK_BUILD=1` (baked in by
 * Vite) and running as one (`isCheckBuild`: the flag at run time and a
 * localhost `APP_URL`).
 */
export const devUiEnabled = (
  env: NodeJS.ProcessEnv = process.env,
  builtForChecks: boolean = import.meta.env.VITE_CHECK_BUILD === "1",
) => env.NODE_ENV !== "production" || (builtForChecks && isCheckBuild(env));

/** The gallery's loader starts with this: a plain 404 in production (check builds aside). */
export const requireDevUi = () => {
  if (!devUiEnabled()) throw new Response("Not found", { status: 404 });
};
