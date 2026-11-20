import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as taskRoute from "./route";
import * as tasksRoute from "../tasks/route";
import { renderWithDevice } from "../../../../../test/device";
import { task, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";

// The "via" tag (connectors) on tasks: a task a member added through their
// own AI assistant says so on its row and on its page ("via Claude",
// `data-via`); one without has none.

const BASE = "/app/groups/:groupId/tasks";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: tasksRoute },
  { path: `${BASE}/:taskId`, module: taskRoute },
];
const LIST = `/app/groups/${TEST_GROUP.id}/tasks`;

const VIA = task({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d01",
  title: "Pick up the prescription",
  assigneeId: TEST_USER.id,
  via: "Claude",
});
const PLAIN = task({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d02",
  title: "Book the eye exam",
  assigneeId: TEST_USER.id,
});
const open = (url: string) => renderWithDevice({ route: ROUTES, url, fixtures: [VIA, PLAIN] });

const rowOf = (id: string) => document.querySelector(`[data-task="${id}"]`);
const tagIn = (el: Element | null) => el?.querySelector<HTMLElement>("[data-via]") ?? null;

describe("the via tag on tasks", () => {
  test("the list's row shows it for a task added through an assistant, and not for others", async () => {
    await open(LIST);
    await expect.poll(() => !!rowOf(VIA.id) && !!rowOf(PLAIN.id)).toBe(true);
    expect(tagIn(rowOf(VIA.id))?.textContent).toBe("via Claude");
    expect(tagIn(rowOf(VIA.id))?.dataset.via).toBe("Claude");
    expect(tagIn(rowOf(PLAIN.id))).toBeNull();
  });

  test("the task's page shows it in the header, and not for others", async () => {
    const device = await open(`${LIST}/${VIA.id}`);
    await expect
      .element(page.getByRole("heading", { name: "Pick up the prescription", level: 1 }))
      .toBeInTheDocument();
    expect(tagIn(document.querySelector('main header [data-region="title"]'))?.textContent).toBe(
      "via Claude",
    );
    await device.screen.unmount();

    await open(`${LIST}/${PLAIN.id}`);
    await expect
      .element(page.getByRole("heading", { name: "Book the eye exam", level: 1 }))
      .toBeInTheDocument();
    expect(tagIn(document.querySelector("main"))).toBeNull();
  });
});
