import type { LinkChoices } from "./todoSheet";
import type { ListChip } from "~/components/ui";
import type { LinkPick } from "~/lib/todos/linkOptions";
import type { ChosenEntryRow } from "~/lib/todos/todos.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";

import { canHaveNoteDocument, medicationTitle } from "@caretook/data/schema";
import { useMemo, useState } from "react";
import { LinkToBox } from "~/components/todos";
import { ChipList, Message } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { previewText } from "~/lib/live-notes/notes.sync";
import { useLiveQuery } from "~/lib/sync";
import { linkedEntryName } from "~/lib/todos/entryTodoDisplay";
import { todoEntriesQuery } from "~/lib/todos/entryTodos.sync";
import { chosenEntriesQuery } from "~/lib/todos/todos.sync";
import { toTimelineEntries } from "~/lib/timeline/timeline.sync";
import { FIELD } from "./todoFormData";
import { chosenLinkChip, eventWhen } from "./todoLinks";

export type TodoLinkIds = { providerId: string | null; medicationId: string | null; entryIds: string[] };

const NO_ENTRIES: EntryRow[] = [];
const NO_ROWS: ChosenEntryRow[] = [];

/** An edited todo's linked notes and events, live (none for a new one). */
function useLinkedEntryIds(todoId: string | null) {
  const q = todoEntriesQuery(todoId ?? "");
  const rows = useLiveQuery<EntryRow>(q.sql, q.params, NO_ENTRIES);
  return useMemo(() => rows.filter((r) => canHaveNoteDocument(r.kind ?? "")).map((r) => r.id), [rows]);
}

/** The chosen notes' and events' chips, live: those of `ids` that are live notes or events in the group. */
function useEntryChips(groupId: string, ids: readonly string[]) {
  const q = chosenEntriesQuery(groupId, ids);
  const rows = useLiveQuery<ChosenEntryRow>(q.sql, q.params, NO_ROWS);
  return useMemo(() => {
    // The text with this device's pending edits (B-991): an untitled note's first line names it.
    const texts = new Map(
      rows.map((r) => [
        r.id,
        previewText({
          id: r.id,
          snapshot: r.document_snapshot,
          text: r.document_text,
          updates: r.document_updates,
        }),
      ]),
    );
    const now = new Date();
    return new Map(
      toTimelineEntries(rows).map((e) => [
        e.id,
        e.kind === "event"
          ? chosenLinkChip(
              { label: `${upcomingTitle(e)} · ${eventWhen(e, now)}`, cancelled: !!e.cancelledAt },
              "",
            )
          : chosenLinkChip({ label: linkedEntryName(e, texts.get(e.id)) }, ""),
      ]),
    );
  }, [rows]);
}

/**
 * The todo's links (todo-links): the shared "Link to" box, and what's
 * chosen as chips with × (one provider and one medication, a new pick
 * replacing it; any number of notes and events), in the todo page's order.
 * A provider or medication removed since stays on its chip, greyed, until
 * it's cleared; so does a cancelled event. The empty box suggests the
 * record the sheet was opened from first (`cameFrom`, while it isn't
 * linked). Posts `providerId` and `medicationId`; a new todo's notes and
 * events as the `entryIds` list, an edited one's only as what this sheet
 * added and removed (`addEntryIds`, `removeEntryIds`; B-990): its chips are
 * its live link rows with those applied, so links another member makes or
 * removes meanwhile are kept as they made them.
 */
export function TodoLinkFields({
  choices,
  todoId,
  initial,
  cameFrom = null,
  errors,
}: {
  choices: LinkChoices;
  /** Editing this todo: its notes and events are read here. */
  todoId: string | null;
  initial: TodoLinkIds;
  /** The record the sheet was opened from (its page). */
  cameFrom?: LinkPick | null;
  errors: Partial<Record<"providerId" | "medicationId", string>>;
}) {
  const { id: groupId } = useGroup();
  const [providerId, setProviderId] = useState(initial.providerId);
  const [medicationId, setMedicationId] = useState(initial.medicationId);
  const linked = useLinkedEntryIds(todoId);
  const [added, setAdded] = useState<string[]>(() => (todoId ? [] : [...new Set(initial.entryIds)]));
  const [removed, setRemoved] = useState<string[]>([]);
  const entryIds = useMemo(
    () => [...linked.filter((id) => !removed.includes(id)), ...added.filter((id) => !linked.includes(id))],
    [linked, added, removed],
  );
  const addEntry = (id: string) => {
    setRemoved((ids) => ids.filter((x) => x !== id));
    if (!linked.includes(id)) setAdded((ids) => (ids.includes(id) ? ids : [...ids, id]));
  };
  const removeEntry = (id: string) => {
    setAdded((ids) => ids.filter((x) => x !== id));
    if (linked.includes(id)) setRemoved((ids) => (ids.includes(id) ? ids : [...ids, id]));
  };
  const entryChips = useEntryChips(groupId, entryIds);

  const chip = (id: string, shown: { label: string; muted: boolean }, onRemove: () => void): ListChip => ({
    id,
    label: shown.label,
    // Plain text: a link would leave the form unsaved.
    to: null,
    muted: shown.muted,
    removeLabel: `Remove link to ${shown.label}`,
    onRemove,
  });
  const provider = choices.providers.find((p) => p.id === providerId);
  const medication = choices.medications.find((m) => m.id === medicationId);
  const chips: ListChip[] = [
    ...(providerId
      ? [
          chip(
            providerId,
            chosenLinkChip(
              provider ? { label: provider.name, deleted: !!provider.deletedAt } : null,
              "Chosen provider",
            ),
            () => setProviderId(null),
          ),
        ]
      : []),
    ...entryIds.flatMap((id) => {
      const shown = entryChips.get(id);
      return shown ? [chip(id, shown, () => removeEntry(id))] : [];
    }),
    ...(medicationId
      ? [
          chip(
            medicationId,
            chosenLinkChip(
              medication ? { label: medicationTitle(medication), deleted: !!medication.deletedAt } : null,
              "Chosen medication",
            ),
            () => setMedicationId(null),
          ),
        ]
      : []),
  ];
  const linkedIds = [providerId, medicationId, ...entryIds].filter((id): id is string => !!id);
  const error = errors.providerId ?? errors.medicationId;

  return (
    <div className="fieldset" data-todo-links="" data-link-picker="links">
      {chips.length > 0 && <ChipList label="Linked to" chips={chips} />}
      <LinkToBox
        groupId={groupId}
        linked={linkedIds}
        cameFrom={cameFrom}
        onPick={({ type, id }) => {
          if (type === "provider") setProviderId(id);
          else if (type === "medication") setMedicationId(id);
          else addEntry(id);
        }}
      />
      <input type="hidden" name={FIELD.providerId} value={providerId ?? ""} />
      <input type="hidden" name={FIELD.medicationId} value={medicationId ?? ""} />
      {todoId ? (
        <>
          {/* Only this sheet's own changes (B-990): none sent, the link rows stay as they are. */}
          {added.map((id) => (
            <input key={id} type="hidden" name={FIELD.addEntryIds} value={id} />
          ))}
          {removed.map((id) => (
            <input key={id} type="hidden" name={FIELD.removeEntryIds} value={id} />
          ))}
        </>
      ) : (
        <>
          {/* The list's own empty field: sent, it means "these and no others". */}
          <input type="hidden" name={FIELD.entryIds} value="" />
          {entryIds.map((id) => (
            <input key={id} type="hidden" name={FIELD.entryIds} value={id} />
          ))}
        </>
      )}
      {error && (
        <Message tone="error" data-picker-error="">
          {error}
        </Message>
      )}
    </div>
  );
}
