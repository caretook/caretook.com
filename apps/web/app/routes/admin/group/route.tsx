import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { ORPCError } from "@orpc/client";
import { Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { formString } from "~/lib/core/form";
import { adminFailure } from "../adminForms";
import { adminUrls } from "../adminUrls";
import { AuditEntryList } from "../AuditEntryList";
import { auditSearch } from "../auditFilters";
import { countText, dayText, groupRoleLabel, recipientLabel } from "../groupDisplay";
import { InviteOwnerForm } from "./InviteOwnerForm";
import { MemberList } from "./MemberList";

// /admin/groups/:groupId (admin slice 4): one care group as staff see it:
// its name and recipient's name, members (role, who invited them, when they
// joined; each a link to the account's staff page), counts and dates, and
// its recent audit entries. Never its care data. Admins (`groups.manage`)
// get Make owner, Change role, Remove and Invite an owner, each with a
// reason; support sees the page without controls. Opening it records
// `group.view`.

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `${loaderData?.group.name ?? "Group"} · Caretook admin` },
  { name: "robots", content: "noindex" },
];

const notFound = () => new Response("Not found", { status: 404 });

export async function loader({ request, params }: Route.LoaderArgs) {
  const { api, capabilities } = await requireStaff(request, "groups.read");
  try {
    const group = await api.admin.groups.get({ id: params.groupId });
    const audit = await api.admin.audit.list({ target: group.id });
    return {
      group,
      audit: audit.entries,
      auditCount: audit.count,
      canManage: capabilities.includes("groups.manage"),
    };
  } catch (e) {
    if (e instanceof ORPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) throw notFound();
    throw e;
  }
}

export async function action({ request, params }: Route.ActionArgs): Promise<AdminActionResult> {
  const { api } = await requireStaff(request, "groups.manage");
  const form = await request.formData();
  const field = (name: string) => formString(form, name).trim();
  const groupId = params.groupId;
  const reason = field("reason");
  const who = field("who") || "They";
  try {
    switch (field("intent")) {
      case "promoteOwner":
        await api.admin.groups.promoteOwner({ groupId, userId: field("userId"), reason });
        return { ok: true, message: `${who} is now an owner.` };
      case "changeRole": {
        const role = field("role") as "admin" | "caretaker" | "viewer";
        await api.admin.groups.changeRole({ groupId, userId: field("userId"), role, reason });
        return { ok: true, message: `${who} is now ${groupRoleLabel(role).toLowerCase()}.` };
      }
      case "removeMember":
        await api.admin.groups.removeMember({ groupId, userId: field("userId"), reason });
        return { ok: true, message: `${who} is no longer in the group.` };
      case "inviteOwner": {
        const sent = await api.admin.groups.inviteOwner({ groupId, email: field("email"), reason });
        return { ok: true, message: `Sent an owner invite to ${sent.email}.` };
      }
      default:
        return { ok: false, error: "That isn't something this page does.", issues: [] };
    }
  } catch (e) {
    return adminFailure(e);
  }
}

export default function Group({ loaderData, actionData }: Route.ComponentProps) {
  const { group, audit, auditCount, canManage } = loaderData;
  const owners = group.members.filter((m) => m.role === "owner").length;
  return (
    <>
      <section className="card bg-base-100 shadow-sm" aria-labelledby="group" data-admin-group={group.id}>
        <div className="card-body gap-3">
          <Link to={adminUrls.groups()} className="link text-sm">
            All groups
          </Link>
          <h1 id="group" className="card-title">
            {group.name}
          </h1>
          {owners === 0 && (
            <p className="alert alert-warning alert-soft text-sm" data-no-owner="">
              This group has no owner, so nobody can manage it.
              {canManage && " Make a member an owner, or invite one."}
            </p>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-group-facts="">
            <dt className="text-base-content/70">Care recipient</dt>
            <dd>{recipientLabel(group)}</dd>
            <dt className="text-base-content/70">Created</dt>
            <dd>{dayText(group.createdAt)}</dd>
            <dt className="text-base-content/70">Last activity</dt>
            <dd data-last-activity="">{dayText(group.lastActivityAt)}</dd>
            <dt className="text-base-content/70">Holds</dt>
            <dd data-counts="">
              {countText(group.counts.entries, "entry", "entries")},{" "}
              {countText(group.counts.providers, "provider", "providers")},{" "}
              {countText(group.counts.medications, "medication", "medications")}
            </dd>
          </dl>
          <p className="text-base-content/70 text-xs">
            Staff never see a group's care data, only these counts.
          </p>
        </div>
      </section>

      {actionData &&
        (actionData.ok ? (
          <p role="status" className="alert alert-success alert-soft text-sm" data-admin-result="ok">
            {actionData.message}
          </p>
        ) : (
          <p role="alert" className="alert alert-error alert-soft text-sm" data-admin-result="error">
            {actionData.issues.length ? actionData.issues.map((i) => i.message).join(" ") : actionData.error}
          </p>
        ))}

      <section className="card bg-base-100 shadow-sm" aria-labelledby="members">
        <div className="card-body gap-2">
          <h2 id="members" className="card-title">
            Members
          </h2>
          {group.members.length === 0 ? (
            <p className="text-sm">No members.</p>
          ) : (
            <MemberList members={group.members} groupName={group.name} canManage={canManage} />
          )}
        </div>
      </section>

      {canManage && <InviteOwnerForm result={actionData} />}

      <section className="card bg-base-100 shadow-sm" aria-labelledby="group-audit">
        <div className="card-body gap-2">
          <h2 id="group-audit" className="card-title">
            Staff activity
          </h2>
          {audit.length === 0 ? <p className="text-sm">Nothing yet.</p> : <AuditEntryList entries={audit} />}
          {auditCount > audit.length && (
            <Link to={adminUrls.audit(auditSearch({ target: group.id }))} className="link text-sm">
              All {auditCount.toLocaleString("en-US")} entries in the audit log
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
