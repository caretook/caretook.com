import { Toast } from "~/components/ui";
import { useUpdateNotice } from "./useUpdateNotice";

/** The `update` region's content: a new version is installed and waiting (lib/app-shell/serviceWorkerRegister.ts). */
export function UpdateNotice() {
  const { ready, reloading, reload } = useUpdateNotice();
  return (
    <Toast
      open={ready}
      message="A new version is ready"
      actionLabel="Reload"
      onAction={reload}
      busy={reloading}
    />
  );
}
