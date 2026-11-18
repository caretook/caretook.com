import type { ListChip } from "~/components/ui";
import type { ProviderRow } from "~/lib/sync/providers";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChipList, ComboBox } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { getSync, useLiveQuery } from "~/lib/sync";
import {
  createAndLinkProvider,
  entryProvidersQuery,
  linkProvider,
  providersQuery,
  toProviders,
  unlinkProvider,
} from "~/lib/sync/providers";
import { canAddNamed, chipLabel, pickerOptions } from "./withProviders";

const NO_ROWS: ProviderRow[] = [];

/**
 * The entry header's With region: who a note or event was with. Every
 * linked provider is a chip that opens their page (a deleted one is greyed,
 * "(removed)", and not a link). Writers remove a chip with its ×, and add
 * through a picker over the group's providers, which can also add a new
 * clinician by the typed name, linked in the same write. Linking on a draft
 * saves it first (`ensureStored`); the editor stays where it is. Viewers see
 * the chips only, and nothing when there are none.
 */
export function EntryWithRow({
  entryId,
  groupId,
  canWrite,
  ensureStored,
}: {
  entryId: string;
  groupId: string;
  canWrite: boolean;
  /** Saves a draft; resolves true once the entry is stored. */
  ensureStored: () => Promise<boolean>;
}) {
  const query = entryProvidersQuery(entryId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const linked = useMemo(() => toProviders(rows), [rows]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  // Picking or Escape puts focus back on Add once the picker has gone.
  const refocus = useRef(false);
  useEffect(() => {
    if (picking || !refocus.current) return;
    refocus.current = false;
    addButton.current?.focus();
  }, [picking]);

  if (!canWrite && linked.length === 0) return null;

  const report = (res: { ok: boolean; error?: string }) => setError(res.ok ? null : (res.error ?? null));

  const closePicker = (focusAdd: boolean) => {
    setPicking(false);
    refocus.current = focusAdd;
  };

  const link = async (providerId: string) => {
    closePicker(true);
    if (!(await ensureStored())) return setError("Couldn't save this entry, so nothing was linked.");
    report(await linkProvider(getSync(), entryId, providerId));
  };

  const addNamed = async (name: string) => {
    closePicker(true);
    if (!(await ensureStored())) return setError("Couldn't save this entry, so nothing was linked.");
    report(await createAndLinkProvider(getSync(), entryId, { type: "clinician", name }));
  };

  const chips: ListChip[] = linked.map((provider) => ({
    id: provider.id,
    label: chipLabel(provider),
    to: provider.deletedAt ? null : appUrls.provider(groupId, provider.id),
    muted: !!provider.deletedAt,
    ...(canWrite && {
      removeLabel: `Remove ${provider.name}`,
      onRemove: () => void unlinkProvider(getSync(), entryId, provider.id).then(report),
    }),
  }));

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-base-content/70 text-sm">With</span>
        {chips.length > 0 && <ChipList label="Linked providers" chips={chips} />}
        {canWrite &&
          (picking ? (
            <div className="w-full max-w-xs">
              <ProviderPicker
                groupId={groupId}
                linked={linked.map((p) => p.id)}
                onPick={(id) => void link(id)}
                onAdd={(name) => void addNamed(name)}
                onClose={(reason) => closePicker(reason === "escape")}
              />
            </div>
          ) : (
            <button
              ref={addButton}
              type="button"
              className="btn btn-ghost btn-sm border-base-300 rounded-full border border-dashed"
              onClick={() => setPicking(true)}
              data-add-provider-link
            >
              <Plus className="size-4" aria-hidden="true" />
              {linked.length ? "Add" : "Add a provider"}
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** The picker: a combo box over the group's providers, live, with "Add "<typed>" as a provider". */
function ProviderPicker({
  groupId,
  linked,
  onPick,
  onAdd,
  onClose,
}: {
  groupId: string;
  linked: string[];
  onPick: (providerId: string) => void;
  onAdd: (name: string) => void;
  onClose: (reason: "blur" | "escape") => void;
}) {
  const query = providersQuery(groupId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const providers = useMemo(() => toProviders(rows), [rows]);
  const [text, setText] = useState("");
  const linkedIds = useMemo(() => new Set(linked), [linked]);
  const options = useMemo(() => pickerOptions(providers, linkedIds, text), [providers, linkedIds, text]);

  return (
    <ComboBox
      label="Find a provider to link"
      placeholder="Search providers"
      options={options}
      inputValue={text}
      onInputChange={setText}
      onSelect={onPick}
      {...(canAddNamed(providers, text) && {
        onCreate: onAdd,
        createLabel: (typed: string) => `Add "${typed}" as a provider`,
      })}
      emptyText={providers.length ? "No providers match" : "No providers yet: type a name to add one"}
      onClose={onClose}
      focusOnMount
    />
  );
}
