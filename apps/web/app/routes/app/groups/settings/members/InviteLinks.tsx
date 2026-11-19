import type { InviteActionResult } from "./inviteApi";
import type { LinkActionResult } from "./linkApi";
import type { InviteOptions, LinkRow, ShareOutcome } from "./linkRules";

import { Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog, Field, Sheet } from "~/components/ui";
import { accountUrls } from "~/lib/accountUrls";
import { rpc } from "~/lib/rpc";
import { roleLabel } from "../groupSettings";
import {
  copyLinkText,
  DEFAULT_INVITE_OPTIONS,
  inviteLinkUrl,
  INVITES_UNAVAILABLE,
  LINK_TTL_MIN_DAYS,
  linkActive,
  linkRoles,
  linkStatusLine,
  shareLinkText,
} from "./linkRules";

// The Members page's invite links (owners and admins, online): "Create a
// link" (a role of caretaker or viewer, how long it works, and an optional
// number of uses) and the list of links, each with Copy, Share, its uses
// and Revoke. Anyone with a link can ask to join; an owner or admin
// approves each request (JoinRequests).

const ROLE_HELP: Record<string, string> = {
  caretaker: "Reads and adds to the timeline.",
  viewer: "Reads only.",
};

export function CreateLinkButton({
  myRole,
  online,
  options = DEFAULT_INVITE_OPTIONS,
}: {
  myRole: string | null;
  online: boolean;
  /** Whether links are switched on, and the limits a new one follows (admin settings). */
  options?: InviteOptions;
}) {
  const limits = options.link;
  const roles = linkRoles(myRole);
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<LinkActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const created = result?.ok && result.created;

  // Made: close the sheet (once per result); the new link shows in the list.
  const [handled, setHandled] = useState<LinkActionResult | undefined>(undefined);
  if (created && result !== handled) {
    setHandled(result);
    setOpen(false);
  }

  if (!roles.length) return null;
  const issue = (path: string) =>
    result && !result.ok ? result.issues.find((i) => i.path === path)?.message : undefined;

  return (
    <div data-link-controls="" className="space-y-2">
      <button
        type="button"
        className="btn btn-sm"
        disabled={!online || !options.linkInvites}
        aria-describedby={online && !options.linkInvites ? "links-unavailable" : undefined}
        onClick={() => setOpen(true)}
      >
        <Link2 aria-hidden="true" className="size-4" />
        Create a link
      </button>
      {online && !options.linkInvites && (
        <p id="links-unavailable" className="text-base-content/70 text-sm">
          {INVITES_UNAVAILABLE.link}
        </p>
      )}
      {created && !open && (
        <p role="status" className="alert alert-success alert-soft text-sm">
          Link created. Copy or share it from Invite links below.
        </p>
      )}
      <Sheet isOpen={open} onOpenChange={setOpen} title="Create an invite link">
        <fetcher.Form method="post" className="space-y-2" data-link-sheet="">
          <input type="hidden" name="intent" value="createLink" />
          <p className="text-base-content/70 text-sm">
            Anyone with the link can ask to join. You or another owner or admin approves each request, and
            they see nothing until then.
          </p>
          <Field label="Role" error={issue("role")}>
            {(control) => (
              <select {...control} className="select w-full" name="role" defaultValue="viewer">
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}: {ROLE_HELP[role]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="Works for (days)"
            help={`${LINK_TTL_MIN_DAYS} to ${limits.maxDays} days.`}
            error={issue("expiresInDays")}
          >
            {(control) => (
              <input
                {...control}
                className="input w-full"
                type="number"
                inputMode="numeric"
                name="expiresInDays"
                min={LINK_TTL_MIN_DAYS}
                max={limits.maxDays}
                defaultValue={limits.defaultDays}
                required
              />
            )}
          </Field>
          <Field label="Most people who can use it" help="Leave empty for no limit." error={issue("maxUses")}>
            {(control) => (
              <input
                {...control}
                className="input w-full"
                type="number"
                inputMode="numeric"
                name="maxUses"
                min={1}
                max={limits.maxUses}
                placeholder="No limit"
              />
            )}
          </Field>
          {result && !result.ok && !result.issues.length && (
            <p role="alert" className="text-error text-sm">
              {result.error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Creating…" : "Create link"}
          </button>
        </fetcher.Form>
      </Sheet>
    </div>
  );
}

/** The group's links that haven't been revoked: active ones to copy or share, and closed ones to clear away. */
export function InviteLinks({ links, groupName }: { links: LinkRow[]; groupName: string }) {
  const [revoking, setRevoking] = useState<LinkRow | null>(null);
  const revokeFetcher = useFetcher<InviteActionResult>();
  const confirmRevoke = () => {
    if (!revoking) return;
    void revokeFetcher.submit({ intent: "revokeInvite", inviteId: revoking.id }, { method: "post" });
    setRevoking(null);
  };
  const revokeResult = revokeFetcher.state === "idle" ? revokeFetcher.data : undefined;

  return (
    <section
      aria-labelledby="invite-links-heading"
      data-invite-links=""
      className="card bg-base-100 shadow-sm"
    >
      <div className="card-body">
        <h2 id="invite-links-heading" className="card-title text-lg">
          Invite links
        </h2>
        {links.length ? (
          <ul className="divide-base-200 divide-y">
            {links.map((link) => (
              <InviteLink
                key={link.id}
                link={link}
                groupName={groupName}
                revoking={
                  revokeFetcher.state !== "idle" && revokeFetcher.formData?.get("inviteId") === link.id
                }
                onRevoke={() => setRevoking(link)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-base-content/70 text-sm">No links. Create one to share by text or chat.</p>
        )}
        {revokeResult && !revokeResult.ok && (
          <p role="alert" className="text-error text-sm">
            {revokeResult.error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={!!revoking}
        title="Revoke this invite link? It stops working at once, for everyone it was shared with."
        confirmLabel="Revoke"
        onConfirm={confirmRevoke}
        onClose={() => setRevoking(null)}
      />
    </section>
  );
}

/**
 * An active link's URL, fetched once it's on screen (`invite.copyLink`), so
 * Copy and Share run straight from the tap: browsers allow the share sheet
 * and the clipboard only within a tap.
 */
const useLinkUrl = (link: LinkRow) => {
  const active = linkActive(link);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active) return;
    let live = true;
    rpc.invite.copyLink({ id: link.id }).then(
      ({ token }) => {
        if (!live) return;
        // Native apps share the web link, not `capacitor://localhost`.
        const origin = import.meta.env.VITE_API_ORIGIN || window.location.origin;
        setUrl(inviteLinkUrl(origin, accountUrls.invite(token)));
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [active, link.id]);
  return { url, failed };
};

function InviteLink({
  link,
  groupName,
  revoking,
  onRevoke,
}: {
  link: LinkRow;
  groupName: string;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const active = linkActive(link);
  const { url, failed } = useLinkUrl(link);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const label = `${roleLabel(link.role)} link`;

  // "Link copied" fades after a moment; a failure stays so the link can be copied by hand.
  useEffect(() => {
    if (outcome !== "copied" && outcome !== "shared") return;
    const t = setTimeout(() => setOutcome(null), 2500);
    return () => clearTimeout(t);
  }, [outcome]);

  const copy = () => url && void copyLinkText(navigator, url).then(setOutcome);
  const share = () =>
    url &&
    void shareLinkText(navigator, {
      title: "Join our care group on Caretook",
      text: `Join ${groupName}'s care group on Caretook:`,
      url,
    }).then(setOutcome);

  return (
    <li
      data-invite-link={link.id}
      data-link-state={link.state}
      className="space-y-1 py-3 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link2 aria-hidden="true" className="text-base-content/60 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{label}</p>
          <p className="text-base-content/70 text-sm" data-link-uses="">
            {linkStatusLine(link)}
            {link.sentBy?.name ? ` · Made by ${link.sentBy.name}` : ""}
          </p>
        </div>
        {active && (
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!url || revoking}
              aria-label={`Copy the ${label.toLowerCase()}`}
              onClick={copy}
            >
              <Copy aria-hidden="true" className="size-4" />
              Copy
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!url || revoking}
              aria-label={`Share the ${label.toLowerCase()}`}
              onClick={share}
            >
              <Share2 aria-hidden="true" className="size-4" />
              Share
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={revoking}
          aria-label={`Revoke the ${label.toLowerCase()}`}
          onClick={onRevoke}
        >
          {revoking ? "Revoking…" : "Revoke"}
        </button>
      </div>
      <div role="status">
        {outcome === "copied" && <p className="text-success text-sm">Link copied.</p>}
        {outcome === "shared" && <p className="text-success text-sm">Link shared.</p>}
      </div>
      {outcome === "failed" && url && (
        <div className="text-sm">
          <p>Couldn't copy the link. Copy it here:</p>
          <input
            readOnly
            aria-label={`The ${label.toLowerCase()}`}
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="input input-sm mt-1 w-full"
          />
        </div>
      )}
      {failed && (
        <p role="alert" className="text-error text-sm">
          Couldn't load this link. Reload the page to try again.
        </p>
      )}
    </li>
  );
}
