import type { DeviceRoute } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { found, waitUntil } from "../../../../test/found";
import { TEST_GROUP, TEST_RECIPIENT, TEST_USER } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";

// The account menu's Sign out (sync-safety slice 4, B-290): with nothing
// waiting to upload it posts to /sign-out at once; with changes waiting it
// asks first in a native dialog with the count. "Stay signed in" does
// nothing, "Sign out anyway" posts. The wipe and the server's half are the
// sign-out route's (session-end checks them end to end).

const signOutRoute = () => {
  const posts: string[] = [];
  const route: DeviceRoute = {
    path: "/sign-out",
    module: {
      clientAction: ({ request }: { request: Request }) => {
        posts.push(request.method);
        return null;
      },
      default: () => <p>Signed out</p>,
    },
  };
  return { route, posts };
};

const open = async (waiting: number) => {
  const signOut = signOutRoute();
  const device = await renderWithDevice({
    route: [PROBE, signOut.route],
    url: `/app/groups/${TEST_GROUP.id}/timeline`,
    frame: true,
  });
  for (let i = 0; i < waiting; i++)
    await device.db.powersync.execute(
      `INSERT INTO timeline_entry (id, group_id, recipient_id, kind, occurred_at, title)
       VALUES (?, ?, ?, 'note', '2027-06-09T12:00:00.000000Z', ?)`,
      [crypto.randomUUID(), TEST_GROUP.id, TEST_RECIPIENT.id, `Fictional note ${i}`],
    );
  await device.settle();
  if (waiting) expect(await device.queued()).toHaveLength(waiting);
  return { device, posts: signOut.posts };
};

const pressSignOut = async () => {
  await userEvent.click(page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` }));
  await userEvent.click(page.getByRole("menuitem", { name: "Sign out", exact: true }));
};

const dialog = () => document.querySelector("dialog");

describe("Sign out", () => {
  test("with nothing waiting: posts at once, no dialog", async () => {
    const { posts } = await open(0);
    await pressSignOut();
    await expect.poll(() => posts).toEqual(["POST"]);
    expect(dialog()?.open ?? false).toBe(false);
  });

  test("with changes waiting: asks with the count; Stay signed in does nothing", async () => {
    const { posts, device } = await open(2);
    await pressSignOut();
    const open_ = await found(() => document.querySelector("dialog[open]"));
    expect(open_.textContent).toContain("2 changes haven't reached the server");
    expect(open_.textContent).toContain("Sign out and lose them?");
    await userEvent.click(page.getByRole("button", { name: "Stay signed in" }));
    await waitUntil(() => !dialog()?.open);
    expect(posts).toEqual([]);
    expect(device.location()).toBe(`/app/groups/${TEST_GROUP.id}/timeline`);
    expect(await device.queued()).toHaveLength(2);
  });

  test("with one change waiting: Sign out anyway posts", async () => {
    const { posts } = await open(1);
    await pressSignOut();
    const open_ = await found(() => document.querySelector("dialog[open]"));
    expect(open_.textContent).toContain("1 change hasn't reached the server");
    expect(open_.textContent).toContain("Sign out and lose it?");
    await userEvent.click(page.getByRole("button", { name: "Sign out anyway" }));
    await expect.poll(() => posts).toEqual(["POST"]);
  });
});
