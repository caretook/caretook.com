import type { ReactNode } from "react";
import type { ConnectGroup, ConnectSuccessData } from "~/.server/connectors";
import type { ConnectorScope } from "@caretook/data/schema";

import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { CONNECTOR_CONSENT_TEXT, CONNECTOR_SCOPE_LABELS } from "@caretook/data/schema";
import { ChoiceGroup } from "~/components/ui/plain";
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
      <div className="card bg-base-100 w-full max-w-md shadow-md">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

/** Cancel: back to the assistant, nothing connected. */
function CancelButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      type="submit"
      name="intent"
      value="cancel"
      formNoValidate
      className="btn btn-ghost"
      disabled={disabled}
    >
      Cancel
    </button>
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

/** None of the member's groups allow assistants: say who can change that. */
export function NoEligibleGroups() {
  return (
    <Form method="post" className="space-y-4" data-no-groups="">
      <p role="status" className="alert alert-info alert-soft text-sm">
        None of your care groups allow assistants yet. Ask a group’s owner to turn on Assistants in the
        group’s settings, then connect again.
      </p>
      <div className="flex justify-end">
        <CancelButton />
      </div>
    </Form>
  );
}

const groupLabel = (group: ConnectGroup) =>
  group.recipientName && group.recipientName !== group.name
    ? `${group.name} (${group.recipientName})`
    : group.name;

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
        <p className="text-base-content/70 text-sm" data-read-only="">
          {group.role === "viewer"
            ? "As a viewer in this group, you can connect for reading only."
            : "This assistant asked only to read."}
        </p>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="consent"
          className="checkbox checkbox-sm mt-0.5"
          checked={agreed}
          onChange={(e) => setAgreed(e.currentTarget.checked)}
        />
        <span>{CONNECTOR_CONSENT_TEXT}</span>
      </label>
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <CancelButton disabled={busy} />
        <button
          type="submit"
          name="intent"
          value="connect"
          className="btn btn-primary"
          disabled={!agreed || busy}
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
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
      <p role="status" className="text-base-content/70 text-sm">
        {returning ? `Returning to ${clientName}…` : returningNote(clientName)}
      </p>
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={goBack} disabled={returning}>
          {returnLabel(clientName)}
        </button>
      </div>
    </div>
  );
}
