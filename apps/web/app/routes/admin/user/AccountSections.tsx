import type { ApiOutputs } from "~/lib/core/rpc";

import { Link } from "react-router";
import { EmptyState, LINK, List, ListRow } from "~/components/ui";
import { AdminCard } from "../AdminCard";
import { AccountBadges } from "../AccountBadges";
import { deviceLabel } from "~/lib/auth/deviceLabel";
import { groupRoleLabel } from "@caretook/data/permissions";
import { adminDay, adminTime, mailStatusLabel, staffRoleLabel } from "../accountDisplay";
import { adminUrls } from "../adminUrls";
import { HelpAction } from "./HelpAction";

// The regions of an account's page: the account and how it signs in, its
// sessions, its groups and the mail sent to it. Help controls only for
// staff with `users.help`. Nothing here is a group's care data.

type AccountPage = ApiOutputs["admin"]["users"]["get"];

const person = (p: { name: string | null; email: string | null }) =>
  p.name ? `${p.name} (${p.email ?? "no email"})` : (p.email ?? "Deleted account");

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <AdminCard id={id} title={title} titleSize="base" data-user-section={id}>
      {children}
    </AdminCard>
  );
}

export function AccountSection({ page, canHelp }: { page: AccountPage; canHelp: boolean }) {
  const { account, signIn } = page;
  const methods = [signIn.password && "Password", signIn.emailed && "Emailed link or code"].filter(Boolean);
  return (
    <AdminCard
      id="account"
      level={1}
      titleClassName="break-all"
      title={account.name || account.email}
      data-user-section="account"
    >
      <AccountBadges account={{ ...account, disabled: account.disabledAt !== null }} />
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted">Email</dt>
        <dd className="break-all" data-account-email="">
          {account.email}
        </dd>
        <dt className="text-muted">Role</dt>
        <dd>{staffRoleLabel(account.role) ?? "Member"}</dd>
        <dt className="text-muted">Created</dt>
        <dd>{adminDay(account.createdAt)}</dd>
        <dt className="text-muted">Signs in with</dt>
        <dd>{methods.join(", ")}</dd>
        <dt className="text-muted">Last sign-in</dt>
        <dd>{signIn.lastSignInAt ? adminTime(signIn.lastSignInAt) : "No active session"}</dd>
        {account.disabledAt && (
          <>
            <dt className="text-muted">Disabled</dt>
            <dd>
              {adminTime(account.disabledAt)}
              {account.disabledBy && ` by ${person(account.disabledBy)}`}
              {account.disabledReason && `: ${account.disabledReason}`}
            </dd>
          </>
        )}
      </dl>
      {/* A disabled account gets no email (slice 3): re-enable it first. */}
      {canHelp && !account.disabledAt && (
        <div className="flex flex-wrap gap-2" data-help-actions="">
          {!account.emailVerified && <HelpAction intent="resendVerification" />}
          <HelpAction intent="sendReset" />
        </div>
      )}
    </AdminCard>
  );
}

export function SessionsSection({ page, canHelp }: { page: AccountPage; canHelp: boolean }) {
  return (
    <Card id="sessions" title="Sessions">
      {page.sessions.length === 0 ? (
        <EmptyState>Not signed in anywhere.</EmptyState>
      ) : (
        <>
          <List data-sessions="">
            {page.sessions.map((s) => (
              <ListRow
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-2"
                data-session={s.id}
              >
                <div className="text-sm">
                  <p className="font-medium" title={s.userAgent ?? undefined}>
                    {deviceLabel(s.userAgent)}
                  </p>
                  <p className="text-muted text-xs">
                    Signed in {adminTime(s.createdAt)} · last active {adminTime(s.lastActiveAt)}
                    {s.ipAddress && ` · ${s.ipAddress}`}
                  </p>
                </div>
                {canHelp && (
                  <HelpAction
                    intent="revokeSession"
                    sessionId={s.id}
                    label={`Sign out ${deviceLabel(s.userAgent)}, signed in ${adminTime(s.createdAt)}`}
                    variant="ghost"
                  />
                )}
              </ListRow>
            ))}
          </List>
          {canHelp && <HelpAction intent="revokeAllSessions" />}
        </>
      )}
    </Card>
  );
}

export function GroupsSection({ page }: { page: AccountPage }) {
  return (
    <Card id="groups" title="Care groups">
      {page.groups.length === 0 ? (
        <EmptyState>Not in any care group.</EmptyState>
      ) : (
        <List data-groups="">
          {page.groups.map((g) => (
            <ListRow key={g.groupId} className="text-sm" data-group={g.groupId}>
              <Link to={adminUrls.group(g.groupId)} className={`${LINK} font-medium`}>
                {g.displayName}
              </Link>
              {g.displayName !== g.groupName && <span className="text-muted"> · {g.groupName}</span>}
              <p className="text-muted text-xs">
                {groupRoleLabel(g.role)} · joined {adminDay(g.joinedAt)}
                {g.invitedBy && ` · invited by ${person(g.invitedBy)}`}
              </p>
            </ListRow>
          ))}
        </List>
      )}
    </Card>
  );
}

export function MailSection({ page }: { page: AccountPage }) {
  return (
    <Card id="mail" title="Recent mail">
      <p className="text-muted text-xs">The latest 20 emails to this address. Never their content.</p>
      {page.mail.length === 0 ? (
        <EmptyState>No email sent to this address.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-sm table" data-mail="">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Queued</th>
                <th>Sent</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {page.mail.map((m) => (
                <tr key={m.id} data-mail-row={m.template} data-status={m.status}>
                  <td className="font-mono">{m.template}</td>
                  <td>
                    {mailStatusLabel(m.status)}
                    {m.attempts > 1 && ` (${m.attempts} tries)`}
                  </td>
                  <td className="whitespace-nowrap">{adminTime(m.queuedAt)}</td>
                  <td className="whitespace-nowrap">{adminTime(m.sentAt)}</td>
                  <td className="font-mono">{m.errorCode ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
