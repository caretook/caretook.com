import type { DeviceRoute } from "../../../../test/device";

import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { fx, TEST_USER } from "../../../../test/fixtures";
import * as home from "./route";

// /app home's group choices (B-819): a tapped choice says it's opening at
// once, while the group's first load is still pending, and no choice starts
// a second navigation meanwhile.

const ROSE = "3f6b2a1e-9c4d-4e8a-b7f2-5d1c0a9e8b31";
const ALBERT = "8a2d4c6e-1f3b-4d5a-9e7c-2b4f6a8d0c13";

/** Every navigation into a group: its loader never resolves (a slow first load). */
let loads: string[] = [];
const SLOW_TIMELINE = {
  clientLoader: ({ params }: { params: { groupId: string } }) => {
    loads.push(params.groupId);
    return new Promise(() => {});
  },
  default: () => null,
};

const ROUTES: DeviceRoute[] = [
  { path: "/app", id: "home", module: home },
  { path: "/app/groups/:groupId/timeline", module: SLOW_TIMELINE },
];

const groupWith = (id: string, name: string, recipient: string) => [
  fx.group({ id, name }),
  fx.recipient({ id: crypto.randomUUID(), groupId: id, name: recipient, preferredName: null }),
];

const open = async () => {
  loads = [];
  const device = await renderWithDevice({
    route: ROUTES,
    url: "/app?groups=1",
    bareDevice: true,
    api: { "joinRequest.mine": () => [] },
    fixtures: [
      groupWith(ROSE, "Rose's care", "Rose Alvarez"),
      groupWith(ALBERT, "Albert's care", "Albert Lindqvist"),
      fx.member({ userId: TEST_USER.id, groupId: ROSE, role: "caretaker" }),
      fx.member({ userId: TEST_USER.id, groupId: ALBERT, role: "caretaker" }),
    ],
  });
  await expect.element(page.getByRole("link", { name: /Albert Lindqvist/ })).toBeVisible();
  return device;
};

const choice = (name: RegExp) => page.getByRole("link", { name });
const row = (id: string) => document.querySelector(`[data-group-choice="${id}"]`);

test("a tapped group says it's opening before its load finishes", async () => {
  await open();
  await userEvent.click(choice(/Rose Alvarez/));
  await expect.element(page.getByRole("status", { name: "Opening…" })).toBeVisible();
  await expect.poll(() => row(ROSE)?.hasAttribute("data-opening")).toBe(true);
  expect(row(ROSE)?.querySelector('[role="status"]')?.textContent).toContain("Opening…");
  expect(row(ALBERT)?.hasAttribute("data-opening")).toBe(false);
  expect(row(ROSE)?.closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
  expect(loads).toEqual([ROSE]);
});

test("while one is opening, another choice starts no navigation", async () => {
  const device = await open();
  await userEvent.click(choice(/Rose Alvarez/));
  await expect.element(page.getByRole("status", { name: "Opening…" })).toBeVisible();

  await userEvent.click(choice(/Albert Lindqvist/));
  await device.settle();
  expect(row(ROSE)?.hasAttribute("data-opening")).toBe(true);
  expect(row(ALBERT)?.hasAttribute("data-opening")).toBe(false);
  expect(loads).toEqual([ROSE]);
});
