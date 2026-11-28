import type { ActionResult } from "~/lib/core/api";

import { confirmsGroupName } from "@caretook/data/schema";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { SettingsCard } from "~/components/settings";
import { Button, ConfirmDialog, Field, Message } from "~/components/ui";

export const DELETE_GROUP_EXPLAINED =
  "Deleting the care group removes everything in it for every member: the timeline, medications, providers, todos and settings. Members' assistants and Google Calendar connections stop. This can't be undone.";

/**
 * The owners' "Delete care group" card (data-rights): a confirm that asks
 * for the group's name (`confirmsGroupName`, the server's rule too) before
 * Delete is enabled, then `careGroup.delete` through the page's action,
 * which waits for the group to leave this device and opens `/app`. Online
 * only: offline the page's notice says so and the card has no button.
 */
export function DeleteGroupCard({ name, editable }: { name: string; editable: boolean }) {
  const fetcher = useFetcher<ActionResult>();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const busy = fetcher.state !== "idle";
  const failed = !busy && fetcher.data?.ok === false ? fetcher.data.error : null;

  const close = () => {
    setOpen(false);
    setTyped("");
  };
  const confirm = () => {
    if (!confirmsGroupName(typed, name)) return;
    void fetcher.submit({ intent: "deleteGroup", confirmName: typed }, { method: "post" });
    close();
  };

  return (
    <SettingsCard id="delete-group" title="Delete care group">
      <p className="text-muted text-sm">{DELETE_GROUP_EXPLAINED}</p>
      {editable && (
        <div>
          <Button
            variant="dangerQuiet"
            icon={Trash2}
            busy={busy}
            busyLabel="Deleting…"
            onClick={() => setOpen(true)}
          >
            Delete care group
          </Button>
        </div>
      )}
      {failed && <Message tone="error">{failed}</Message>}
      {editable && (
        <ConfirmDialog
          open={open}
          title={`Delete ${name}?`}
          message="Everything in this care group is removed for every member. This can't be undone."
          confirmLabel="Delete care group"
          confirmDisabled={!confirmsGroupName(typed, name)}
          onConfirm={confirm}
          onClose={close}
        >
          <Field kind="input" label={`Type ${name} to confirm`}>
            {(control) => (
              <input
                {...control}
                name="confirmName"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirm();
                  }
                }}
              />
            )}
          </Field>
        </ConfirmDialog>
      )}
    </SettingsCard>
  );
}
