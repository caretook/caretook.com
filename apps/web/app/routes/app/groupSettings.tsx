import type { Route } from "./+types/groupSettings";
import type { ReactNode } from "react";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { GroupRow } from "~/lib/sync/timeline";

import { WifiOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { load, toActionResult } from "~/lib/api";
import { notOnDevice } from "~/lib/firstSync";
import { formString } from "~/lib/form";
import {
  formatDateOfBirth,
  groupSettingsAccess,
  NEEDS_CONNECTION,
  parseGroupName,
  parseRecipientProfile,
} from "~/lib/groupSettings";
import { rpc } from "~/lib/rpc";
import { requireSession } from "~/lib/session";
import { useLiveQuery, waitForFirstSync } from "~/lib/sync";
import { myGroupsQuery, readRows } from "~/lib/sync/timeline";

// Shared by web + native. Names and roles come from the device's local copy
// (live, so they work offline and follow other members' changes). The date of
// birth doesn't sync, so it comes from the API, and saves go through the
// API too: editing is online only.

export const meta = () => [{ title: "Group settings · Caretook" }];

/** fetch fails with a TypeError when there's no connection. */
const isNetworkError = (e: unknown) => e instanceof TypeError;

/**
 * The group from the local copy (a group that isn't on the device is a 404),
 * plus the recipient's profile from the API. Without a connection the page
 * still loads, read-only (`online: false`).
 */
export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const { db } = await requireSession(request);
  await waitForFirstSync(db);
  const rows = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const groupRow = rows.find((g) => g.id === groupId);
  if (!groupRow) throw notOnDevice(db);

  const profile = await load(request, rpc.careGroup.recipient({ groupId })).then(
    (recipient) => ({ online: true as const, recipient }),
    (e: unknown) => {
      if (isNetworkError(e)) return { online: false as const, recipient: null };
      throw e;
    },
  );
  return { userId: db.userId, groupId, rows, groupRow, ...profile };
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
    if (isNetworkError(e)) return { ok: false, error: NEEDS_CONNECTION, issues: [] };
    return toActionResult(e);
  }
}

/** A save that was refused changed nothing, so there's nothing to load again. */
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const result = actionResult as ActionResult | undefined;
  if (result && !result.ok) return false;
  return defaultShouldRevalidate;
}

export default function GroupSettings({ loaderData }: Route.ComponentProps) {
  const { userId, groupId, online, recipient } = loaderData;

  // The loader's rows only seed the live query: a save reruns the loader
  // before the renamed rows have synced back, and its (older) read mustn't
  // replace what the watch has since reported.
  const [seed] = useState(loaderData.rows);
  const query = myGroupsQuery(userId);
  const rows = useLiveQuery<GroupRow>(query.sql, query.params, seed);
  const row = rows.find((g) => g.id === groupId) ?? loaderData.groupRow;
  const access = groupSettingsAccess(groupId, row.role);

  // Back online: load the date of birth and show the forms.
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (online) return;
    const retry = () => void revalidate();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [online, revalidate]);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Group settings</h1>

      {!online && (
        <p role="status" data-needs-connection="" className="alert text-sm">
          <WifiOff aria-hidden="true" className="size-4" />
          {NEEDS_CONNECTION}
        </p>
      )}

      {/* Each part of the page is one <section> card; later parts are appended after the last one. */}
      <Section id="group-details" title="Care group">
        {online && access.renameGroup ? (
          <GroupNameForm name={row.name ?? ""} />
        ) : (
          <Details>
            <Detail label="Name" value={row.name} />
          </Details>
        )}
      </Section>

      <Section id="care-recipient" title="Care recipient">
        {!row.recipient_id ? (
          <p className="text-base-content/70 text-sm">This care group has no care recipient yet.</p>
        ) : online && access.editRecipient ? (
          <RecipientForm
            name={row.recipient_name ?? ""}
            preferredName={row.recipient_preferred_name ?? ""}
            dateOfBirth={recipient?.dateOfBirth ?? ""}
          />
        ) : (
          <Details>
            <Detail label="Name" value={row.recipient_name} />
            <Detail label="Preferred name" value={row.recipient_preferred_name} />
            <Detail
              label="Date of birth"
              value={recipient?.dateOfBirth ? formatDateOfBirth(recipient.dateOfBirth) : null}
              empty={online ? "Not set" : "Not available offline"}
            />
          </Details>
        )}
      </Section>

      {/* Members (app-shell slice 6): <Section id="members" title="Members"> goes here. */}
    </main>
  );
}

/** One part of the page: a card with a heading that names its region. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} data-section={id} className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 id={`${id}-heading`} className="card-title text-lg">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Details({ children }: { children: ReactNode }) {
  return <dl className="space-y-3">{children}</dl>;
}

function Detail({
  label,
  value,
  empty = "Not set",
}: {
  label: string;
  value?: string | null;
  empty?: string;
}) {
  return (
    <div>
      <dt className="text-base-content/70 text-sm">{label}</dt>
      <dd className={value ? "" : "text-base-content/70"}>{value || empty}</dd>
    </div>
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
