import type { ListChip } from "~/components/ui";
import type { ProviderRow } from "~/lib/sync/providers";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChipGroup, ChipList, ComboBox } from "~/components/ui";
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
import { useProviderSuggestions } from "~/lib/sync/providerSuggestions";
import { canAddNamed, chipLabel, pickerOptions } from "./withProviders";

const NO_ROWS: ProviderRow[] = [];
/** The linked providers before the first read: no suggestions until it's known that there are none. */
const NOT_READ_YET: ProviderRow[] = [];

/**
 * The entry header's With region: who a note or event was with. Every
 * linked provider is a chip that opens their page (a deleted one is greyed,
 * "(removed)", and not a link). Writers remove a chip with its ×, and add
 * through a picker over the group's providers, which can also add a new
 * clinician by the typed name, linked in the same write. Linking on a draft
 * saves it first (`ensureStored`); the editor stays where it is. While
 * nothing is linked, writers also get up to 5 suggested providers (named in
 * the title or text, linked to entries with this title before, or linked
 * recently), each linked in one tap the same way. Viewers see the chips
 * only, and nothing when there are none.
 */
export function EntryWithRow({
  entryId,
  groupId,
  canWrite,
  title,
  ensureStored,
}: {
  entryId: string;
  groupId: string;
  canWrite: boolean;
  /** The title as it is now (typed or saved), for suggestions. */
  title: string | null;
  /** Saves a draft; resolves true once the entry is stored. */
  ensureStored: () => Promise<boolean>;
}) {
  const query = entryProvidersQuery(entryId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NOT_READ_YET);
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
      {canWrite && !picking && rows !== NOT_READ_YET && linked.length === 0 && (
        <ProviderSuggestions
          groupId={groupId}
          entryId={entryId}
          title={title}
          onPick={(id) => void link(id)}
        />
      )}
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** One-tap suggestions while nothing is linked: a list of chips, each named "Link <name>". */
function ProviderSuggestions({
  groupId,
  entryId,
  title,
  onPick,
}: {
  groupId: string;
  entryId: string;
  title: string | null;
  onPick: (providerId: string) => void;
}) {
  const suggested = useProviderSuggestions({ groupId, entryId, title });
  if (suggested.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-provider-suggestions>
      <span className="text-base-content/70 text-sm">Suggested</span>
      <ChipGroup
        label="Suggested providers"
        actions={suggested.map((p) => ({ id: p.id, label: p.name, onPress: () => onPick(p.id) }))}
      />
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
