import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { isTodoWriter } from "@caretook/data/schema";
import { Pill } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { ContactActions, ProviderTypeIcon } from "~/components/providers";
import { LinkToBox } from "~/components/todos";
import { Message, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { quickActions } from "~/lib/providers/contactActions";
import { formatDate, medicationTitle } from "~/lib/medications/medicationDisplay";
import { useMedicationLinkState } from "~/lib/medications/medicationOrigin";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { medicationQuery, toMedication } from "~/lib/medications/medications.sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";
import { linkLabel } from "~/lib/todos/todoDisplay";
import { EntryLinkRow, IconDot, LINK_ROW, RemoveLink, STRETCHED } from "./TodoEntryLinks";
import { useEntryLinking, useTodoEntries } from "./useTodoEntryLinks";

type Loaded = Awaited<ReturnType<typeof loadTodo>>["linkRows"];

const NO_ROWS: never[] = [];

/** The loader's rows when they're for this id (stable), else none. */
const rowsFor = <R extends { id: string }>(rows: R[], id: string | null): R[] =>
  id && rows[0]?.id === id ? rows : NO_ROWS;

/** The provider: its name linking to its page, and its quick contact actions; greyed "(removed)" once deleted. */
function ProviderLink({
  groupId,
  id,
  loaded,
  linked,
  onRemove,
}: {
  groupId: string;
  id: string;
  loaded: ProviderRow[];
  linked: boolean;
  /** Writers: clear the slot. */
  onRemove?: () => void;
}) {
  const q = providerQuery(id);
  const rows = useLiveQuery<ProviderRow>(q.sql, q.params, loaded);
  const provider = rows[0] ? toProvider(rows[0]) : null;
  if (!provider || provider.groupId !== groupId) return null;
  const removed = !!provider.deletedAt;
  return (
    <li className={LINK_ROW} data-todo-link="provider">
      <ProviderTypeIcon type={provider.type} past={removed || provider.status === "past"} />
      <div className="min-w-0 flex-1">
        <p className="text-muted text-sm">Provider</p>
        {removed ? (
          <p className="text-faint truncate" data-todo-link-name>
            {linkLabel(provider.name, true)}
          </p>
        ) : !linked ? (
          <p className="truncate font-medium" data-todo-link-name>
            {provider.name}
          </p>
        ) : (
          <Link to={appUrls.provider(groupId, provider.id)} className={STRETCHED} data-todo-link-name>
            {provider.name}
          </Link>
        )}
      </div>
      {!removed && <ContactActions actions={quickActions(provider)} />}
      {onRemove && <RemoveLink name={provider.name} onRemove={onRemove} />}
    </li>
  );
}

/** The medication: its name linking to its page; greyed "(removed)" once deleted. */
function MedicationLink({
  groupId,
  id,
  loaded,
  linked,
  onRemove,
}: {
  groupId: string;
  id: string;
  loaded: MedicationRow[];
  linked: boolean;
  /** Writers: clear the slot. */
  onRemove?: () => void;
}) {
  const q = medicationQuery(id);
  const rows = useLiveQuery<MedicationRow>(q.sql, q.params, loaded);
  const medication = rows[0] ? toMedication(rows[0]) : null;
  const linkState = useMedicationLinkState();
  if (!medication || medication.groupId !== groupId) return null;
  const removed = !!medication.deletedAt;
  const title = medicationTitle(medication);
  return (
    <li className={LINK_ROW} data-todo-link="medication">
      <IconDot>
        <Pill className="size-4" />
      </IconDot>
      <div className="min-w-0 flex-1">
        <p className="text-muted text-sm">Medication</p>
        {removed ? (
          <p className="text-faint truncate" data-todo-link-name>
            {linkLabel(title, true)}
          </p>
        ) : !linked ? (
          <p className="font-medium break-words" data-todo-link-name>
            {title}
          </p>
        ) : (
          <Link
            to={appUrls.medication(groupId, medication.id)}
            state={linkState}
            className={STRETCHED}
            data-todo-link-name
          >
            {title}
          </Link>
        )}
        {medication.status !== "current" && medication.stoppedOn && !removed && (
          <p className="text-muted text-sm">Stopped {formatDate(medication.stoppedOn)}</p>
        )}
      </div>
      {onRemove && <RemoveLink name={title} onRemove={onRemove} />}
    </li>
  );
}

/**
 * What the todo is about: its provider (with call and map actions), every
 * note and event that links it (planner-3), newest first, and its
 * medication, each opening its page (the provider and medication as plain
 * names without `linkPages`: the easy roles can't open their pages).
 * Writers link more here through the shared "Link to" box (a note or
 * event adds a link row; a provider or medication fills its slot, replacing
 * the one there) and remove links (neither side is deleted). Nothing for a reader when it has no links. Live: a provider
 * deleted, an entry deleted or an appointment cancelled on another device
 * shows at once.
 */
export function TodoLinks({
  groupId,
  todo,
  loaded,
  linkPages = true,
}: {
  groupId: string;
  todo: Pick<LocalTodo, "id" | "providerId" | "medicationId">;
  /** The loader's rows for the links (stable). */
  loaded: Loaded;
  /** Whether the provider and medication link to their pages. */
  linkPages?: boolean;
}) {
  const { providerId, medicationId } = todo;
  const group = useGroup();
  const writer = isTodoWriter(group.role);
  const initial = useMemo(
    () => ({
      provider: rowsFor(loaded.provider, providerId),
      medication: rowsFor(loaded.medication, medicationId),
    }),
    [loaded, providerId, medicationId],
  );
  // Its notes and events are link rows: one live query for them all.
  const { entries, textOf } = useTodoEntries(groupId, todo.id, loaded);
  const linking = useEntryLinking(todo.id);
  const any = !!providerId || entries.length > 0 || !!medicationId;
  const linkedIds = useMemo(
    () => [providerId, medicationId, ...entries.map((e) => e.id)].filter((id): id is string => !!id),
    [providerId, medicationId, entries],
  );
  if (!any && !writer) return null;
  return (
    <Section title="Linked to" id="links" data-todo-links="">
      {any && (
        <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
          {providerId && (
            <ProviderLink
              key={providerId}
              groupId={groupId}
              id={providerId}
              loaded={initial.provider}
              linked={linkPages}
              onRemove={writer ? () => void linking.setSlot("providerId", null) : undefined}
            />
          )}
          {entries.map((entry) => (
            <EntryLinkRow
              key={entry.id}
              groupId={groupId}
              entry={entry}
              text={textOf(entry.id)}
              onRemove={writer ? () => void linking.unlink(entry.id) : undefined}
            />
          ))}
          {medicationId && (
            <MedicationLink
              key={medicationId}
              groupId={groupId}
              id={medicationId}
              loaded={initial.medication}
              linked={linkPages}
              onRemove={writer ? () => void linking.setSlot("medicationId", null) : undefined}
            />
          )}
        </ul>
      )}
      {linking.error && <Message tone="error">{linking.error}</Message>}
      {writer && (
        <LinkToBox
          groupId={groupId}
          linked={linkedIds}
          onPick={({ type, id }) => {
            if (type === "provider") void linking.setSlot("providerId", id);
            else if (type === "medication") void linking.setSlot("medicationId", id);
            else void linking.link(id);
          }}
        />
      )}
    </Section>
  );
}
