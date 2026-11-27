import type { LinkChoices } from "./todoSheet";
import type { ListChip } from "~/components/ui";
import type { ChosenEntryRow } from "~/lib/todos/todos.sync";
import type { EntryRow } from "~/lib/timeline/timeline.sync";

import { canHaveNoteDocument } from "@caretook/data/schema";
import { useMemo, useState } from "react";
import { LinkToBox } from "~/components/todos";
import { ChipList, Message } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { medicationTitle } from "~/lib/medications/medicationDisplay";
import { useLiveQuery } from "~/lib/sync";
import { linkedEntryName } from "~/lib/todos/entryTodoDisplay";
import { todoEntriesQuery } from "~/lib/todos/entryTodos.sync";
import { chosenEntriesQuery } from "~/lib/todos/todos.sync";
import { toTimelineEntries } from "~/lib/timeline/timeline.sync";
import { FIELD } from "./todoFormData";
import { chosenLinkChip, eventWhen } from "./todoLinks";

export type TodoLinkIds = { providerId: string | null; medicationId: string | null; entryIds: string[] };

const NOT_YET: EntryRow[] = [];
const NO_ROWS: ChosenEntryRow[] = [];

/** An edited todo's linked notes and events, live; null until the device has answered (none for a new one). */
function useLinkedEntryIds(todoId: string | null) {
  const q = todoEntriesQuery(todoId ?? "");
  const rows = useLiveQuery<EntryRow>(q.sql, q.params, NOT_YET);
  return useMemo(
    () => (rows === NOT_YET ? null : rows.filter((r) => canHaveNoteDocument(r.kind ?? "")).map((r) => r.id)),
    [rows],
  );
}

/** The chosen notes' and events' chips, live: those of `ids` that are live notes or events in the group. */
function useEntryChips(groupId: string, ids: readonly string[]) {
  const q = chosenEntriesQuery(groupId, ids);
  const rows = useLiveQuery<ChosenEntryRow>(q.sql, q.params, NO_ROWS);
  return useMemo(() => {
    const texts = new Map(rows.map((r) => [r.id, r.document_text]));
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
 * it's cleared; so does a cancelled event. Posts `providerId`,
 * `medicationId` and the `entryIds` list; an edited todo's starts as its
 * link rows, and isn't sent until the device has read them.
 */
export function TodoLinkFields({
  choices,
  todoId,
  initial,
  errors,
}: {
  choices: LinkChoices;
  /** Editing this todo: its notes and events are read here. */
  todoId: string | null;
  initial: TodoLinkIds;
  errors: Partial<Record<"providerId" | "medicationId", string>>;
}) {
  const { id: groupId } = useGroup();
  const [providerId, setProviderId] = useState(initial.providerId);
  const [medicationId, setMedicationId] = useState(initial.medicationId);
  const linked = useLinkedEntryIds(todoId);
  const [entryIds, setEntryIds] = useState<string[] | null>(todoId ? null : [...new Set(initial.entryIds)]);
  if (entryIds === null && linked) setEntryIds(linked);
  const entryChips = useEntryChips(groupId, entryIds ?? []);

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
    ...(entryIds ?? []).flatMap((id) => {
      const shown = entryChips.get(id);
      return shown ? [chip(id, shown, () => setEntryIds((ids) => ids?.filter((x) => x !== id) ?? ids))] : [];
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
  const linkedIds = [providerId, medicationId, ...(entryIds ?? [])].filter((id): id is string => !!id);
  const error = errors.providerId ?? errors.medicationId;

  return (
    <div className="fieldset" data-todo-links="" data-link-picker="links">
      {chips.length > 0 && <ChipList label="Linked to" chips={chips} />}
      <LinkToBox
        groupId={groupId}
        linked={linkedIds}
        onPick={({ type, id }) => {
          if (type === "provider") setProviderId(id);
          else if (type === "medication") setMedicationId(id);
          else setEntryIds((ids) => (ids && !ids.includes(id) ? [...ids, id] : ids));
        }}
      />
      <input type="hidden" name={FIELD.providerId} value={providerId ?? ""} />
      <input type="hidden" name={FIELD.medicationId} value={medicationId ?? ""} />
      {entryIds && (
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
