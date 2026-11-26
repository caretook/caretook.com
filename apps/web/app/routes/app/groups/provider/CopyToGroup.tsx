import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { GroupRow } from "~/lib/timeline/timeline.sync";

import { useMemo, useState } from "react";
import { ChoiceGroup, ConfirmDialog, Message } from "~/components/ui";
import { COPY_BUTTON, alreadyIn, copiedTo, copyTitle, notesStayIn } from "~/lib/providers/importWording";
import { importProviders, providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { getSync, useLiveQuery } from "~/lib/sync";
import { myGroupsQuery, readRows, toMyGroup, WRITER_ROLES } from "~/lib/timeline/timeline.sync";

const NO_ROWS: GroupRow[] = [];

/** A group a provider can be copied to, named as the import sheet names it. */
export type CopyTarget = { id: string; name: string };

/**
 * The groups this provider can be copied to: the other groups where you
 * write, named as the import sheet names them (the person, else the group).
 * None: no Copy to another group.
 */
export function useCopyTargets(provider: LocalProvider): CopyTarget[] {
  const [db] = useState(getSync);
  const query = myGroupsQuery(db.userId);
  const rows = useLiveQuery<GroupRow>(query.sql, query.params, NO_ROWS);
  return useMemo(
    () =>
      rows
        .map(toMyGroup)
        .filter((g) => g.id !== provider.groupId && !!g.role && WRITER_ROLES.includes(g.role))
        .map((g) => ({ id: g.id, name: g.recipient?.displayName || g.name })),
    [rows, provider.groupId],
  );
}

/**
 * "Copy to another group", opened from the provider page's ⋯ menu: a dialog
 * that picks the target (`targets`, from `useCopyTargets`), names the notes
 * rule and copies through `importProviders`. `onResult` gets the status
 * ("Copied to X." / "Already in X. …") for the page to show.
 */
export function CopyToGroup({
  provider,
  groupName,
  targets,
  open,
  onClose,
  onResult,
}: {
  provider: LocalProvider;
  /** This group as the import sheet names it (the person, else the group). */
  groupName: string;
  targets: CopyTarget[];
  open: boolean;
  onClose: () => void;
  onResult: (message: string) => void;
}) {
  const [db] = useState(getSync);
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const target = targets.find((t) => t.id === chosen) ?? (targets.length === 1 ? targets[0]! : null);
  const close = () => {
    setError("");
    onClose();
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
    <ConfirmDialog
      open={open}
      title={copyTitle(provider.name)}
      message={target ? notesStayIn(groupName) : undefined}
      confirmLabel={COPY_BUTTON}
      confirmDisabled={!target || busy}
      confirmVariant="primary"
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
        {error && <Message tone="error">{error}</Message>}
      </div>
    </ConfirmDialog>
  );
}
