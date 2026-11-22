import type { ProviderType } from "@caretook/data/schema";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { ImportResult } from "~/lib/providers/providerImport";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { ProviderTypeIcon } from "~/components/providers";
import { ChipGroup, Field } from "~/components/ui";
import { ALREADY_HERE, importButtonLabel, importSummary, notesStayIn } from "~/lib/providers/importWording";
import { directoryList, PROVIDER_TYPE_META } from "~/lib/providers/providerDirectory";
import { alreadyHereIds } from "~/lib/providers/providerImport";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { useLiveQuery } from "~/lib/sync";

type ImportActionResult = { ok: true; results: ImportResult[] } | { ok: false; error: string };

/** A source group as the import sheet's loader reads it. */
export type ImportGroup = { id: string; name: string; rows: ProviderRow[] };

/**
 * One source group's providers (live) with the directory's search and type
 * chips, a checkbox each (disabled when already here), the notes rule, and
 * "Import N", then a status with the counts. Ticks clear after an import;
 * the copies show "Already here" once they're written.
 */
export function ImportList({
  group,
  target,
  onDone,
}: {
  group: ImportGroup;
  /** This group's providers (live). */
  target: LocalProvider[];
  onDone: () => void;
}) {
  const query = providersQuery(group.id, { includeDeleted: true });
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, group.rows);
  const live = useMemo(() => toProviders(rows).filter((p) => !p.deletedAt), [rows]);
  const practiceNames = useMemo(() => new Map(live.map((p) => [p.id, p.name])), [live]);
  const here = useMemo(() => alreadyHereIds(live, target), [live, target]);

  const [text, setText] = useState("");
  const [type, setType] = useState<ProviderType | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const list = useMemo(() => directoryList(live, { q: text, type }), [live, text, type]);
  const shown = [...list.current, ...list.past];
  const ticked = [...chosen].filter((id) => !here.has(id));

  const importer = useFetcher<ImportActionResult>();
  const busy = importer.state !== "idle";
  const result = !busy ? importer.data : undefined;

  const toggle = (id: string, on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = () => {
    const form = new FormData();
    form.set("from", group.id);
    for (const id of ticked) form.append("id", id);
    setChosen(new Set());
    void importer.submit(form, { method: "post" });
  };

  return (
    <>
      <p className="text-base-content/70 text-sm" data-notes-rule>
        {notesStayIn(group.name)}
      </p>

      <Field label={`Search providers in ${group.name}`} labelHidden>
        {(control) => (
          <input
            {...control}
            type="search"
            className="input w-full"
            placeholder="Search by name, specialty or practice"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
          />
        )}
      </Field>
      <ChipGroup
        label="Provider types"
        actions={[
          { id: "all", label: "All", pressed: !type, onPress: () => setType(null) },
          ...PROVIDER_TYPES.map((t) => ({
            id: t,
            label: PROVIDER_TYPE_META[t].plural,
            pressed: type === t,
            onPress: () => setType(t),
          })),
        ]}
      />

      {live.length === 0 ? (
        <p className="text-base-content/70">No providers in {group.name} yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-base-content/70">No providers match “{text.trim()}”.</p>
      ) : (
        <ul
          aria-label={`Providers in ${group.name}`}
          className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border"
        >
          {shown.map((p) => {
            const isHere = here.has(p.id);
            const practice = p.practiceId ? practiceNames.get(p.practiceId) : null;
            const details = [PROVIDER_TYPE_META[p.type].label, p.specialty, practice].filter(Boolean);
            return (
              <li key={p.id} data-import-row={p.id}>
                <label
                  className={`flex items-center gap-3 px-3 py-2 ${isHere ? "text-base-content/50" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={!isHere && chosen.has(p.id)}
                    disabled={isHere}
                    onChange={(e) => toggle(p.id, e.currentTarget.checked)}
                  />
                  <ProviderTypeIcon type={p.type} past={p.status === "past"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" data-import-name>
                      {p.name}
                    </span>
                    <span className="text-base-content/70 block truncate text-sm">
                      {details.join(" · ")}
                      {p.status === "past" && " · Past"}
                    </span>
                  </span>
                  {isHere && <span className="badge badge-ghost badge-sm shrink-0">{ALREADY_HERE}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <p role="status" className="text-sm" data-import-status>
        {result?.ok ? importSummary(result.results) : ""}
      </p>
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Done
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={ticked.length === 0 || busy}
          onClick={submit}
          data-import-submit
        >
          {importButtonLabel(ticked.length)}
        </button>
      </div>
    </>
  );
}
