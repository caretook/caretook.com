import type { ConnectorScope } from "@caretook/data/schema";

import { isManagerRole, isOwnerRole } from "@caretook/data/permissions";
import { CONNECTOR_READ_ONLY_BY_OWNER_LABEL, CONNECTOR_SCOPE_LABELS } from "@caretook/data/schema";

// Group settings → Assistants' pure parts (connectors PRD): who sees what,
// and the page's wording. The server stays the authority.

/** What a member with `role` gets on the page: the switch (owners) and the group's connections (owners and admins). */
export const assistantsAccess = (role: string | null) => ({
  toggle: isOwnerRole(role),
  manage: isManagerRole(role),
});

export const OFFLINE_ASSISTANTS = "Needs a connection to change Assistants or see who's connected.";

/** What assistants do here: while the group is read only, they don't add entries. */
export const assistantsExplained = (readOnly: boolean) =>
  `Members can connect their own AI assistant, such as Claude or ChatGPT, to read this care group${
    readOnly ? "" : " and add entries for them"
  }. What an assistant reads goes to the company that makes it, under that company's terms.`;

export const READ_ONLY_HELP =
  "Assistants can read this care group but not add to it. No one is disconnected, and turning this off lets connections approved for writing write again.";

/** The status line for whoever can't change the switch. */
export const assistantsStatus = (enabled: boolean, canToggle: boolean) =>
  enabled
    ? "Assistants are on for this care group."
    : canToggle
      ? "Assistants are off for this care group."
      : "Assistants are off for this care group. Only an owner can turn them on.";

/** The confirm before turning the switch off: how many it disconnects, and that on again restores none. */
export const turnOffMessage = (connected: number) =>
  `${
    connected === 0
      ? "No assistants are connected now."
      : connected === 1
        ? "Disconnects 1 assistant."
        : `Disconnects ${connected} assistants.`
  } Turning it back on reconnects no one: each member connects and agrees again.`;

/** A connection's scope as plain words. */
export const scopeLabel = (scope: string) => CONNECTOR_SCOPE_LABELS[scope as ConnectorScope] ?? scope;

/** A connection's line: the owner's read-only setting when that's why it can only read, else its scope. */
export const connectionScopeLabel = (c: { scope: string; readOnlyByOwner: boolean }) =>
  c.readOnlyByOwner ? CONNECTOR_READ_ONLY_BY_OWNER_LABEL : scopeLabel(c.scope);

/** The form's posts: the switch, the read-only choice, or disconnecting one connection. */
export type AssistantsIntent =
  | { intent: "setEnabled"; enabled: boolean }
  | { intent: "setReadOnly"; readOnly: boolean }
  | { intent: "disconnect"; id: string };

export const assistantsIntent = (form: FormData): AssistantsIntent | null => {
  const intent = form.get("intent");
  if (intent === "setEnabled") {
    const enabled = form.get("enabled");
    if (enabled === "on" || enabled === "off") return { intent, enabled: enabled === "on" };
  }
  if (intent === "setReadOnly") {
    const readOnly = form.get("readOnly");
    if (readOnly === "on" || readOnly === "off") return { intent, readOnly: readOnly === "on" };
  }
  const id = form.get("id");
  if (intent === "disconnect" && typeof id === "string" && id) return { intent, id };
  return null;
};
