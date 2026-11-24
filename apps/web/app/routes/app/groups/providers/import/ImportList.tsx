import type { ProviderType } from "@caretook/data/schema";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";
import type { ImportResult } from "~/lib/providers/providerImport";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { ProviderTypeIcon } from "~/components/providers";
import {
  Badge,
  Button,
  CheckField,
  ChipGroup,
  EmptyState,
  Field,
  List,
  Message,
  STATUS_TONE,
} from "~/components/ui";
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
      <p className="text-muted text-sm" data-notes-rule>
        {notesStayIn(group.name)}
      </p>

      <Field label={`Search providers in ${group.name}`} labelHidden kind="input">
        {(control) => (
          <input
            {...control}
            type="search"
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
        <EmptyState>No providers in {group.name} yet.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState>No providers match “{text.trim()}”.</EmptyState>
      ) : (
        <List label={`Providers in ${group.name}`}>
          {shown.map((p) => {
            const isHere = here.has(p.id);
            const practice = p.practiceId ? practiceNames.get(p.practiceId) : null;
            const details = [PROVIDER_TYPE_META[p.type].label, p.specialty, practice].filter(Boolean);
            return (
              <li key={p.id} data-import-row={p.id}>
                <CheckField
                  className="px-3 py-2"
                  checked={!isHere && chosen.has(p.id)}
                  disabled={isHere}
                  onChange={(e) => toggle(p.id, e.currentTarget.checked)}
                  label={
                    <span className="flex items-center gap-3">
                      <ProviderTypeIcon type={p.type} past={p.status === "past"} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium" data-import-name>
                          {p.name}
                        </span>
                        <span className="text-muted block truncate text-sm">
                          {details.join(" · ")}
                          {p.status === "past" && " · Past"}
                        </span>
                      </span>
                      {isHere && (
                        <Badge tone={STATUS_TONE.past} className="shrink-0">
                          {ALREADY_HERE}
                        </Badge>
                      )}
                    </span>
                  }
                />
              </li>
            );
          })}
        </List>
      )}

      <Message data-import-status="">{result?.ok ? importSummary(result.results) : ""}</Message>
      {result && !result.ok && <Message tone="error">{result.error}</Message>}

      <div className="flex justify-end gap-2" data-import-picks>
        {/* What the sheet's guard watches: a tick stays here while a search hides its row. */}
        {ticked.map((id) => (
          <input key={id} type="hidden" name="picked" value={id} />
        ))}
        <Button data-form-cancel="" onClick={onDone}>
          Done
        </Button>
        <Button
          variant="primary"
          disabled={ticked.length === 0 || busy}
          onClick={submit}
          data-import-submit=""
        >
          {importButtonLabel(ticked.length)}
        </Button>
      </div>
    </>
  );
}
