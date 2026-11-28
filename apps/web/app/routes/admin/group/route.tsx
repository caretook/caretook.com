import { BackLink, EmptyState, LINK, Notice } from "~/components/ui";
import { AdminCard } from "../AdminCard";
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
import { groupRoleLabel } from "@caretook/data/permissions";
import { countText, dayText, recipientLabel } from "../groupDisplay";
import { InviteOwnerForm } from "./InviteOwnerForm";
import { MemberList } from "./MemberList";
import type { StaffSettableGroupRole } from "@caretook/data/domain";

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
        const role = field("role") as StaffSettableGroupRole;
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
      <BackLink to={adminUrls.groups()} label="All groups" />
      <AdminCard id="group" level={1} title={group.name} data-admin-group={group.id}>
        {owners === 0 && (
          <Notice tone="warning" data-no-owner="">
            This group has no owner, so nobody can manage it.
            {canManage && " Make a member an owner, or invite one."}
          </Notice>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-group-facts="">
          <dt className="text-muted">Care recipient</dt>
          <dd>{recipientLabel(group)}</dd>
          <dt className="text-muted">Created</dt>
          <dd>{dayText(group.createdAt)}</dd>
          <dt className="text-muted">Last activity</dt>
          <dd data-last-activity="">{dayText(group.lastActivityAt)}</dd>
          <dt className="text-muted">Holds</dt>
          <dd data-counts="">
            {countText(group.counts.entries, "entry", "entries")},{" "}
            {countText(group.counts.providers, "provider", "providers")},{" "}
            {countText(group.counts.medications, "medication", "medications")}
          </dd>
        </dl>
        <p className="text-muted text-xs">Staff never see a group's care data, only these counts.</p>
      </AdminCard>

      {actionData &&
        (actionData.ok ? (
          <Notice tone="success" data-admin-result="ok">
            {actionData.message}
          </Notice>
        ) : (
          <Notice tone="error" data-admin-result="error">
            {actionData.issues.length ? actionData.issues.map((i) => i.message).join(" ") : actionData.error}
          </Notice>
        ))}

      <AdminCard id="members" title="Members">
        {group.members.length === 0 ? (
          <EmptyState>No members.</EmptyState>
        ) : (
          <MemberList members={group.members} groupName={group.name} canManage={canManage} />
        )}
      </AdminCard>

      {canManage && <InviteOwnerForm result={actionData} />}

      <AdminCard id="group-audit" title="Staff activity">
        {audit.length === 0 ? <EmptyState>Nothing yet.</EmptyState> : <AuditEntryList entries={audit} />}
        {auditCount > audit.length && (
          <Link to={adminUrls.audit(auditSearch({ target: group.id }))} className={`${LINK} text-sm`}>
            All {auditCount.toLocaleString("en-US")} entries in the audit log
          </Link>
        )}
      </AdminCard>
    </>
  );
}
