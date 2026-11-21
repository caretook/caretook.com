import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { GroupRow } from "~/lib/timeline/timeline.sync";

import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { ChoiceGroup, ConfirmDialog } from "~/components/ui";
import {
  COPY_ACTION,
  COPY_BUTTON,
  alreadyIn,
  copiedTo,
  copyTitle,
  notesStayIn,
} from "~/lib/providers/importWording";
import { importProviders, providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { getSync, useLiveQuery } from "~/lib/sync";
import { myGroupsQuery, readRows, toMyGroup, WRITER_ROLES } from "~/lib/timeline/timeline.sync";

const NO_ROWS: GroupRow[] = [];

/**
 * "Copy to another group" in the provider page's actions: a dialog that picks
 * the target (only other groups where you write; none, no button), names the
 * notes rule and copies through `importProviders`. `onResult` gets the status
 * ("Copied to X." / "Already in X. …") for the page to show.
 */
export function CopyToGroup({
  provider,
  groupName,
  onResult,
}: {
  provider: LocalProvider;
  /** This group as the import sheet names it (the person, else the group). */
  groupName: string;
  onResult: (message: string) => void;
}) {
  const [db] = useState(getSync);
  const query = myGroupsQuery(db.userId);
  const rows = useLiveQuery<GroupRow>(query.sql, query.params, NO_ROWS);
  // Named as the import sheet names them: the person, else the group.
  const targets = useMemo(
    () =>
      rows
        .map(toMyGroup)
        .filter((g) => g.id !== provider.groupId && !!g.role && WRITER_ROLES.includes(g.role))
        .map((g) => ({ id: g.id, name: g.recipient?.displayName || g.name })),
    [rows, provider.groupId],
  );

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (targets.length === 0) return null;

  const target = targets.find((t) => t.id === chosen) ?? (targets.length === 1 ? targets[0]! : null);
  const close = () => {
    setOpen(false);
    setError("");
  };

  const copy = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      // The provider's group, deleted ones too: the planner finds its practice.
      const source = toProviders(
        await readRows<ProviderRow>(db, providersQuery(provider.groupId, { includeDeleted: true })),
      );
      const result = await importProviders(db, target.id, source, [provider.id]);
      if (!result.ok) {
        setError("Couldn't copy it. Try again.");
        return;
      }
      onResult(result.results[0]?.status === "added" ? copiedTo(target.name) : alreadyIn(target.name));
      setChosen("");
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-1"
        onClick={() => setOpen(true)}
        data-copy-provider
      >
        <Copy className="size-4" aria-hidden="true" />
        {COPY_ACTION}
      </button>
      <ConfirmDialog
        open={open}
        title={copyTitle(provider.name)}
        message={target ? notesStayIn(groupName) : undefined}
        confirmLabel={COPY_BUTTON}
        confirmDisabled={!target || busy}
        confirmClassName="btn-primary"
        onConfirm={() => void copy()}
        onClose={close}
      >
        <div className="space-y-2">
          <ChoiceGroup
            name="target"
            label="Copy to"
            options={targets.map((t) => ({ value: t.id, label: t.name }))}
            value={target?.id ?? ""}
            onChange={setChosen}
          />
          {error && (
            <p role="alert" className="text-error text-sm">
              {error}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
