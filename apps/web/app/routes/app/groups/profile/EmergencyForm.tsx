import type { OutsideContact } from "@caretook/data/schema";
import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { DraftEntry, EmergencyDraft, EmergencyMemberRow } from "~/lib/profiles/emergencyList";

import { CONTACT_LIMITS, DETAILS_LIMITS, PROVIDER_LIMITS } from "@caretook/data/schema";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button, ChoiceGroup, EmptyState, Field, IconButton } from "~/components/ui";
import {
  addableMembers,
  draftName,
  draftToSave,
  EMERGENCY_FIELD,
  initialDraft,
  membersWithoutPhone,
  moveEntry,
  movedText,
  outsideFieldName,
  withoutPhoneText,
} from "~/lib/profiles/emergencyList";
import { SheetButtons } from "./SheetButtons";

const NO_PRIMARY = "none";

/** Where focus goes after a change: a row's control (`data-focus` value), once the list has rendered. */
type FocusTarget =
  { key: string; control: "up" | "down" | "remove" | "name" } | { key: null; control: "add" };

/**
 * The emergency list's sheet (owners and admins): the list in order, each
 * row with Move up, Move down and Remove; members who share a phone added
 * from a menu; outside contacts (name, relationship, phone) added and edited
 * in place; and the primary contact (a member on the list, or none). Every
 * move, add and removal is announced. It posts the whole draft as JSON
 * (online only); a save closes the sheet.
 */
export function EmergencyForm({
  members,
  outside,
  onDone,
  onCancel,
}: {
  members: EmergencyMemberRow[];
  outside: OutsideContact[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const issues = result && !result.ok ? result.issues : [];
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<EmergencyDraft>(() => initialDraft(members, outside));
  const [announcement, setAnnouncement] = useState("");
  const focusNext = useRef<FocusTarget | null>(null);

  const addable = addableMembers(members, draft);
  const [toAdd, setToAdd] = useState("");
  const chosen = addable.find((m) => m.userId === toAdd) ?? addable[0];
  const withoutPhone = withoutPhoneText(membersWithoutPhone(members));
  const outsideCount = draft.entries.filter((e) => e.kind === "outside").length;
  const outsideFull = outsideCount >= DETAILS_LIMITS.outsideContacts;
  const total = draft.entries.length;

  useEffect(() => {
    if (!result) return;
    if (result.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [result, onDone]);

  // After a move, add or removal: focus the control it asked for, or the
  // nearest one still there (a Move up that became disabled at the top).
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (!target || !formRef.current) return;
    const form = formRef.current;
    const find = (key: string | null, control: string) => {
      const el = form.querySelector<HTMLElement>(
        key ? `[data-draft-entry="${key}"] [data-focus="${control}"]` : `[data-focus="${control}"]`,
      );
      return el?.matches("button, input") ? el : el?.querySelector<HTMLElement>("button, input");
    };
    const fallbacks =
      target.control === "up" ? ["up", "down"] : target.control === "down" ? ["down", "up"] : [];
    for (const control of [target.control, ...fallbacks]) {
      const el = find(target.key, control);
      if (el && !(el as HTMLButtonElement).disabled) return el.focus();
    }
    find(null, "add")?.focus();
  }, [draft]);

  const move = (index: number, delta: -1 | 1) => {
    const entry = draft.entries[index];
    if (!entry) return;
    const entries = moveEntry(draft.entries, index, delta);
    focusNext.current = { key: entry.key, control: delta < 0 ? "up" : "down" };
    setDraft({ ...draft, entries });
    setAnnouncement(movedText(draftName(entry), entries.indexOf(entry) + 1, entries.length));
  };

  const remove = (index: number) => {
    const entry = draft.entries[index];
    if (!entry) return;
    const entries = draft.entries.filter((_, i) => i !== index);
    const next = entries[index] ?? entries[index - 1];
    focusNext.current = next ? { key: next.key, control: "remove" } : { key: null, control: "add" };
    const primaryUserId =
      entry.kind === "member" && entry.userId === draft.primaryUserId ? null : draft.primaryUserId;
    setDraft({ entries, primaryUserId });
    setAnnouncement(`${draftName(entry)} removed from the list.`);
  };

  const addMember = () => {
    if (!chosen) return;
    const entry: DraftEntry = {
      kind: "member",
      key: `member:${chosen.userId}`,
      userId: chosen.userId,
      name: chosen.name,
      phones: chosen.phones,
    };
    focusNext.current = { key: null, control: "add" };
    setDraft({ ...draft, entries: [...draft.entries, entry] });
    setToAdd("");
    setAnnouncement(`${chosen.name} added, ${total + 1} of ${total + 1}.`);
  };

  const addOutside = () => {
    const id = crypto.randomUUID();
    const entry: DraftEntry = {
      kind: "outside",
      key: `outside:${id}`,
      contact: { id, name: "", relationship: "", phone: "" },
    };
    focusNext.current = { key: entry.key, control: "name" };
    setDraft({ ...draft, entries: [...draft.entries, entry] });
    setAnnouncement(`New contact added, ${total + 1} of ${total + 1}.`);
  };

  const editOutside = (key: string, field: "name" | "relationship" | "phone", value: string) =>
    setDraft((d) => ({
      ...d,
      entries: d.entries.map((e) =>
        e.key === key && e.kind === "outside" ? { ...e, contact: { ...e.contact, [field]: value } } : e,
      ),
    }));

  const listedMembers = draft.entries.flatMap((e) => (e.kind === "member" ? [e] : []));
  const primaryOptions = [
    { value: NO_PRIMARY, label: "None" },
    ...listedMembers.map((m) => ({ value: m.userId, label: m.name })),
  ];
  const primaryValue = listedMembers.some((m) => m.userId === draft.primaryUserId)
    ? (draft.primaryUserId ?? NO_PRIMARY)
    : NO_PRIMARY;

  return (
    <fetcher.Form method="post" noValidate className="space-y-4" ref={formRef} data-emergency-form="">
      <input type="hidden" name={EMERGENCY_FIELD} value={JSON.stringify(draftToSave(draft))} />
      <p className="text-muted text-sm">Responders call them in this order, first to last.</p>

      {draft.entries.length ? (
        <ol className="space-y-2" aria-label="Emergency contacts, in order" data-emergency-draft="">
          {draft.entries.map((entry, i) => (
            <DraftRow
              key={entry.key}
              entry={entry}
              position={i + 1}
              total={total}
              issues={issues}
              onMove={(delta) => move(i, delta)}
              onRemove={() => remove(i)}
              onEdit={(field, value) => editOutside(entry.key, field, value)}
            />
          ))}
        </ol>
      ) : (
        <EmptyState data-emergency-empty="">No one on the list yet.</EmptyState>
      )}

      <div className="space-y-2">
        {addable.length > 0 && (
          <div className="flex items-end gap-2">
            <Field kind="select" label="Add a member" className="min-w-0 flex-1">
              {(control) => (
                <select
                  {...control}
                  value={chosen?.userId ?? ""}
                  onChange={(event) => setToAdd(event.target.value)}
                  data-add-member-choice=""
                >
                  {addable.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Button className="mb-1" onClick={addMember} data-add-member="">
              Add
            </Button>
          </div>
        )}
        {withoutPhone && (
          <p className="text-muted text-sm" data-without-phone="">
            {withoutPhone}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            disabled={outsideFull}
            onClick={addOutside}
            data-focus="add"
            data-add-outside=""
          >
            Add someone without an account
          </Button>
          {outsideFull && (
            <span className="text-muted text-sm">
              {DETAILS_LIMITS.outsideContacts} outside contacts is the most
            </span>
          )}
        </div>
      </div>

      {listedMembers.length > 0 && (
        <ChoiceGroup
          label="Primary contact (who providers call)"
          name="primaryContact"
          options={primaryOptions}
          value={primaryValue}
          onChange={(value) => setDraft({ ...draft, primaryUserId: value === NO_PRIMARY ? null : value })}
          className="[&_[role=radiogroup]]:gap-y-1"
        />
      )}

      <p role="status" aria-live="polite" className="sr-only" data-emergency-status="">
        {announcement}
      </p>
      <SheetButtons busy={busy} result={result} onCancel={onCancel} />
    </fetcher.Form>
  );
}

/** One row: its place, name (or an outside contact's fields), and Move up, Move down and Remove. */
function DraftRow({
  entry,
  position,
  total,
  issues,
  onMove,
  onRemove,
  onEdit,
}: {
  entry: DraftEntry;
  position: number;
  total: number;
  issues: FieldIssue[];
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onEdit: (field: "name" | "relationship" | "phone", value: string) => void;
}) {
  const name = draftName(entry);
  const controls = (
    <div className="flex shrink-0 items-center" data-draft-controls="">
      <MoveButton label={`Move ${name} up`} icon="up" disabled={position === 1} onPress={() => onMove(-1)} />
      <MoveButton
        label={`Move ${name} down`}
        icon="down"
        disabled={position === total}
        onPress={() => onMove(1)}
      />
      <span data-focus="remove" className="contents">
        <IconButton label={`Remove ${name} from the list`} icon={X} onPress={onRemove} />
      </span>
    </div>
  );

  return (
    <li
      className="border-base-300 rounded-box border p-3"
      data-draft-entry={entry.key}
      data-kind={entry.kind}
    >
      {entry.kind === "member" ? (
        <div className="flex items-center gap-2">
          <span className="text-muted w-5 shrink-0 text-right text-sm tabular-nums">{position}.</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{entry.name}</p>
            {entry.phones[0] && <p className="text-muted truncate text-sm">{entry.phones[0].number}</p>}
          </div>
          {controls}
        </div>
      ) : (
        <fieldset>
          <div className="flex items-center gap-2">
            <span className="text-muted w-5 shrink-0 text-right text-sm tabular-nums">{position}.</span>
            <legend className="min-w-0 flex-1 truncate font-medium">{name}</legend>
            {controls}
          </div>
          <OutsideField entry={entry} field="name" label="Name" issues={issues} onEdit={onEdit} required />
          <OutsideField
            entry={entry}
            field="relationship"
            label="Relationship"
            issues={issues}
            onEdit={onEdit}
          />
          <OutsideField entry={entry} field="phone" label="Phone" issues={issues} onEdit={onEdit} required />
        </fieldset>
      )}
    </li>
  );
}

const MAX_LENGTH = {
  name: CONTACT_LIMITS.name,
  relationship: CONTACT_LIMITS.relationship,
  phone: PROVIDER_LIMITS.phoneNumber,
} as const;

function OutsideField({
  entry,
  field,
  label,
  issues,
  onEdit,
  required,
}: {
  entry: Extract<DraftEntry, { kind: "outside" }>;
  field: "name" | "relationship" | "phone";
  label: string;
  issues: FieldIssue[];
  onEdit: (field: "name" | "relationship" | "phone", value: string) => void;
  required?: boolean;
}) {
  const path = outsideFieldName(entry.contact.id, field);
  const error = issues.find((issue) => issue.path === path)?.message;
  const value = entry.contact[field];
  return (
    <Field kind="input" label={label} error={error} required={required}>
      {(control) => (
        <input
          {...control}
          type={field === "phone" ? "tel" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onEdit(field, event.target.value)}
          maxLength={MAX_LENGTH[field] + 20}
          autoComplete="off"
          data-focus={field === "name" ? "name" : undefined}
          data-outside-field={field}
        />
      )}
    </Field>
  );
}

/** Move up or Move down: an icon button, disabled at the end of the list. */
function MoveButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: "up" | "down";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <span data-focus={icon} className="contents">
      <IconButton
        label={label}
        icon={icon === "up" ? ArrowUp : ArrowDown}
        disabled={disabled}
        onPress={onPress}
      />
    </span>
  );
}
