import type { DeviceRoute } from "../../../../test/device";
import type { MyJoinRequest } from "./PendingRequests";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import * as home from "./route";

// /app home's "Waiting for approval" (invites.mjs test 12's one-device steps):
// Withdraw needs a connection, asks first naming the group, and the row goes
// once the server has it. Withdrawing for real, with the owner's Requests
// following, is the invites check's.

const ROUTES: DeviceRoute[] = [{ path: "/app", id: "home", module: home }];

const REQUEST: MyJoinRequest = {
  id: "5a0e2f4c-8d3b-4c71-9e26-1b7f3a9d0c41",
  groupId: "7c1d9e3a-2b4f-4a86-b0d5-6e8f1a2c3b47",
  status: "pending",
  groupName: "Grandpa Lou",
};

/** The server's requests for this person; `withdrawn` records each withdraw call. */
const server = () => {
  let requests = [REQUEST];
  const withdrawn: unknown[] = [];
  const api = {
    "joinRequest.mine": () => requests,
    "joinRequest.withdraw": (input: unknown) => {
      withdrawn.push(input);
      requests = [];
      return {};
    },
  };
  return { api, withdrawn };
};

const open = (api: ReturnType<typeof server>["api"]) =>
  renderWithDevice({ route: ROUTES, url: "/app", bareDevice: true, api });

const withdraw = () => page.getByRole("button", { name: "Withdraw your request to join Grandpa Lou" });
const row = () => document.querySelector(`[data-my-request="${REQUEST.groupId}"]`);

/** The browser's own idea of a connection, as the page reads it. */
const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
};

afterEach(() => {
  delete (navigator as { onLine?: boolean }).onLine;
});

describe("a waiting request", () => {
  test("offline, Withdraw is disabled and says it needs a connection; back online it's enabled", async () => {
    await open(server().api);
    await expect.element(withdraw()).toBeEnabled();
    setOnline(false);
    await expect.element(withdraw()).toBeDisabled();
    await expect.element(withdraw()).toHaveAccessibleDescription("Needs a connection");
    setOnline(true);
    await expect.element(withdraw()).toBeEnabled();
  });

  test("Withdraw asks first, naming the group; Cancel sends nothing; confirming withdraws it and the row goes", async () => {
    const { api, withdrawn } = server();
    await open(api);
    await userEvent.click(withdraw());
    const dialog = page.getByRole("dialog", { name: "Withdraw your request to join Grandpa Lou?" });
    await expect.element(dialog).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
    expect(withdrawn).toEqual([]);

    await userEvent.click(withdraw());
    await userEvent.click(dialog.getByRole("button", { name: "Withdraw" }));
    await expect.poll(row).toBeNull();
    expect(withdrawn).toEqual([{ id: REQUEST.id }]);
  });
});
