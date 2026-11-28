import type { MedicationRow } from "~/lib/medications/medications.sync";
import type { ProviderRow } from "~/lib/providers/providers.sync";
import type { GroupTagRow } from "~/lib/tags/tags.sync";
import type { MemberRow } from "~/lib/timeline/timeline.sync";
import type { LocalTodo } from "~/lib/todos/todos.sync";
import type { loadTodo } from "./loadTodo";

import { useMemo } from "react";
import { MedicationCard } from "~/components/medications";
import { ContactActions, ProviderCard } from "~/components/providers";
import { QuickTags, useGroupRecordTags } from "~/components/tags";
import { LinkToBox } from "~/components/todos";
import { List, Message, Section } from "~/components/ui";
import { quickActions } from "~/lib/providers/contactActions";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";
import { medicationQuery, toMedication } from "~/lib/medications/medications.sync";
import { providerQuery, toProvider } from "~/lib/providers/providers.sync";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";
import { membersQuery, toMember } from "~/lib/timeline/timeline.sync";
import { EntryLinkRow, RemoveLink } from "./TodoEntryLinks";
import { useEntryLinking, useTodoEntries } from "./useTodoEntryLinks";
import { isTodoWriter } from "@caretook/data/domain";
import { formatDate, medicationTitle } from "@caretook/data/schema";

type Loaded = Awaited<ReturnType<typeof loadTodo>>["linkRows"];

const NO_ROWS: never[] = [];
const NO_TAGS: GroupTagRow[] = [];

/** The loader's rows when they're for this id (stable), else none. */
const rowsFor = <R extends { id: string }>(rows: R[], id: string | null): R[] =>
  id && rows[0]?.id === id ? rows : NO_ROWS;

/** What a link row gets besides its record: how it opens, its tags and the writer's Remove. */
type LinkRowProps = {
  groupId: string;
  id: string;
  /** Whether it opens its page (not for the easy roles: a plain name). */
  linked: boolean;
  tags?: readonly GroupTagRow[];
  tagsReadOnly: boolean;
  /** Writers: clear the slot. */
  onRemove?: () => void;
};

/** The provider as its `ProviderCard` (condensed, with every quick contact action); greyed "(removed)" once deleted. */
function ProviderLink({
  groupId,
  id,
  loaded,
  linked,
  tags,
  tagsReadOnly,
  onRemove,
}: LinkRowProps & { loaded: ProviderRow[] }) {
  const q = providerQuery(id);
  const rows = useLiveQuery<ProviderRow>(q.sql, q.params, loaded);
  const provider = rows[0] ? toProvider(rows[0]) : null;
  if (!provider || provider.groupId !== groupId) return null;
  return (
    <ProviderCard
      provider={provider}
      look="condensed"
      label="Provider"
      open={linked ? undefined : null}
      removed={!!provider.deletedAt}
      actions={<ContactActions actions={quickActions(provider)} />}
      trailing={onRemove && <RemoveLink name={provider.name} onRemove={onRemove} />}
      tags={tags}
      tagsReadOnly={tagsReadOnly}
      data-todo-link="provider"
    />
  );
}

/** The medication as its `MedicationCard`, with its tags; greyed "(removed)" once deleted. */
function MedicationLink({
  groupId,
  id,
  loaded,
  linked,
  tags,
  tagsReadOnly,
  onRemove,
}: LinkRowProps & { loaded: MedicationRow[] }) {
  const q = medicationQuery(id);
  const rows = useLiveQuery<MedicationRow>(q.sql, q.params, loaded);
  const medication = rows[0] ? toMedication(rows[0]) : null;
  if (!medication || medication.groupId !== groupId) return null;
  const removed = !!medication.deletedAt;
  const stopped = medication.status !== "current";
  const title = medicationTitle(medication);
  return (
    <MedicationCard
      medication={medication}
      groupId={groupId}
      stopped={stopped}
      removed={removed}
      open={linked ? undefined : null}
      label="Medication"
      trailing={onRemove && <RemoveLink name={title} onRemove={onRemove} />}
      data-todo-link="medication"
      data-medication-id={medication.id}
    >
      {stopped && medication.stoppedOn && !removed && (
        <p className="text-muted text-sm">Stopped {formatDate(medication.stoppedOn)}</p>
      )}
      {!removed && (
        <QuickTags
          target="medication"
          recordId={medication.id}
          label={title}
          createdBy={medication.createdBy}
          max={ROW_CHIPS}
          tags={tags ?? NO_TAGS}
          readOnly={tagsReadOnly}
          className="mt-1"
        />
      )}
    </MedicationCard>
  );
}

/**
 * What the todo is about, each as its kind's shared display with its tags
 * (one query per kind, and the members once, for the whole list): its
 * provider (`ProviderCard`, with call and map actions), every note and
 * event that links it (planner-3; the timeline's row), newest first, and
 * its medication (`MedicationCard`), each opening its page (the provider
 * and medication as plain names without `linkPages`: the easy roles can't
 * open their pages, and see tags as chips only).
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
  const providerTags = useGroupRecordTags(groupId, "provider");
  const medicationTags = useGroupRecordTags(groupId, "medication");
  const entryTags = useGroupRecordTags(groupId, "entry");
  const mq = membersQuery(groupId);
  const memberRows = useLiveQuery<MemberRow>(mq.sql, mq.params, loaded.members);
  const members = useMemo(() => new Map(memberRows.map((row) => [row.user_id, toMember(row)])), [memberRows]);
  const tagsReadOnly = !linkPages;
  const any = !!providerId || entries.length > 0 || !!medicationId;
  const linkedIds = useMemo(
    () => [providerId, medicationId, ...entries.map((e) => e.id)].filter((id): id is string => !!id),
    [providerId, medicationId, entries],
  );
  if (!any && !writer) return null;
  return (
    <Section title="Linked to" id="links" data-todo-links="">
      {any && (
        <List>
          {providerId && (
            <ProviderLink
              key={providerId}
              groupId={groupId}
              id={providerId}
              loaded={initial.provider}
              linked={linkPages}
              tags={providerTags.get(providerId)}
              tagsReadOnly={tagsReadOnly}
              onRemove={writer ? () => void linking.setSlot("providerId", null) : undefined}
            />
          )}
          {entries.map((entry) => (
            <EntryLinkRow
              key={entry.id}
              groupId={groupId}
              entry={entry}
              text={textOf(entry.id)}
              authorName={members.get(entry.createdBy)?.name ?? "Former member"}
              authorImage={members.get(entry.createdBy)?.image ?? null}
              tags={entryTags.get(entry.id)}
              tagsReadOnly={tagsReadOnly}
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
              tags={medicationTags.get(medicationId)}
              tagsReadOnly={tagsReadOnly}
              onRemove={writer ? () => void linking.setSlot("medicationId", null) : undefined}
            />
          )}
        </List>
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
