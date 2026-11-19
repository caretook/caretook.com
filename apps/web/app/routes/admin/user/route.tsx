import type { Route } from "./+types/route";
import type { AdminActionResult } from "../adminForms";

import { ORPCError } from "@orpc/server";
import { Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminFailure } from "../adminForms";
import { adminUrls } from "../adminUrls";
import { AuditEntryList } from "../AuditEntryList";
import { auditSearch } from "../auditFilters";
import { AccountSection, GroupsSection, MailSection, SessionsSection } from "./AccountSections";
import { helpDoneMessage, parseHelpForm } from "./helpActions";

// /admin/users/:userId (admin PRD, slice 2): one account for staff: how it
// signs in, its sessions, its groups (each linking to the staff group
// page), recent mail by template and status, and its recent audit entries.
// Opening it records `user.view`. Staff with `users.help` (admin and
// support) can resend the confirmation email, send a password reset and
// sign sessions out, each with a reason. Never a group's care data.

export const meta = ({ loaderData }: Route.MetaArgs) => [
  { title: `${loaderData?.page.account.email ?? "Account"} · Caretook admin` },
  { name: "robots", content: "noindex" },
];

/** How many of the account's audit entries the page shows. */
const RECENT_ENTRIES = 10;

const notFound = () => new Response("Not found", { status: 404 });

export async function loader({ request, params }: Route.LoaderArgs) {
  const { api, capabilities } = await requireStaff(request, "users.read");
  try {
    const page = await api.admin.users.get({ userId: params.userId });
    const history = capabilities.includes("audit.read")
      ? await api.admin.audit.list({ target: page.account.id })
      : null;
    return {
      page,
      canHelp: capabilities.includes("users.help"),
      history: history ? { count: history.count, entries: history.entries.slice(0, RECENT_ENTRIES) } : null,
    };
  } catch (e) {
    // An unknown id, or one that isn't an id at all.
    if (e instanceof ORPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) throw notFound();
    throw e;
  }
}

export async function action({ request, params }: Route.ActionArgs): Promise<AdminActionResult> {
  const { api } = await requireStaff(request, "users.help");
  const help = parseHelpForm(await request.formData());
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

export default function UserPage({ loaderData }: Route.ComponentProps) {
  const { page, canHelp, history } = loaderData;
  return (
    <>
      <Link to={adminUrls.users()} className="link text-sm">
        All users
      </Link>
      <AccountSection page={page} canHelp={canHelp} />
      <SessionsSection page={page} canHelp={canHelp} />
      <GroupsSection page={page} />
      <MailSection page={page} />
      {history && (
        <section className="card bg-base-100 shadow-sm" aria-labelledby="history" data-user-section="history">
          <div className="card-body gap-3">
            <h2 id="history" className="card-title text-base">
              Audit log
            </h2>
            {history.entries.length === 0 ? (
              <p className="text-sm">Nothing yet.</p>
            ) : (
              <AuditEntryList entries={history.entries} />
            )}
            {history.count > history.entries.length && (
              <Link to={adminUrls.audit(auditSearch({ target: page.account.id }))} className="link text-sm">
                All {history.count.toLocaleString("en-US")} entries
              </Link>
            )}
          </div>
        </section>
      )}
    </>
  );
}
