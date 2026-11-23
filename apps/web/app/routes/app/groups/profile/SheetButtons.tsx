import type { ActionResult } from "~/lib/core/api";

import { FormFooter, Message } from "~/components/ui";
import { PROFILE_NEEDS_CONNECTION } from "~/lib/profiles/recipientDisplay";
import { useOnline } from "./profileSheet";

/**
 * The foot of a writers' sheet (Basics, Contact, Insurance, Emergency): "Needs a connection"
 * while offline, the save's error, then Cancel and Save. Save is disabled
 * while saving and while offline (every profile write is online only).
 */
export function SheetButtons({
  busy,
  result,
  onCancel,
}: {
  busy: boolean;
  result: ActionResult | undefined;
  onCancel: () => void;
}) {
  const online = useOnline();
  return (
    <>
      {!online && (
        <p className="text-muted text-sm" data-needs-connection="">
          {PROFILE_NEEDS_CONNECTION}
        </p>
      )}
      {result && !result.ok && <Message tone="error">{result.error}</Message>}
      <FormFooter
        submitLabel="Save"
        busy={busy}
        busyLabel="Saving…"
        submitDisabled={!online}
        cancel={{ label: "Cancel", onCancel }}
      />
    </>
  );
}
