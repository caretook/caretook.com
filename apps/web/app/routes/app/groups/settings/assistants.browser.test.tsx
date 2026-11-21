import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as assistants from "./assistants/route";
import * as settingsLayout from "./layout/route";
import { apiCalls, refusal } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";
import {
  ASK_OFFLINE,
  ASK_OWNERS,
  ASKED_NOTE,
  askedOn,
  CONNECT_CLIENTS,
  COPIED,
  COPY_FAILED,
  mcpUrl,
  OFF_NOTE,
  VIEWER_NOTE,
} from "../../../../lib/connectors/connectGuide";
import { OFFLINE_ASSISTANTS } from "./assistants/assistants";

// Group settings → Assistants (connectors slice 5): owners turn the switch
// on, and off through a confirm saying how many it disconnects; owners and
// admins see every member's connection and disconnect one; everyone else
// sees the status and a link to their own connections. Online only, against
// stand-ins for `careGroup.update`, `connector.listForGroup` and
// `connector.revoke`. All names are made up.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/assistants`, module: assistants }] },
];
const URL = `/app/groups/${TEST_GROUP.id}/settings/assistants`;

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type Connection = {
  id: string;
  userId: string;
  groupId: string;
  memberName: string | null;
  clientName: string;
  redirectHost: string;
  scope: "read" | "readWrite";
  consentedAt: string;
  lastUsedAt: string | null;
};
const connection = (id: string, memberName: string, clientName: string, v: Partial<Connection> = {}) => ({
  id,
  userId: `user-${id}`,
  groupId: TEST_GROUP.id,
  memberName,
  clientName,
  redirectHost: "assistant.example.com",
  scope: "readWrite" as const,
  consentedAt: ago(2 * 24 * 60),
  lastUsedAt: ago(10),
  ...v,
});

/** The server's side: the group's connections, the switch, and what was asked of it. */
const groupServer = (connections: Connection[]) => {
  const calls = apiCalls();
  const server: {
    connections: Connection[];
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    connections,
    calls,
    api: calls.record({
      "connector.listForGroup": (): Connection[] => server.connections,
      "careGroup.update": (input) => {
        if ((input as { connectorsEnabled?: boolean }).connectorsEnabled === false) server.connections = [];
        return { id: TEST_GROUP.id, name: TEST_GROUP.name, simpleTiles: null };
      },
      "connector.revoke": (input) => {
        const { grantId } = input as { grantId: string };
        server.connections = server.connections.filter((c) => c.id !== grantId);
        return null;
      },
      "connector.myRequest": () => null,
    }),
  };
  return server;
};

const open = ({
  role = "owner",
  enabled = false,
  api,
  width,
}: {
  role?: GroupRole;
  enabled?: boolean;
  api?: Record<string, (input: unknown) => unknown>;
  width?: number;
}) =>
  renderWithDevice({
    route: ROUTES,
    url: URL,
    role,
    width,
    fixtures: [fx.group({ connectorsEnabled: enabled ? 1 : 0 })],
    api,
  });

const heading = () => page.getByRole("heading", { name: "Assistants", level: 1 });
const toggle = () => page.getByRole("checkbox", { name: "Allow members to connect assistants" });
const dialog = () => document.querySelector<HTMLDialogElement>("dialog");
const dialogButton = (name: string) =>
  [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === name)!;
const rows = () =>
  [...document.querySelectorAll<HTMLElement>("li[data-connection]")].map((li) => li.textContent.trim());
const status = () => document.querySelector("[data-assistants-status]")?.textContent.trim() ?? null;

const ANN = connection("g1", "Ann Lee", "Claude");
const RAY = connection("g2", "Ray Patel", "ChatGPT", { scope: "read", lastUsedAt: null });

describe("group settings → Assistants", () => {
  test("is listed in group settings after Members", async () => {
    await open({ api: groupServer([]).api, width: 1024 });
    await expect.element(heading()).toBeVisible();
    const links = [...document.querySelectorAll("nav[data-settings-nav] a")].map((a) => a.textContent.trim());
    expect(links[2]).toMatch(/^Assistants/);
  });

  test("an owner, off by default, turns it on at once", async () => {
    const server = groupServer([]);
    await open({ api: server.api });
    await expect.element(toggle()).not.toBeChecked();
    expect(page.getByText(/goes to the company that makes it/).elements()).toHaveLength(1);

    await userEvent.click(toggle());
    await expect
      .poll(() => server.calls.of("careGroup.update"))
      .toEqual([{ groupId: TEST_GROUP.id, connectorsEnabled: true }]);
    await expect.element(toggle()).toBeChecked();
    expect(dialog()?.open ?? false).toBe(false);
    await expect
      .element(page.getByText("No one has connected an assistant to this care group."))
      .toBeVisible();
  });

  test("an owner turns it off only through the confirm, which says how many it disconnects", async () => {
    const server = groupServer([ANN, RAY]);
    const device = await open({ enabled: true, api: server.api });
    await expect.element(toggle()).toBeChecked();
    await expect.poll(rows).toHaveLength(2);

    await userEvent.click(toggle());
    await expect.poll(() => dialog()?.open).toBe(true);
    expect(dialog()!.querySelector("h2")!.textContent.trim()).toBe("Turn off assistants?");
    expect(dialog()!.textContent).toMatch(/Disconnects 2 assistants\./);
    expect(dialog()!.textContent).toMatch(/reconnects no one/);
    await userEvent.click(dialogButton("Cancel"));
    await expect.poll(() => dialog()?.open).toBe(false);
    expect(server.calls.of("careGroup.update")).toEqual([]);
    await expect.element(toggle()).toBeChecked();

    await userEvent.click(toggle());
    await expect.poll(() => dialog()?.open).toBe(true);
    await userEvent.click(dialogButton("Turn off"));
    await expect
      .poll(() => server.calls.of("careGroup.update"))
      .toEqual([{ groupId: TEST_GROUP.id, connectorsEnabled: false }]);
    await expect.element(toggle()).not.toBeChecked();
    // Everyone's connection went with it.
    await expect.poll(rows).toEqual([]);
    // The row syncs back off.
    await device.sync(fx.group({ connectorsEnabled: 0 }));
    await expect.element(toggle()).not.toBeChecked();
  });

  test("a refused switch shows what's saved, with the reason", async () => {
    const server = groupServer([]);
    await open({
      api: { ...server.api, "careGroup.update": () => refusal("careGroupService:connectorsOwnerOnly") },
    });
    await userEvent.click(toggle());
    await expect.element(page.getByRole("alert")).toHaveTextContent("You don't have permission to do that.");
    await expect.element(toggle()).not.toBeChecked();
  });

  test("an admin sees every connection and disconnects one, but has no switch", async () => {
    const server = groupServer([ANN, RAY]);
    await open({ role: "admin", enabled: true, api: server.api });
    await expect.poll(rows).toHaveLength(2);
    expect(toggle().elements()).toHaveLength(0);
    expect(status()).toBe("Assistants are on for this care group.");
    const [ann, ray] = rows();
    expect(ann).toMatch(/^Ann Lee · Claude/);
    expect(ann).toMatch(/Read and add entries · Connected .+ · Last used /);
    expect(ray).toMatch(/^Ray Patel · ChatGPT/);
    expect(ray).toMatch(/Read only · Connected .+ · Not used yet/);

    await userEvent.click(page.getByRole("button", { name: "Disconnect Ann Lee's Claude" }));
    await expect.poll(() => dialog()?.open).toBe(true);
    expect(dialog()!.querySelector("h2")!.textContent.trim()).toBe("Disconnect Ann Lee's Claude?");
    await userEvent.click(dialogButton("Disconnect"));
    await expect.poll(() => server.calls.of("connector.revoke")).toEqual([{ grantId: ANN.id }]);
    await expect.poll(rows).toHaveLength(1);
    expect(rows()[0]).toMatch(/^Ray Patel/);
    await expect.element(page.getByText("Disconnected Ann Lee's Claude.")).toBeVisible();
  });

  test.each(["caretaker", "viewer"] as const)(
    "a %s sees the status and a link to Devices, and asks the server only for their last request",
    async (role) => {
      const server = groupServer([ANN]);
      const device = await open({ role, api: server.api });
      await expect.poll(() => server.calls.calls.map((c) => c.path)).toEqual(["connector.myRequest"]);
      await expect.element(heading()).toBeVisible();
      expect(status()).toBe("Assistants are off for this care group. Only an owner can turn them on.");
      await expect
        .element(page.getByRole("link", { name: "Settings → Devices" }))
        .toHaveAttribute("href", "/app/settings/devices");
      expect(toggle().elements()).toHaveLength(0);
      expect(rows()).toEqual([]);
      expect(document.querySelector("[data-needs-connection]")).toBeNull();

      // Another owner turns it on: it follows.
      await device.sync(fx.group({ connectorsEnabled: 1 }));
      await expect.poll(status).toBe("Assistants are on for this care group.");
    },
  );

  test("offline, an owner gets the usual notice and the status, with no switch or list", async () => {
    await open({ enabled: true });
    await expect.element(page.getByText(OFFLINE_ASSISTANTS)).toBeVisible();
    expect(status()).toBe("Assistants are on for this care group.");
    expect(toggle().elements()).toHaveLength(0);
    expect(document.querySelector('section[data-section="group-connections"]')).toBeNull();
  });
});

// The connect guide (connectors-2 slice 1): after the switch, for everyone.
const MCP_URL = mcpUrl(import.meta.env.VITE_API_ORIGIN, location.origin);
const guide = () => document.querySelector<HTMLElement>('section[data-section="connect-guide"]');
const guideUrl = () => guide()?.querySelector<HTMLInputElement>("input[data-guide-url]") ?? null;
const guideNote = (kind: "off" | "viewer") =>
  guide()?.querySelector(`[data-guide-note="${kind}"]`)?.textContent.trim() ?? null;

describe("group settings → Assistants' connect guide", () => {
  afterEach(() => vi.restoreAllMocks());

  test("with the switch on, comes after the switch: the address, each client's steps and help link", async () => {
    await open({ enabled: true, api: groupServer([]).api });
    await expect.poll(() => guideUrl()?.value).toBe(MCP_URL);
    expect(MCP_URL).toMatch(/\/mcp$/);
    const switchCard = document.querySelector('section[data-section="assistants-switch"]')!;
    expect(switchCard.compareDocumentPosition(guide()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const client of CONNECT_CLIENTS) {
      const section = guide()!.querySelector(`[data-guide-client="${client.id}"]`)!;
      expect(section.querySelector("h3")!.textContent).toBe(client.name);
      expect([...section.querySelectorAll("ol > li")].map((li) => li.textContent)).toEqual(client.steps);
      await expect
        .element(page.getByRole("link", { name: client.help.label }))
        .toHaveAttribute("href", client.help.href);
    }
    expect(guideNote("off")).toBeNull();
    expect(guideNote("viewer")).toBeNull();
  });

  test("Copy puts the address on the clipboard and says Copied", async () => {
    const written: string[] = [];
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      (text) => (written.push(text), Promise.resolve()),
    );
    await open({ role: "caretaker", enabled: true });
    await userEvent.click(page.getByRole("button", { name: "Copy", exact: true }));
    await expect.element(page.getByRole("status").filter({ hasText: COPIED })).toBeVisible();
    expect(written).toEqual([MCP_URL]);
  });

  test("a copy that fails says to copy the address by hand, which stays shown", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("NotAllowedError"));
    await open({ role: "caretaker", enabled: true });
    await userEvent.click(page.getByRole("button", { name: "Copy", exact: true }));
    await expect.element(page.getByRole("alert").filter({ hasText: COPY_FAILED })).toBeVisible();
    expect(guideUrl()?.value).toBe(MCP_URL);
  });

  test("with the switch off, an owner gets the off note instead of the steps", async () => {
    await open({ api: groupServer([]).api });
    await expect.poll(() => guideNote("off")).toBe(OFF_NOTE.owner);
    expect(guideUrl()).toBeNull();
    expect(guide()!.querySelector("[data-guide-client]")).toBeNull();
  });

  test("with the switch off, a caretaker gets the off note; when an owner turns it on, the steps", async () => {
    const device = await open({ role: "caretaker" });
    await expect.poll(() => guideNote("off")).toBe(OFF_NOTE.member);
    expect(guideUrl()).toBeNull();
    await device.sync(fx.group({ connectorsEnabled: 1 }));
    await expect.poll(() => guideUrl()?.value).toBe(MCP_URL);
    expect(guideNote("off")).toBeNull();
  });

  test("a viewer gets the steps with the read-only note", async () => {
    await open({ role: "viewer", enabled: true });
    await expect.poll(() => guideNote("viewer")).toBe(VIEWER_NOTE.group);
    expect(guideUrl()?.value).toBe(MCP_URL);
  });
});

// Asking the owners (connectors-2 slice 2): beside the off note, for
// everyone but owners, against stand-ins for `connector.myRequest` and
// `connector.requestEnable`.
const askButton = () => page.getByRole("button", { name: ASK_OWNERS });
const askState = () => guide()?.querySelector("[data-ask-owners]")?.getAttribute("data-ask-owners") ?? null;
const askedText = () => guide()?.querySelector("[data-asked-on]")?.textContent.trim() ?? null;

/** The server's side of asking: the member's last request, and each ask. */
const askServer = (last: string | null = null) => {
  const calls = apiCalls();
  const server: {
    last: string | null;
    calls: typeof calls;
    api: Record<string, (input: unknown) => unknown>;
  } = {
    last,
    calls,
    api: calls.record({
      "connector.myRequest": () =>
        server.last ? { id: "req-1", groupId: TEST_GROUP.id, requestedAt: server.last } : null,
      "connector.requestEnable": () => {
        server.last = new Date().toISOString();
        return { id: "req-2", groupId: TEST_GROUP.id, requestedAt: server.last, created: true };
      },
    }),
  };
  return server;
};

describe("group settings → Assistants' ask button", () => {
  test.each(["caretaker", "viewer", "admin"] as const)(
    "a %s with the switch off asks the owners, then sees Asked on <date>",
    async (role) => {
      const server = askServer();
      await open({ role, api: { ...groupServer([]).api, ...server.api } });
      await expect.poll(() => guideNote("off")).toBe(OFF_NOTE.member);
      await expect.element(askButton()).toBeVisible();
      // Beside the off note, in the guide.
      expect(guide()!.contains(askButton().element())).toBe(true);

      await userEvent.click(askButton());
      await expect
        .poll(() => server.calls.of("connector.requestEnable"))
        .toEqual([{ groupId: TEST_GROUP.id }]);
      await expect.poll(askedText).toBe(askedOn(server.last ?? ""));
      expect(askButton().elements()).toHaveLength(0);
      await expect.element(page.getByRole("status").filter({ hasText: ASKED_NOTE })).toBeVisible();
    },
  );

  test("a request in the last week shows Asked on <date> and no button; an older one, the button", async () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await open({ role: "caretaker", api: askServer(recent).api });
    await expect.poll(askedText).toBe(askedOn(recent));
    expect(askButton().elements()).toHaveLength(0);
  });

  test("a request over a week old lets the member ask again", async () => {
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    await open({ role: "caretaker", api: askServer(old).api });
    await expect.poll(askState).toBe("ask");
    await expect.element(askButton()).toBeVisible();
    expect(askedText()).toBeNull();
  });

  test("an owner gets no button: they have the switch", async () => {
    const server = askServer();
    await open({ api: { ...groupServer([]).api, ...server.api } });
    await expect.poll(() => guideNote("off")).toBe(OFF_NOTE.owner);
    expect(askButton().elements()).toHaveLength(0);
    expect(guide()!.querySelector("[data-ask-owners]")).toBeNull();
    expect(server.calls.calls).toEqual([]);
  });

  test("the button goes once the switch is on", async () => {
    const device = await open({ role: "caretaker", api: askServer().api });
    await expect.element(askButton()).toBeVisible();
    await device.sync(fx.group({ connectorsEnabled: 1 }));
    await expect.poll(() => guideUrl()?.value).toBe(MCP_URL);
    expect(askButton().elements()).toHaveLength(0);
  });

  test("a refused ask shows the reason and keeps the button", async () => {
    const server = askServer();
    await open({
      role: "caretaker",
      api: { ...server.api, "connector.requestEnable": () => refusal("assistantRequestService:alreadyOn") },
    });
    await userEvent.click(askButton());
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Assistants are already on for this care group");
    await expect.element(askButton()).toBeEnabled();
  });

  test("offline, the button says it needs a connection", async () => {
    await open({ role: "caretaker" });
    await userEvent.click(askButton());
    await expect.element(page.getByRole("alert")).toHaveTextContent(ASK_OFFLINE);
    await expect.element(askButton()).toBeVisible();
  });
});
