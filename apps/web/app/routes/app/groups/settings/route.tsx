import type { Route } from "./+types/route";
import type { ReactNode } from "react";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";
import type { MemberRow } from "~/lib/sync/timeline";

import { ORPCError } from "@orpc/client";
import { WifiOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { redirect, useFetcher, useRevalidator } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { UserAvatar } from "~/components/UserAvatar";
import { load, toActionResult } from "~/lib/api";
import { appUrls } from "~/lib/appUrls";
import { formString } from "~/lib/form";
import { getGroup, useGroup } from "~/lib/group";
import { rpc } from "~/lib/rpc";
import { sessionContext } from "~/lib/session";
import { useLiveQuery } from "~/lib/sync";
import { waitForMembershipGone } from "~/lib/sync/members";
import { membersQuery, readRows } from "~/lib/sync/timeline";
import {
  formatDateOfBirth,
  groupSettingsAccess,
  MEMBER_ROLES,
  memberAccess,
  memberName,
  NEEDS_CONNECTION,
  parseGroupName,
  parseRecipientProfile,
  roleLabel,
  sortMembers,
} from "./groupSettings";

// Shared by web + native. Names, members and roles come from the device's
// local copy (live, so they work offline and follow other members' changes).
// The date of birth doesn't sync, so it comes from the API, and every change
// (names, roles, removing, leaving) goes through the API too: online only.

export const meta = () => [{ title: "Group settings · Caretook" }];

/** fetch fails with a TypeError when there's no connection. */
const isNetworkError = (e: unknown) => e instanceof TypeError;

/**
 * The members from the local copy (the group itself comes from the group
 * route), plus the recipient's profile from the API. Without a connection
 * the page still loads, read-only (`online: false`).
 */
export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  getGroup(context);
  const { db } = context.get(sessionContext);
  const members = await readRows<MemberRow>(db, membersQuery(groupId));

  const profile = await load(request, rpc.careGroup.recipient({ groupId })).then(
    (recipient) => ({ online: true as const, recipient }),
    (e: unknown) => {
      if (isNetworkError(e)) return { online: false as const, recipient: null };
      throw e;
    },
  );
  return { userId: db.userId, groupId, members, ...profile };
}

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
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
    if (intent === "changeRole") {
      const chosen = formString(form, "role");
      const role = MEMBER_ROLES.find((known) => known === chosen);
      if (!role) return { ok: false, error: "Choose a role.", issues: [] };
      await rpc.careGroup.changeRole({ groupId, userId: formString(form, "userId"), role });
      return { ok: true };
    }
    if (intent === "removeMember") {
      const userId = formString(form, "userId");
      const { db } = context.get(sessionContext);
      await rpc.careGroup.removeMember({ groupId, userId });
      if (userId !== db.userId) return { ok: true };
      // You left. `/app` reads the local copy, so wait for the group to go
      // from it first (otherwise `/app` would send you straight back here).
      await waitForMembershipGone(db, { groupId, userId });
      throw redirect(appUrls.home());
    }
    return { ok: false, error: "Unknown action.", issues: [] };
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, error: NEEDS_CONNECTION, issues: [] };
    const refusal = memberRefusal(e);
    if (refusal) return { ok: false, error: refusal, issues: [] };
    return toActionResult(e);
  }
}

/**
 * What a refused member change says. The membership rules' own messages are
 * written for people (owner only, the last owner), so they're shown as they
 * are; a member who has already gone is said plainly.
 */
const memberRefusal = (e: unknown): string | null => {
  if (!(e instanceof ORPCError)) return null;
  const code = (e.data as { code?: unknown } | undefined)?.code;
  if (typeof code !== "string" || !code.startsWith("careGroupMemberService:")) return null;
  if (code === "careGroupMemberService:notFound") return "That person is no longer in this care group.";
  return e.message;
};

/** A save that was refused changed nothing, so there's nothing to load again. */
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const result = actionResult as ActionResult | undefined;
  if (result && !result.ok) return false;
  return defaultShouldRevalidate;
}

export default function GroupSettings({ loaderData }: Route.ComponentProps) {
  const { userId, groupId, online, recipient } = loaderData;

  // Live from the device: a rename or a changed role shows without a reload.
  const group = useGroup();
  const access = groupSettingsAccess(groupId, group.role);

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

      <Section id="members" title="Members">
        <Members
          groupId={groupId}
          userId={userId}
          myRole={group.role}
          online={online}
          initial={loaderData.members}
        />
      </Section>
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

type RemoveTarget = { userId: string; name: string; isSelf: boolean };

/**
 * Everyone in the group, from the local copy (live). Online, owners and
 * admins get a role menu and Remove on the members they may change, and
 * everyone gets Leave on their own row; offline it's a plain list.
 */
function Members({
  groupId,
  userId,
  myRole,
  online,
  initial,
}: {
  groupId: string;
  userId: string;
  myRole: string | null;
  online: boolean;
  initial: MemberRow[];
}) {
  const [seed] = useState(initial);
  const query = membersQuery(groupId);
  const members = sortMembers(useLiveQuery<MemberRow>(query.sql, query.params, seed));

  // Removing and leaving share one confirm dialog and one request.
  const [confirming, setConfirming] = useState<RemoveTarget | null>(null);
  const [target, setTarget] = useState<RemoveTarget | null>(null);
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const confirm = () => {
    if (!confirming) return;
    setTarget(confirming);
    setConfirming(null);
    void fetcher.submit({ intent: "removeMember", userId: confirming.userId }, { method: "post" });
  };

  return (
    <>
      <ul className="divide-base-200 divide-y">
        {members.map((member) => {
          const isSelf = member.user_id === userId;
          const mine = target?.userId === member.user_id;
          return (
            <MemberItem
              key={member.user_id}
              member={member}
              isSelf={isSelf}
              access={online ? memberAccess({ actorRole: myRole, memberRole: member.role, isSelf }) : null}
              removing={mine && busy}
              removeError={mine && result && !result.ok ? result.error : undefined}
              onRemove={() =>
                setConfirming({ userId: member.user_id, name: memberName(member.name), isSelf })
              }
            />
          );
        })}
      </ul>
      {/* Offline there's nothing to confirm: no controls at all. */}
      {online && (
        <ConfirmDialog
          open={!!confirming}
          title={
            confirming?.isSelf
              ? "Leave this care group? You'll lose access to its timeline."
              : `Remove ${confirming?.name ?? "this member"} from this care group? They'll lose access to its timeline.`
          }
          confirmLabel={confirming?.isSelf ? "Leave" : "Remove"}
          onConfirm={confirm}
          onClose={() => setConfirming(null)}
        />
      )}
    </>
  );
}

function MemberItem({
  member,
  isSelf,
  access,
  removing,
  removeError,
  onRemove,
}: {
  member: MemberRow;
  isSelf: boolean;
  /** What you may do to this member; null offline (nothing). */
  access: ReturnType<typeof memberAccess> | null;
  removing: boolean;
  removeError: string | undefined;
  onRemove: () => void;
}) {
  const name = memberName(member.name);
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;

  // The role just chosen shows while it saves and until it syncs back; a
  // refused change, or anyone else's change to this member, shows the saved role.
  const [sent, setSent] = useState<{ role: string; from: string | null } | null>(null);
  if (sent && sent.from !== member.role) setSent(null);
  const shownRole = sent && (busy || result?.ok) ? sent.role : member.role;
  const changeRole = (role: string) => {
    setSent({ role, from: member.role });
    void fetcher.submit({ intent: "changeRole", userId: member.user_id, role }, { method: "post" });
  };

  const error = (result && !result.ok ? result.error : undefined) ?? removeError;
  return (
    <li data-member={member.user_id} className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <UserAvatar name={member.name} image={member.image} className="size-9 text-sm" />
        <p className="min-w-0 flex-1 truncate font-medium">
          {name}
          {isSelf && <span className="text-base-content/70 font-normal"> (you)</span>}
        </p>
        {access?.roles.length ? (
          <select
            aria-label={`Role for ${name}`}
            className="select select-sm w-auto"
            value={shownRole ?? ""}
            disabled={busy || removing}
            onChange={(event) => changeRole(event.target.value)}
          >
            {/* A role this build doesn't know stays selectable as itself. */}
            {!access.roles.some((role) => role === shownRole) && (
              <option value={shownRole ?? ""}>{roleLabel(shownRole)}</option>
            )}
            {access.roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        ) : (
          <span data-role className="text-base-content/70 text-sm">
            {roleLabel(member.role)}
          </span>
        )}
        {(access?.remove || access?.leave) && (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || removing}
            aria-label={access.leave ? "Leave this care group" : `Remove ${name}`}
            onClick={onRemove}
          >
            {access.leave ? (removing ? "Leaving…" : "Leave") : removing ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </li>
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
