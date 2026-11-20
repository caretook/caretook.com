import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "../layout/route";
import * as devices from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { OFFLINE_DEVICES } from "./devices";

// Account settings → Devices (devices.mjs's screen steps, B-124): the list,
// Sign out on one device and everywhere else, and the offline notice, against
// a stand-in for Better Auth's session calls. That a signed-out device's next
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

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const session = (id: string, userAgent: string, minutesAgo: number): Session => ({
  id,
  token: `token-${id}-fictional-secret`,
  userAgent,
  createdAt: ago(minutesAgo + 60),
  updatedAt: ago(minutesAgo),
});

/** Better Auth's session calls, as far as the page uses them, over a list of sessions. */
const authServer = (sessions: Session[], currentId: string) => {
  const server = {
    sessions,
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
  };
  return server;
};

const THIS = session("this", MAC, 0);
const PHONE = session("phone", IPHONE, 5);
const OLD = session("old", WINDOWS, 3 * 24 * 60);

const open = async (server: ReturnType<typeof authServer>) => {
  const device = await renderWithDevice({ route: ROUTES, url: URL, api: server.api });
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
    expect(dialog()!.querySelector("h2")!.textContent.trim()).toBe("Sign out Safari on iPhone?");
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
    expect(dialog()!.querySelector("h2")!.textContent.trim()).toBe("Sign out everywhere else?");
    expect(dialog()!.textContent).toMatch(/All 2 other devices go to sign-in/);
    expect(dialog()!.textContent).toMatch(/This device stays signed in/);
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
