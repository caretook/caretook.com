import type { Route } from "./+types/route";

import { SettingsCard, SettingsPage } from "~/components/settings";
import { Button, EmptyState, List, ListRow, Message } from "~/components/ui";
import { sessionContext } from "~/lib/auth/session";
import { canTryAgain } from "~/lib/app-shell/unsavedChanges";
import { loadUnsaved } from "~/lib/app-shell/unsavedChanges.sync";
import { formatDay, formatTime } from "~/lib/core/format";
import { UnsavedLineText } from "./UnsavedLineText";
import { useUnsavedChanges } from "./useUnsavedChanges";

// `/app/settings/not-saved` (sync-safety, B-285): the changes from this device
// the server refused or set aside, kept on the device (`unsaved_change`) so
// nothing is lost without a word. Shared by web + native: local data only, so
// it works offline. One line per row, newest first; Dismiss deletes a line's
// records; a set-aside line (a server fault, B-286) also has Try again.

export const meta = () => [{ title: "Changes not saved · Settings · Caretook" }];

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const { db } = context.get(sessionContext);
  return { records: await loadUnsaved(db) };
}

const when = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export default function NotSavedSettings({ loaderData }: Route.ComponentProps) {
  const { lines, dismiss, dismissAll, tryAgain, tries } = useUnsavedChanges(loaderData.records);

  return (
    <SettingsPage id="not-saved" title="Changes not saved">
      <SettingsCard>
        <p className="text-muted text-sm">
          Changes from this device the server didn&apos;t save. The rest of your group never saw them: make
          them again if they still matter, then dismiss them here.
        </p>
        {lines.length === 0 ? (
          <EmptyState data-not-saved-empty="">Every change from this device was saved.</EmptyState>
        ) : (
          <>
            <List label="Changes not saved" data-not-saved-list="">
              {lines.map((line) => (
                <ListRow
                  key={line.key}
                  data-not-saved={line.key}
                  trailing={
                    <span className="flex gap-1">
                      {canTryAgain(line) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={tries[line.key] === "sending"}
                          onClick={() => void tryAgain(line)}
                        >
                          Try again
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void dismiss(line.ids)}>
                        Dismiss
                      </Button>
                    </span>
                  }
                >
                  <UnsavedLineText line={line} />
                  <p className="text-faint text-xs">{when(line.recordedAt)}</p>
                  {tries[line.key] === "unreachable" && (
                    <Message tone="error">Couldn&apos;t reach the server. Try again later.</Message>
                  )}
                </ListRow>
              ))}
            </List>
            <div>
              <Button size="sm" onClick={() => void dismissAll()} data-not-saved-dismiss-all="">
                Dismiss all
              </Button>
            </div>
          </>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
