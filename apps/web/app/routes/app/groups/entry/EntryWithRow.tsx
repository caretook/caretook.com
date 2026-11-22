import type { ListChip } from "~/components/ui";
import type { FromGroupOption } from "~/lib/providers/fromGroups";
import type { ImportSource } from "~/lib/providers/providerImport";
import type { ProviderRow } from "~/lib/providers/providers.sync";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChipGroup, ChipList, ComboBox } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { fromGroupOption, fromGroupSections } from "~/lib/providers/fromGroups";
import { useOtherGroupProviders } from "~/lib/providers/otherGroupProviders.sync";
import { chipLabel } from "~/lib/providers/entryProviders";
import { getSync, useLiveQuery } from "~/lib/sync";
import {
  createAndLinkProvider,
  entryProvidersQuery,
  importAndLinkProvider,
  linkProvider,
  providersQuery,
  toProviders,
  unlinkProvider,
} from "~/lib/providers/providers.sync";
import { useProviderSuggestions } from "~/lib/providers/providerSuggestions.sync";
import { canAddNamed, pickerOptions } from "./withProviders";

const NO_ROWS: ProviderRow[] = [];
const NO_IDS: readonly string[] = [];

/** A draft's providers (live, in the group, not deleted), in the order given. */
const pendingProvidersQuery = (groupId: string, ids: readonly string[]) => ({
  sql: `SELECT p.* FROM json_each(?) j JOIN provider p ON p.id = j.value
        WHERE p.group_id = ? AND p.deleted_at IS NULL ORDER BY j.key`,
  params: [JSON.stringify(ids), groupId],
});
/** The linked providers before the first read: no suggestions until it's known that there are none. */
const NOT_READ_YET: ProviderRow[] = [];

/**
 * The entry header's With region: who a note or event was with. Every
 * linked provider is a chip that opens their page (a deleted one is greyed,
 * "(removed)", and not a link). Writers remove a chip with its ×, and add
 * through a picker over the group's providers, which can also add a new
 * clinician by the typed name, linked in the same write. Once something is
 * typed, the picker also lists the user's other groups' matches under "From
 * <group>"; picking one copies it here and links the copy in one write.
 * Linking on a draft
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
  pending = NO_IDS,
  onDropPending,
}: {
  entryId: string;
  groupId: string;
  canWrite: boolean;
  /** The title as it is now (typed or saved), for suggestions. */
  title: string | null;
  /** Saves a draft; resolves true once the entry is stored. */
  ensureStored: () => Promise<boolean>;
  /** A draft's providers, shown as linked until it's saved (then they are). */
  pending?: readonly string[];
  /** Drops one of the draft's providers. */
  onDropPending?: (providerId: string) => void;
}) {
  const query = entryProvidersQuery(entryId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NOT_READ_YET);
  const pendingQuery = pendingProvidersQuery(groupId, pending);
  const pendingRows = useLiveQuery<ProviderRow>(pendingQuery.sql, pendingQuery.params, NO_ROWS);
  const stored = useMemo(() => toProviders(rows), [rows]);
  const waiting = useMemo(() => (pending.length ? toProviders(pendingRows) : []), [pending, pendingRows]);
  const linked = stored.length ? stored : waiting;
  // The easy roles can't open a provider's page: their chips are names.
  const { easyRole } = useGroup();
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

  const importAndLink = async (choice: FromGroupOption, source: readonly ImportSource[]) => {
    closePicker(true);
    if (!(await ensureStored())) return setError("Couldn't save this entry, so nothing was linked.");
    report(await importAndLinkProvider(getSync(), entryId, source, choice.sourceId));
  };

  const chips: ListChip[] = linked.map((provider) => ({
    id: provider.id,
    label: chipLabel(provider),
    to: provider.deletedAt || easyRole ? null : appUrls.provider(groupId, provider.id),
    muted: !!provider.deletedAt,
    ...(canWrite && {
      removeLabel: `Remove ${provider.name}`,
      onRemove: () =>
        stored.length
          ? void unlinkProvider(getSync(), entryId, provider.id).then(report)
          : onDropPending?.(provider.id),
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
                onImport={(choice, source) => void importAndLink(choice, source)}
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

/**
 * Below `sm` the suggestions stay on one row that scrolls sideways (no
 * scrollbar; the end fades while more chips are off screen), so they never
 * push the editor down more than one row. From `sm` they wrap as before.
 */
const PHONE_ROW =
  "max-sm:min-w-0 max-sm:flex-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:py-0.5 max-sm:pr-8 max-sm:[scrollbar-width:none] max-sm:[&>li]:shrink-0 max-sm:[mask-image:linear-gradient(to_left,transparent,black_2rem)]";

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
    <div className="flex items-center gap-1.5 sm:flex-wrap" data-provider-suggestions>
      <span className="text-base-content/70 shrink-0 text-sm">Suggested</span>
      <ChipGroup
        label="Suggested providers"
        className={PHONE_ROW}
        actions={suggested.map((p) => ({ id: p.id, label: p.name, onPress: () => onPick(p.id) }))}
      />
    </div>
  );
}

/**
 * The picker: a combo box over the group's providers, live, then the other
 * groups' matches ("From <group>", once something is typed), then "Add
 * "<typed>" as a provider".
 */
function ProviderPicker({
  groupId,
  linked,
  onPick,
  onAdd,
  onImport,
  onClose,
}: {
  groupId: string;
  linked: string[];
  onPick: (providerId: string) => void;
  onAdd: (name: string) => void;
  onImport: (choice: FromGroupOption, source: readonly ImportSource[]) => void;
  onClose: (reason: "blur" | "escape") => void;
}) {
  const { userId } = useGroup();
  const others = useOtherGroupProviders({ userId, groupId, enabled: true });
  const query = providersQuery(groupId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, NO_ROWS);
  const providers = useMemo(() => toProviders(rows), [rows]);
  const [text, setText] = useState("");
  const linkedIds = useMemo(() => new Set(linked), [linked]);
  const options = useMemo(() => pickerOptions(providers, linkedIds, text), [providers, linkedIds, text]);
  const sections = useMemo(() => fromGroupSections(others, providers, text), [others, providers, text]);
  const select = (id: string) => {
    const choice = fromGroupOption(sections, id);
    if (!choice) return onPick(id);
    onImport(choice, others.find((g) => g.id === choice.groupId)?.providers ?? []);
  };

  return (
    <ComboBox
      label="Find a provider to link"
      placeholder="Search providers"
      options={options}
      sections={sections.map((s) => ({
        id: s.groupId,
        heading: s.heading,
        options: s.options.map((o) => ({ id: o.sourceId, label: o.label, description: o.description })),
      }))}
      inputValue={text}
      onInputChange={setText}
      onSelect={select}
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
