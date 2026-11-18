import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";

import { useId } from "react";
import { useFetcher } from "react-router";
import { formString } from "~/lib/form";
import { getGroup, useGroup } from "~/lib/group";
import { rpc } from "~/lib/rpc";
import { failedSave, loadRecipientProfile } from "../api";
import {
  formatDateOfBirth,
  groupSettingsAccess,
  parseGroupName,
  parseRecipientProfile,
} from "../groupSettings";
import { Detail, Details, Section, SettingsPage } from "../parts";

// `…/settings/details`. Shared by web + native. The group's and the
// recipient's names come from the device's local copy (live, so they work
// offline and follow other members' changes); the date of birth comes from
// the API. Renaming and editing the recipient go through the API: online only.

export const meta = () => [{ title: "Details · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  return loadRecipientProfile(request, params.groupId);
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const { groupId } = params;
  const form = await request.formData();
  const intent = formString(form, "intent");
  try {
    if (intent === "renameGroup") {
      const parsed = parseGroupName({ name: formString(form, "name") });
      if (!parsed.ok) return parsed;
      await rpc.careGroup.update({ groupId, ...parsed.data });
      return { ok: true };
    }
    if (intent === "updateRecipient") {
      const parsed = parseRecipientProfile({
        name: formString(form, "name"),
        preferredName: formString(form, "preferredName"),
        dateOfBirth: formString(form, "dateOfBirth"),
      });
      if (!parsed.ok) return parsed;
      await rpc.careGroup.updateRecipient({ groupId, ...parsed.data });
      return { ok: true };
    }
    return { ok: false, error: "Unknown action.", issues: [] };
  } catch (e) {
    return failedSave(e);
  }
}

export default function GroupDetails({ loaderData }: Route.ComponentProps) {
  const { online, recipient } = loaderData;

  // Live from the device: a rename or a changed role shows without a reload.
  const group = useGroup();
  const access = groupSettingsAccess(group.id, group.role);

  return (
    <SettingsPage title="Details" online={online}>
      {/* Each part of the page is one <section> card; later parts are appended after the last one. */}
      <Section id="group-details" title="Care group">
        {online && access.renameGroup ? (
          <GroupNameForm name={group.name} />
        ) : (
          <Details>
            <Detail label="Name" value={group.name} />
          </Details>
        )}
      </Section>

      <Section id="care-recipient" title="Care recipient">
        {!group.recipient ? (
          <p className="text-base-content/70 text-sm">This care group has no care recipient yet.</p>
        ) : online && access.editRecipient ? (
          <RecipientForm
            name={group.recipient.name}
            preferredName={group.recipient.preferredName ?? ""}
            dateOfBirth={recipient?.dateOfBirth ?? ""}
          />
        ) : (
          <Details>
            <Detail label="Name" value={group.recipient.name} />
            <Detail label="Preferred name" value={group.recipient.preferredName} />
            <Detail
              label="Date of birth"
              value={recipient?.dateOfBirth ? formatDateOfBirth(recipient.dateOfBirth) : null}
              empty={online ? "Not set" : "Not available offline"}
            />
          </Details>
        )}
      </Section>
    </SettingsPage>
  );
}
function GroupNameForm({ name }: { name: string }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3">
      <input type="hidden" name="intent" value="renameGroup" />
      <Field label="Name" name="name" value={name} result={result} maxLength={120} />
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}

function RecipientForm(props: { name: string; preferredName: string; dateOfBirth: string }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3">
      <input type="hidden" name="intent" value="updateRecipient" />
      <Field label="Name" name="name" value={props.name} result={result} maxLength={120} />
      <Field
        label="Preferred name"
        name="preferredName"
        value={props.preferredName}
        result={result}
        maxLength={120}
        hint="What everyone calls them. Shown in place of the name."
      />
      <Field label="Date of birth" name="dateOfBirth" type="date" value={props.dateOfBirth} result={result} />
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}

/**
 * A labelled input with its own error. It's uncontrolled, and keyed on the
 * saved value: typing is never overwritten, but when the saved value changes
 * (your own save syncing back, or another member's edit) the input takes it.
 */
function Field({
  label,
  name,
  value,
  result,
  type = "text",
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  result: ActionResult | undefined;
  type?: "text" | "date";
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
  const error =
    result && !result.ok ? result.issues.find((issue) => issue.path === name)?.message : undefined;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        key={value}
        id={id}
        name={name}
        type={type}
        defaultValue={value}
        maxLength={maxLength}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`input w-full ${error ? "input-error" : ""}`}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-base-content/70 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} data-field-error={name} className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveRow({ busy, result }: { busy: boolean; result: ActionResult | undefined }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
      {result?.ok && (
        <p role="status" className="text-success text-sm">
          Saved.
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}
    </div>
  );
}
