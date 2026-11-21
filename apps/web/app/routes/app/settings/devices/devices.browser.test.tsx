import type { DeviceRoute } from "../../../../../test/device";

import type { GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "../layout/route";
import * as devices from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { fx } from "../../../../../test/fixtures";
import { COPIED, mcpUrl, OFF_NOTE, VIEWER_NOTE } from "../../../../lib/connectors/connectGuide";
import { OFFLINE_DEVICES } from "./devices";

// Account settings → Devices (devices.mjs's screen steps, B-124): the list,
// Sign out on one device and everywhere else, and the offline notice, against
// a stand-in for Better Auth's session calls. Then the connected assistants
// (connectors slice 5), against a stand-in for `connector.listMine` and
// `connector.revoke`. That a signed-out device's next
// session check goes to sign-in, on a real server, is session-end.mjs's.

const URL = "/app/settings/devices";
const ROUTES: DeviceRoute[] = [
  {
    path: "/app/settings",
    module: settingsLayout,
    children: [{ path: URL, module: devices }],
  },
];

const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";

type Session = { id: string; token: string; userAgent: string; createdAt: string; updatedAt: string };
type Connection = {
  id: string;
  userId: string;
  groupId: string;
  groupName: string | null;
  clientName: string;
  redirectHost: string;
  scope: "read" | "readWrite";
  consentedAt: string;
  lastUsedAt: string | null;
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const session = (id: string, userAgent: string, minutesAgo: number): Session => ({
  id,
  token: `token-${id}-fictional-secret`,
  userAgent,
  createdAt: ago(minutesAgo + 60),
  updatedAt: ago(minutesAgo),
});

/** Better Auth's session calls, as far as the page uses them, over a list of sessions (and the member's connections). */
const authServer = (sessions: Session[], currentId: string, connections: Connection[] = []) => {
  const server = {
    sessions,
    connections,
    disconnected: [] as string[],
    online: true,
    revoked: [] as string[],
    othersRevoked: 0,
    api: {} as Record<string, (input: unknown) => unknown>,
  };
  const up = () => {
    // fetch fails with a TypeError when there's no connection.
    if (!server.online) throw new TypeError("Failed to fetch");
  };
  server.api = {
    "/api/auth/list-sessions": () => (up(), server.sessions),
    "/api/auth/get-session": () => {
      up();
      const current = server.sessions.find((s) => s.id === currentId);
      return current ? { session: current, user: { id: "u", email: "pat@example.com" } } : null;
    },
    "/api/auth/revoke-session": (input) => {
      up();
      const { token } = input as { token: string };
      server.revoked.push(token);
      server.sessions = server.sessions.filter((s) => s.token !== token);
      return { status: true };
    },
    "/api/auth/revoke-other-sessions": () => {
      up();
      server.othersRevoked++;
      server.sessions = server.sessions.filter((s) => s.id === currentId);
      return { status: true };
    },
    "connector.listMine": () => (up(), server.connections),
    "connector.revoke": (input) => {
      up();
      const { grantId } = input as { grantId: string };
      const gone = server.connections.find((c) => c.id === grantId);
      server.disconnected.push(grantId);
      server.connections = server.connections.filter((c) => c.id !== grantId);
      return gone;
    },
  };
  return server;
};

const THIS = session("this", MAC, 0);
const PHONE = session("phone", IPHONE, 5);
const OLD = session("old", WINDOWS, 3 * 24 * 60);

const open = async (
  server: ReturnType<typeof authServer>,
  { role, assistantsOn = false }: { role?: GroupRole; assistantsOn?: boolean } = {},
) => {
  const device = await renderWithDevice({
    route: ROUTES,
    url: URL,
    api: server.api,
    role,
    fixtures: [fx.group({ connectorsEnabled: assistantsOn ? 1 : 0 })],
  });
  // The clientLoader calls Better Auth, which settle doesn't wait for.
  await expect.element(page.getByRole("heading", { name: "Devices", level: 1 })).toBeVisible();
  return device;
};

const rows = () =>
  [...document.querySelectorAll<HTMLElement>("li[data-device]")].map((li) => ({
    id: li.dataset.device,
    current: li.hasAttribute("data-current"),
    label: li.querySelector("[data-device-label]")?.textContent.trim(),
    text: li.textContent.trim(),
    button: li.querySelector("button")?.getAttribute("aria-label") ?? null,
  }));
const rowOf = (id: string) => document.querySelector<HTMLElement>(`li[data-device="${id}"]`);
const dialog = () => document.querySelector<HTMLDialogElement>("dialog");
const dialogButton = (name: string) =>
  [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === name)!;
const status = () =>
  document
    .querySelector('section[data-section="devices"] [role="status"]:not([data-needs-connection])')
    ?.textContent.trim() ?? "";

describe("the Devices page", () => {
  test("lists this device first, marked and with no Sign out, then the others, most recent first", async () => {
    const server = authServer([OLD, THIS, PHONE], THIS.id);
    await open(server);
    await expect.poll(() => rows().length).toBe(3);

    const [first, phone, old] = rows();
    expect(first).toMatchObject({ id: "this", current: true, label: "Chrome on macOS", button: null });
    expect(first!.text).toContain("This device");
    expect(phone).toMatchObject({ id: "phone", current: false, label: "Safari on iPhone" });
    expect(phone!.text).toMatch(/Last active/);
    expect(phone!.button).toMatch(/^Sign out Safari on iPhone, last active /);
    expect(old).toMatchObject({ id: "old", current: false, label: "Edge on Windows" });
    expect(old!.button).toMatch(/^Sign out Edge on Windows, last active /);
    await expect.element(page.getByRole("button", { name: "Sign out everywhere else" })).toBeVisible();

    // No session token reaches the page.
    const html = document.documentElement.outerHTML;
    for (const s of [THIS, PHONE, OLD]) expect(html).not.toContain(s.token);
  });

  test("Sign out asks first, naming the device; Cancel signs nothing out", async () => {
    const server = authServer([THIS, PHONE], THIS.id);
    await open(server);
    await expect.poll(() => rowOf(PHONE.id)).not.toBeNull();

    await userEvent.click(page.getByRole("button", { name: /^Sign out Safari on iPhone/ }));
    await expect.poll(() => dialog()?.open).toBe(true);
    await expect
      .poll(() => dialog()?.querySelector("h2")?.textContent.trim())
      .toBe("Sign out Safari on iPhone?");
    await userEvent.click(dialogButton("Cancel"));
    await expect.poll(() => dialog()?.open).toBe(false);
    expect(server.revoked).toEqual([]);
    expect(rowOf(PHONE.id)).not.toBeNull();
  });

  test("confirmed, Sign out ends that session by its token, the list is read again, and the page says so", async () => {
    const server = authServer([THIS, PHONE], THIS.id);
    await open(server);
    await expect.poll(() => rowOf(PHONE.id)).not.toBeNull();
    // Meanwhile another browser signs in: the list read after the sign-out has it.
    const laptop = session("laptop", WINDOWS, 1);
    server.sessions = [...server.sessions, laptop];

    await userEvent.click(page.getByRole("button", { name: /^Sign out Safari on iPhone/ }));
    await expect.poll(() => dialog()?.open).toBe(true);
    await userEvent.click(dialogButton("Sign out"));
    await expect.poll(status).toBe("Signed out Safari on iPhone.");
    expect(server.revoked).toEqual([PHONE.token]);
    await expect.poll(() => rowOf(PHONE.id)).toBeNull();
    await expect.poll(() => rows().map((r) => r.id)).toEqual(["this", "laptop"]);
  });

  test("Sign out everywhere else asks first, says this device stays, and leaves only this device", async () => {
    const server = authServer([THIS, PHONE, OLD], THIS.id);
    await open(server);
    await expect.poll(() => rows().length).toBe(3);

    await userEvent.click(page.getByRole("button", { name: "Sign out everywhere else" }));
    await expect.poll(() => dialog()?.open).toBe(true);
    await expect
      .poll(() => dialog()?.querySelector("h2")?.textContent.trim())
      .toBe("Sign out everywhere else?");
    await expect.poll(() => dialog()?.textContent).toMatch(/All 2 other devices go to sign-in/);
    await expect.poll(() => dialog()?.textContent).toMatch(/This device stays signed in/);
    await userEvent.click(dialogButton("Sign out"));

    await expect.poll(status).toBe("Signed out everywhere else.");
    expect(server.othersRevoked).toBe(1);
    await expect.poll(() => rows().map((r) => r.id)).toEqual(["this"]);
    expect(page.getByRole("button", { name: "Sign out everywhere else" }).elements()).toHaveLength(0);
    await expect.element(page.getByText("You're not signed in anywhere else.")).toBeVisible();
  });

  test("a sign-out that loses the connection signs nothing out, and the page says it needs one", async () => {
    const server = authServer([THIS, PHONE], THIS.id);
    await open(server);
    await expect.poll(() => rowOf(PHONE.id)).not.toBeNull();

    await userEvent.click(page.getByRole("button", { name: /^Sign out Safari on iPhone/ }));
    await expect.poll(() => dialog()?.open).toBe(true);
    server.online = false;
    await userEvent.click(dialogButton("Sign out"));
    // The page loads again after the action, offline too: the notice in place of the list.
    await expect.element(page.getByText(OFFLINE_DEVICES)).toBeVisible();
    expect(server.revoked).toEqual([]);
    expect(rows()).toEqual([]);
    expect(status()).toBe("");
  });

  test("offline: a notice and no list; back online, the list returns", async () => {
    const server = authServer([THIS, PHONE], THIS.id);
    server.online = false;
    await open(server);
    const notice = page.getByText(OFFLINE_DEVICES);
    await expect.element(notice).toBeVisible();
    expect(document.querySelector("ul[data-devices]")).toBeNull();
    expect(rows()).toEqual([]);

    server.online = true;
    window.dispatchEvent(new Event("online"));
    await expect.poll(() => rows().map((r) => r.id)).toEqual(["this", "phone"]);
    expect(document.querySelector("[data-needs-connection]")).toBeNull();
  });
});

const connection = (
  id: string,
  clientName: string,
  groupName: string,
  v: Partial<Connection> = {},
): Connection => ({
  id,
  userId: "u",
  groupId: `group-${groupName}`,
  groupName,
  clientName,
  redirectHost: "assistant.example.com",
  scope: "readWrite",
  consentedAt: ago(3 * 24 * 60),
  lastUsedAt: ago(30),
  ...v,
});

const CLAUDE = connection("c1", "Claude", "Grandma June");
const CHATGPT = connection("c2", "ChatGPT", "Uncle Ray", { scope: "read", lastUsedAt: null });

const assistants = () => page.getByRole("region", { name: "Connected assistants" });
const connectionRows = () =>
  [...document.querySelectorAll<HTMLElement>("li[data-connection]")].map((li) => li.textContent.trim());
// The connections' own confirm (the sessions' comes first in the page).
const aDialog = () =>
  document.querySelector<HTMLDialogElement>('section[data-section="connected-assistants"] dialog');
const aDialogButton = (name: string) =>
  [...(aDialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === name)!;
const assistantsStatus = () =>
  document
    .querySelector('section[data-section="connected-assistants"] [role="status"]')
    ?.textContent.trim() ?? "";

describe("the Devices page's connected assistants", () => {
  test("come after the sessions: client, group, scope, connected and last used", async () => {
    const server = authServer([THIS], THIS.id, [CLAUDE, CHATGPT]);
    await open(server);
    await expect.poll(connectionRows).toHaveLength(2);
    const [claude, chatgpt] = connectionRows();
    expect(claude).toMatch(/^Claude · Grandma June/);
    expect(claude).toMatch(/Read and add entries · Connected .+ · Last used /);
    expect(chatgpt).toMatch(/^ChatGPT · Uncle Ray/);
    expect(chatgpt).toMatch(/Read only · Connected .+ · Not used yet/);
    // After the sessions' card.
    const devicesList = document.querySelector("ul[data-devices]")!;
    const card = assistants().element();
    expect(devicesList.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("none yet says so", async () => {
    await open(authServer([THIS], THIS.id));
    await expect
      .element(assistants().getByText("You haven't connected an AI assistant to a care group."))
      .toBeVisible();
  });

  test("Disconnect asks first; Cancel keeps it, confirming removes it and says so", async () => {
    const server = authServer([THIS], THIS.id, [CLAUDE, CHATGPT]);
    await open(server);
    await expect.poll(connectionRows).toHaveLength(2);

    await userEvent.click(page.getByRole("button", { name: "Disconnect Claude from Grandma June" }));
    await expect.poll(() => aDialog()?.open).toBe(true);
    await expect.poll(() => aDialog()?.querySelector("h2")?.textContent.trim()).toBe("Disconnect Claude?");
    await expect.poll(() => aDialog()?.textContent).toMatch(/stops reaching Grandma June at once/);
    await userEvent.click(aDialogButton("Cancel"));
    await expect.poll(() => aDialog()?.open).toBe(false);
    expect(server.disconnected).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Disconnect Claude from Grandma June" }));
    await expect.poll(() => aDialog()?.open).toBe(true);
    await userEvent.click(aDialogButton("Disconnect"));
    await expect.poll(assistantsStatus).toBe("Disconnected Claude from Grandma June.");
    expect(server.disconnected).toEqual([CLAUDE.id]);
    await expect.poll(connectionRows).toHaveLength(1);
    expect(connectionRows()[0]).toMatch(/^ChatGPT/);
  });

  test("offline: neither list, only the notice", async () => {
    const server = authServer([THIS], THIS.id, [CLAUDE]);
    server.online = false;
    await open(server);
    await expect.element(page.getByText(OFFLINE_DEVICES)).toBeVisible();
    expect(document.querySelector('section[data-section="connected-assistants"]')).toBeNull();
  });
});

// The connect guide (connectors-2 slice 1), after the connected assistants,
// by the member's groups on the device.
const MCP_URL = mcpUrl(import.meta.env.VITE_API_ORIGIN, location.origin);
const guide = () => document.querySelector<HTMLElement>('section[data-section="connect-guide"]');
const guideUrl = () => guide()?.querySelector<HTMLInputElement>("input[data-guide-url]") ?? null;
const guideNote = (kind: "off" | "viewer") =>
  guide()?.querySelector(`[data-guide-note="${kind}"]`)?.textContent.trim() ?? null;

describe("the Devices page's connect guide", () => {
  afterEach(() => vi.restoreAllMocks());

  test("comes after the connected assistants: the address and both clients' steps; Copy says Copied", async () => {
    const written: string[] = [];
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      (text) => (written.push(text), Promise.resolve()),
    );
    await open(authServer([THIS], THIS.id, [CLAUDE]), { assistantsOn: true });
    await expect.poll(() => guideUrl()?.value).toBe(MCP_URL);
    const card = assistants().element();
    expect(card.compareDocumentPosition(guide()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...guide()!.querySelectorAll("[data-guide-client] h3")].map((h) => h.textContent)).toEqual([
      "Claude",
      "ChatGPT",
    ]);
    expect(guideNote("viewer")).toBeNull();

    await userEvent.click(page.getByRole("button", { name: "Copy", exact: true }));
    await expect.poll(() => guide()!.querySelector("[data-guide-status]")?.textContent).toBe(COPIED);
    expect(written).toEqual([MCP_URL]);
  });

  test("with no group allowing assistants, the off note instead of the steps", async () => {
    await open(authServer([THIS], THIS.id));
    await expect.poll(() => guideNote("off")).toBe(OFF_NOTE.account);
    expect(guideUrl()).toBeNull();
  });

  test("a viewer in the only group that allows assistants gets the read-only note", async () => {
    await open(authServer([THIS], THIS.id), { role: "viewer", assistantsOn: true });
    await expect.poll(() => guideNote("viewer")).toBe(VIEWER_NOTE.account);
    expect(guideUrl()?.value).toBe(MCP_URL);
  });

  test("offline: no guide, only the notice", async () => {
    const server = authServer([THIS], THIS.id);
    server.online = false;
    await open(server, { assistantsOn: true });
    await expect.element(page.getByText(OFFLINE_DEVICES)).toBeVisible();
    expect(guide()).toBeNull();
  });
});
