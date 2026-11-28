import { BackLink, EmptyState, LINK } from "~/components/ui";
import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { ORPCError } from "@orpc/server";
import { Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminFailure } from "../adminForms";
import { adminUrls } from "../adminUrls";
import { AuditEntryList } from "../AuditEntryList";
import { auditSearch } from "../auditFilters";
import { AccountAdminActions } from "./AccountAdminActions";
import { AccountSection, GroupsSection, MailSection, SessionsSection } from "./AccountSections";
import {
  ACCOUNT_ACTION_CAPABILITY,
  accountActionDoneMessage,
  parseAccountActionForm,
} from "./accountActions";
import { helpDoneMessage, parseHelpForm } from "./helpActions";

// /admin/users/:userId (admin PRD, slice 2): one account for staff: how it
// signs in, its sessions, its groups (each linking to the staff group
// page), recent mail by template and status, and its recent audit entries.
// Opening it records `user.view`. Staff with `users.help` (admin and
// support) can resend the confirmation email, send a password reset and
// sign sessions out, each with a reason. Admins (slice 3) can also disable
// and re-enable it and change its staff role, never their own. The Groups
// section shows how many groups it started against its limit (free-limits
// PRD); staff with `users.limits` (admin and support) can change that limit,
// with a reason. Never a group's care data.

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `${loaderData?.page.account.email ?? "Account"} · Caretook admin` },
  { name: "robots", content: "noindex" },
];

/** How many of the account's audit entries the page shows. */
const RECENT_ENTRIES = 10;

const notFound = () => new Response("Not found", { status: 404 });

export async function loader({ request, params }: Route.LoaderArgs) {
  const { api, authUser, capabilities } = await requireStaff(request, "users.read");
  try {
    const page = await api.admin.users.get({ userId: params.userId });
    const groupLimit = await api.admin.users.groupLimit({ userId: page.account.id });
    const history = capabilities.includes("audit.read")
      ? await api.admin.audit.list({ target: page.account.id })
      : null;
    return {
      page,
      groupLimit,
      canHelp: capabilities.includes("users.help"),
      canDisable: capabilities.includes("users.disable"),
      canSetRole: capabilities.includes("users.setRole"),
      canSetLimit: capabilities.includes("users.limits"),
      isSelf: authUser.id === page.account.id,
      history: history ? { count: history.count, entries: history.entries.slice(0, RECENT_ENTRIES) } : null,
    };
  } catch (e) {
    // An unknown id, or one that isn't an id at all.
    if (e instanceof ORPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) throw notFound();
    throw e;
  }
}

export async function action({ request, params }: Route.ActionArgs): Promise<AdminActionResult> {
  const form = await request.formData();
  const admin = parseAccountActionForm(form);
  if (admin) return accountAction(request, params.userId, admin);
  const { api } = await requireStaff(request, "users.help");
  const help = parseHelpForm(form);
  if (!help) return { ok: false, error: "Something went wrong. Reload and try again.", issues: [] };
  const target = { userId: params.userId, reason: help.reason };
  try {
    let revoked: number | undefined;
    if (help.intent === "resendVerification") await api.admin.users.resendVerification(target);
    else if (help.intent === "sendReset") await api.admin.users.sendReset(target);
    else if (help.intent === "revokeSession")
      await api.admin.users.revokeSession({ ...target, sessionId: help.sessionId ?? "" });
    else revoked = (await api.admin.users.revokeAllSessions(target)).revoked;
    return { ok: true, message: helpDoneMessage(help.intent, revoked) };
  } catch (e) {
    return adminFailure(e);
  }
}

/** Disable, re-enable or a staff role (admins only), or the care group limit (`users.limits`). */
async function accountAction(
  request: Request,
  userId: string,
  req: NonNullable<ReturnType<typeof parseAccountActionForm>>,
): Promise<AdminActionResult> {
  const { api } = await requireStaff(request, ACCOUNT_ACTION_CAPABILITY[req.intent]);
  const target = { userId, reason: req.reason };
  try {
    if (req.intent === "disable") {
      const { revoked } = await api.admin.users.disable(target);
      return { ok: true, message: accountActionDoneMessage("disable", { revoked }) };
    }
    if (req.intent === "enable") {
      await api.admin.users.enable(target);
      return { ok: true, message: accountActionDoneMessage("enable") };
    }
    if (req.intent === "setGroupLimit") {
      const result = await api.admin.users.setGroupLimit({ ...target, limit: req.limit ?? null });
      return { ok: true, message: accountActionDoneMessage("setGroupLimit", result) };
    }
    const { role } = await api.admin.users.setRole({ ...target, role: req.role ?? "" });
    return { ok: true, message: accountActionDoneMessage("setRole", { role }) };
  } catch (e) {
    return adminFailure(e);
  }
}

export default function UserPage({ loaderData }: Route.ComponentProps) {
  const { page, groupLimit, canHelp, canDisable, canSetRole, canSetLimit, isSelf, history } = loaderData;
  return (
    <>
      <BackLink to={adminUrls.users()} label="All users" />
      <AccountSection page={page} canHelp={canHelp} />
      <AccountAdminActions
        account={page.account}
        canDisable={canDisable}
        canSetRole={canSetRole}
        isSelf={isSelf}
      />
      <SessionsSection page={page} canHelp={canHelp} />
      <GroupsSection page={page} groupLimit={groupLimit} canSetLimit={canSetLimit} />
      <MailSection page={page} />
      {history && (
        <AdminCard id="history" titleSize="base" title="Audit log" data-user-section="history">
          {history.entries.length === 0 ? (
            <EmptyState>Nothing yet.</EmptyState>
          ) : (
            <AuditEntryList entries={history.entries} />
          )}
          {history.count > history.entries.length && (
            <Link
              to={adminUrls.audit(auditSearch({ target: page.account.id }))}
              className={`${LINK} text-sm`}
            >
              All {history.count.toLocaleString("en-US")} entries
            </Link>
          )}
        </AdminCard>
      )}
    </>
  );
}
