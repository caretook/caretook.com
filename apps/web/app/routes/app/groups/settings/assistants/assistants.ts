import type { ConnectorScope } from "@caretook/data/schema";

import { CONNECTOR_SCOPE_LABELS } from "@caretook/data/schema";

// Group settings → Assistants' pure parts (connectors PRD): who sees what,
// and the page's wording. The server stays the authority.

/** What a member with `role` gets on the page: the switch (owners) and the group's connections (owners and admins). */
export const assistantsAccess = (role: string | null) => ({
  toggle: role === "owner",
  manage: role === "owner" || role === "admin",
});

export const OFFLINE_ASSISTANTS = "Needs a connection to change Assistants or see who's connected.";

export const ASSISTANTS_EXPLAINED =
  "Members can connect their own AI assistant, such as Claude or ChatGPT, to read this care group and add entries for them. What an assistant reads goes to the company that makes it, under that company's terms.";

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

/** The form's posts: the switch, or disconnecting one connection. */
export type AssistantsIntent =
  { intent: "setEnabled"; enabled: boolean } | { intent: "disconnect"; id: string };

export const assistantsIntent = (form: FormData): AssistantsIntent | null => {
  const intent = form.get("intent");
  if (intent === "setEnabled") {
    const enabled = form.get("enabled");
    if (enabled === "on" || enabled === "off") return { intent, enabled: enabled === "on" };
  }
  const id = form.get("id");
  if (intent === "disconnect" && typeof id === "string" && id) return { intent, id };
  return null;
};
