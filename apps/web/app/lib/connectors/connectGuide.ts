// The connect guide's wording (connectors-2, B-193): the address a member
// gives their own AI assistant, the short steps for Claude and for ChatGPT,
// each vendor's help page, and the notes for a switch that's off and for a
// viewer. Pure and client-safe. All vendor wording lives here, so the
// runbook's connector check (by hand, before launch) has one place to fix
// when a menu moves.

/**
 * The MCP server's address: the API's origin (`VITE_API_ORIGIN`, the web
 * origin in the native app) or else this page's, plus `/mcp`.
 */
export const mcpUrl = (apiOrigin: string | undefined, pageOrigin: string) =>
  `${(apiOrigin || pageOrigin).replace(/\/+$/, "")}/mcp`;

export type ConnectClient = {
  id: "claude" | "chatgpt";
  name: string;
  steps: readonly string[];
  help: { label: string; href: string };
};

/** The two assistants the guide covers, in the order it shows them. */
export const CONNECT_CLIENTS: readonly ConnectClient[] = [
  {
    id: "claude",
    name: "Claude",
    steps: [
      "In Claude, open Settings, then Connectors.",
      "Choose Add custom connector, name it Caretook and paste the address above.",
      "Choose Connect, sign in to Caretook, pick the care group and agree.",
      "In a chat, turn Caretook on from the tools menu and ask away.",
    ],
    help: {
      label: "Claude's help on custom connectors",
      href: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp",
    },
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    steps: [
      "In ChatGPT on the web, open Settings, then Apps & Connectors, and turn on Developer mode under Advanced settings.",
      "Choose Create, name it Caretook, paste the address above and choose OAuth.",
      "Sign in to Caretook, pick the care group and agree.",
      "In a chat, add Caretook from the + menu and ask away.",
    ],
    help: {
      label: "ChatGPT's help on connectors",
      href: "https://help.openai.com/en/articles/11487775-connectors-in-chatgpt",
    },
  },
];

export const GUIDE_INTRO =
  "Give your assistant this address, then follow the steps for yours. Menus change now and then: each help page has the current steps.";

/** Where the guide is: one group's Assistants page, or Settings → Devices (every group). */
export type GuidePlace = "group" | "account";

/** One of the member's groups, as far as the guide cares: their role and the group's switch. */
export type GuideGroup = { role: string | null; enabled: boolean };

export type GuideView =
  /** No group allows assistants: the off note instead of the address and steps. */
  | { show: "off"; note: string }
  /** The address and steps, with the viewer note when it applies. */
  | { show: "steps"; viewerNote: string | null };

export const OFF_NOTE = {
  owner: "Assistants are off for this care group. Turn them on above, then connect yours.",
  member:
    "Assistants are off for this care group, so a connection won't work yet. Only an owner can turn them on.",
  account:
    "None of your care groups allows assistants yet, so a connection won't work. An owner turns them on in Group settings → Assistants.",
} as const;

export const VIEWER_NOTE = {
  group: "You're a viewer here, so your assistant can read this care group but can't add anything to it.",
  /** Every group that allows assistants has the member as a viewer. */
  account:
    "You're a viewer in the care groups that allow assistants, so your assistant can read but can't add anything.",
  /** Some of those groups have the member as a viewer. */
  some: "Where you're a viewer, your assistant can read but can't add anything.",
} as const;

/**
 * What the guide shows. On a group's page, `groups` is that one group and
 * `canToggle` says whether the member is an owner (they get the switch
 * above). On Devices, `groups` is every group the member is in.
 */
export const guideView = (place: GuidePlace, groups: readonly GuideGroup[], canToggle = false): GuideView => {
  const on = groups.filter((g) => g.enabled && g.role);
  if (on.length === 0)
    return {
      show: "off",
      note: place === "account" ? OFF_NOTE.account : canToggle ? OFF_NOTE.owner : OFF_NOTE.member,
    };
  const viewers = on.filter((g) => g.role === "viewer").length;
  const viewerNote =
    viewers === 0
      ? null
      : place === "group"
        ? VIEWER_NOTE.group
        : viewers === on.length
          ? VIEWER_NOTE.account
          : VIEWER_NOTE.some;
  return { show: "steps", viewerNote };
};

export const COPIED = "Copied";
export const COPY_FAILED = "Couldn't copy. Select the address above and copy it by hand.";

// Asking the owners to turn assistants on (connectors-2, B-194): beside the
// off note, for members who aren't owners. A member may ask once a week per
// group (ASSISTANT_REQUEST_WINDOW_DAYS); until then the button reads "Asked on
// <date>".

export const ASK_OWNERS = "Ask owners to turn this on";
export const ASKING_OWNERS = "Asking…";
export const ASKED_NOTE = "The owners got an email. You can ask again after a week.";
export const ASK_OFFLINE = "Needs a connection to ask the owners.";
export const ASK_FAILED = "Couldn't ask the owners. Try again in a moment.";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a member who last asked at `askedAt` (ISO, or null) may ask again at `now`. */
export const canAskAgain = (askedAt: string | null, now: Date, windowDays: number) =>
  !askedAt || now.getTime() - new Date(askedAt).getTime() >= windowDays * DAY_MS;

/** "Asked on November 21": the day of the last request, in the device's zone. */
export const askedOn = (askedAt: string, locale?: string, timeZone?: string) =>
  `Asked on ${new Date(askedAt).toLocaleDateString(locale, { month: "long", day: "numeric", timeZone })}`;
