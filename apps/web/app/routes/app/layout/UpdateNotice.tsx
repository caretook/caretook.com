import { useUpdateNotice } from "./useUpdateNotice";

/**
 * "A new version is ready" · Reload, as a toast with no time limit, while a
 * new version is installed and waiting (lib/app-shell/serviceWorkerRegister.ts).
 * Rendered by the /app layout; it draws nothing itself.
 */
export function UpdateNotice() {
  useUpdateNotice();
  return null;
}
