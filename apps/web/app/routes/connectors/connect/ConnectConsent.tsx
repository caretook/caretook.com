import type { ReactNode } from "react";
import type { ConnectGroup, ConnectSuccessData, OffGroup } from "~/.server/connectors";
import type { ConnectorScope } from "@caretook/data/schema";

import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import {
  CONNECTOR_CONSENT_TEXT,
  CONNECTOR_READ_ONLY_BY_OWNER_LABEL,
  CONNECTOR_SCOPE_LABELS,
} from "@caretook/data/schema";
import { AskOwners } from "~/components/connectors/ask";
import { Button, Card, CheckField, ChoiceGroup, LINK, Message, Notice } from "~/components/ui/plain";
import { appUrls } from "~/lib/app-shell/appUrls";
import {
  CONNECT_RETURN_DELAY_MS,
  CONNECT_SUCCESS_EXAMPLES,
  returningNote,
  returnLabel,
} from "~/lib/connectors/connectSuccess";

// /connect's parts: the card, the consent form, its two dead ends, and the
// success step.

export function ConnectCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </Card>
    </main>
  );
}

/** Cancel: back to the assistant, nothing connected. */
function CancelButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button type="submit" name="intent" value="cancel" formNoValidate variant="ghost" disabled={disabled}>
      Cancel
    </Button>
  );
}

export function ConnectInvalid() {
  return (
    <ConnectCard title="This link has expired">
      <p className="text-sm">
        Start connecting again from your assistant. The request is good for 10 minutes.
      </p>
    </ConnectCard>
  );
}

const groupLabel = (group: { name: string; recipientName: string | null }) =>
  group.recipientName && group.recipientName !== group.name
    ? `${group.name} (${group.recipientName})`
    : group.name;

/**
 * None of the member's groups allow assistants: each group with the switch
 * off, where a member who isn't an owner asks its owners (connectors-2) and
 * an owner gets a link to turn it on.
 */
export function NoEligibleGroups({ offGroups }: { offGroups: OffGroup[] }) {
  return (
    <Form method="post" className="space-y-4" data-no-groups="">
      <Notice>
        None of your care groups allow assistants yet. Ask a group’s owner to turn on Assistants in the
        group’s settings, then connect again.
      </Notice>
      {offGroups.length > 0 && (
        <ul className="divide-base-300 divide-y">
          {offGroups.map((group) => (
            <li key={group.id} className="space-y-2 py-3" data-off-group={group.id}>
              <p className="font-medium">{groupLabel(group)}</p>
              {group.role === "owner" ? (
                <p className="text-sm">
                  You’re an owner:{" "}
                  <a href={appUrls.groupSettings(group.id, "assistants")} className={LINK}>
                    turn on Assistants
                  </a>
                  , then connect again.
                </p>
              ) : (
                <AskOwners groupId={group.id} askedAt={group.askedAt} />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <CancelButton />
      </div>
    </Form>
  );
}

/**
 * Pick one group, what the assistant may do there (a viewer reads only),
 * and agree; Connect stays disabled until the consent is ticked.
 */
export function ConnectConsent({ groups, error }: { groups: ConnectGroup[]; error?: string }) {
  const [groupId, setGroupId] = useState(groups[0]!.id);
  const group = groups.find((g) => g.id === groupId) ?? groups[0]!;
  const widest = group.scopes.at(-1) ?? "read";
  const [picked, setPicked] = useState<ConnectorScope>("read");
  const scope = group.scopes.includes(picked) ? picked : "read";
  const [agreed, setAgreed] = useState(false);
  const busy = useNavigation().state !== "idle";

  return (
    <Form method="post" className="space-y-4" data-connect-form="">
      <ChoiceGroup
        name="groupId"
        label="Care group"
        options={groups.map((g) => ({ value: g.id, label: groupLabel(g) }))}
        value={group.id}
        onChange={setGroupId}
      />
      <ChoiceGroup
        name="scope"
        label="The assistant may"
        options={group.scopes.map((s) => ({ value: s, label: CONNECTOR_SCOPE_LABELS[s] }))}
        value={scope}
        onChange={setPicked}
      />
      {widest === "read" && (
        <p className="text-muted text-sm" data-read-only="">
          {group.readOnlyByOwner
            ? CONNECTOR_READ_ONLY_BY_OWNER_LABEL
            : group.role === "viewer"
              ? "As a viewer in this group, you can connect for reading only."
              : "This assistant asked only to read."}
        </p>
      )}
      <CheckField
        className="text-sm"
        name="consent"
        checked={agreed}
        onChange={(e) => setAgreed(e.currentTarget.checked)}
        label={CONNECTOR_CONSENT_TEXT}
      />
      {error && <Message tone="error">{error}</Message>}
      <div className="flex justify-end gap-2">
        <CancelButton disabled={busy} />
        <Button
          type="submit"
          name="intent"
          value="connect"
          variant="primary"
          disabled={!agreed}
          busy={busy}
          busyLabel="Connecting…"
        >
          Connect
        </Button>
      </div>
    </Form>
  );
}

/**
 * Back to the assistant, with the code. A plain navigation: CSP's
 * `form-action 'self'` would block a form's redirect to another origin, so
 * the action answers with the URL and the page goes there. An object, so the
 * component tests can stand in for it.
 */
export const connectReturn = {
  go: (url: string) => window.location.assign(url),
};

/**
 * After Connect: what was connected, three things to ask first, and Return.
 * It returns on its own after a few seconds; Return goes at once.
 */
export function ConnectSuccess({ connected }: { connected: ConnectSuccessData }) {
  const [returning, setReturning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { redirect, clientName } = connected;

  const goBack = () => {
    clearTimeout(timer.current);
    setReturning(true);
    connectReturn.go(redirect);
  };

  useEffect(() => {
    timer.current = setTimeout(() => {
      setReturning(true);
      connectReturn.go(redirect);
    }, CONNECT_RETURN_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [redirect]);

  return (
    <div className="space-y-4" data-connect-success="">
      <p className="text-sm">Try asking {clientName}:</p>
      <ul className="list-disc space-y-1 pl-5 text-sm" data-connect-examples="">
        {CONNECT_SUCCESS_EXAMPLES.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
      <p role="status" className="text-muted text-sm">
        {returning ? `Returning to ${clientName}…` : returningNote(clientName)}
      </p>
      <div className="flex justify-end">
        <Button variant="primary" onClick={goBack} disabled={returning}>
          {returnLabel(clientName)}
        </Button>
      </div>
    </div>
  );
}
