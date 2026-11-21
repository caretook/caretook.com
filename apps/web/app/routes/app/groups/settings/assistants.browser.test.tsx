import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as assistants from "./assistants/route";
import * as settingsLayout from "./layout/route";
import { apiCalls, refusal } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";
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
    "a %s sees the status and a link to Devices, and asks the server nothing",
    async (role) => {
      const server = groupServer([ANN]);
      const device = await open({ role, api: server.api });
      await expect.element(heading()).toBeVisible();
      expect(status()).toBe("Assistants are off for this care group. Only an owner can turn them on.");
      await expect
        .element(page.getByRole("link", { name: "Settings → Devices" }))
        .toHaveAttribute("href", "/app/settings/devices");
      expect(toggle().elements()).toHaveLength(0);
      expect(rows()).toEqual([]);
      expect(server.calls.calls).toEqual([]);
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
