import type { LoaderArgs } from "../../../../test/device";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { adminFx } from "../../../../test/adminFixtures";
import { openAdmin } from "../adminWorld";
import * as user from "../user/route";
import * as users from "./route";
import { parseUserSearch } from "./userSearch";

// /admin/users (admin.mjs step 5's list, on loader data): the search is in
// the URL, each row has its badges and opens the account's page. Which
// accounts a search matches is the API's (usersAdmin.int.test.ts).

const pat = adminFx.userRow({ name: "Pat Lindqvist", email: "pat.lindqvist@example.com" });
const sam = adminFx.userRow({
  name: null,
  email: "sam.okafor@example.com",
  emailVerified: false,
  role: "support",
  disabled: true,
});
const ALL = [pat, sam];

const usersData = ({ url }: LoaderArgs) => {
  const { q, page } = parseUserSearch(url.search);
  const found = ALL.filter((u) => !q || u.email.includes(q.toLowerCase()));
  return { count: found.length, page, pageSize: 50, users: found, q, pages: 1 };
};

const ROUTES = [
  { path: "/admin/users", module: users, loaderData: usersData },
  {
    path: "/admin/users/:userId",
    module: user,
    loaderData: ({ params }: LoaderArgs) => ({
      page: adminFx.userPage({ account: { id: params.userId, name: "Pat Lindqvist", email: pat.email } }),
      canHelp: true,
      canDisable: true,
      canSetRole: true,
      isSelf: false,
      history: null,
    }),
  },
];

const badges = (email: string) =>
  [...document.querySelectorAll(`[data-user="${email}"] [data-badge]`)].map((b) => b.textContent);

describe("/admin/users", () => {
  test("every account with its badges: confirmed or not, disabled, staff role", async () => {
    const device = await openAdmin({ routes: ROUTES, url: "/admin/users" });
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("2 accounts.");
    expect(badges(pat.email)).toEqual(["Confirmed"]);
    expect(badges(sam.email)).toEqual(["Not confirmed", "Disabled", "Support"]);
    // A nameless account is listed by its email.
    await expect.element(device.screen.getByRole("link", { name: sam.email })).toBeVisible();
  });

  test("a search goes in the URL and narrows the list; a row opens the account's page", async () => {
    const device = await openAdmin({ routes: ROUTES, url: "/admin/users" });
    await userEvent.fill(device.screen.getByRole("searchbox", { name: /Name or email/ }), "LINDQ");
    await userEvent.click(device.screen.getByRole("button", { name: "Search" }));
    await expect.element(device.screen.getByRole("status")).toHaveTextContent("1 account matches.");
    expect(device.location()).toBe("/admin/users?q=LINDQ");

    await userEvent.click(device.screen.getByRole("link", { name: "Pat Lindqvist" }));
    await expect
      .element(device.screen.getByRole("heading", { name: "Pat Lindqvist", level: 1 }))
      .toBeVisible();
    expect(device.location()).toBe(`/admin/users/${pat.id}`);
  });
});
