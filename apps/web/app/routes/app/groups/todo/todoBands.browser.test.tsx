import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { bandNames, bandsAlternate } from "../../../../../test/bands";
import { renderWithDevice } from "../../../../../test/device";
import { fx, todo, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as todoRoute from "./route";
import * as todosRoute from "../todos/route";

// The todo page in bands (ui-kit slice 6): the header band, then each part
// as a named band in today's order; a viewer sees the parts they saw before
// (Status only when it's theirs to complete), and a part with nothing to
// show (no links) leaves no band.

const BASE = "/app/groups/:groupId/todos";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: todosRoute },
  { path: `${BASE}/:todoId`, module: todoRoute },
];
const pageOf = (id: string) => `/app/groups/${TEST_GROUP.id}/todos/${id}`;

const SAM_ID = "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d02";
const SAM = fx.person({ id: SAM_ID, name: "Sam Okafor", role: "caretaker" });
const LARK = fx.provider({ id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d21", name: "Dr. Mira Lark" });
const LINKED = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d11",
  title: "Ask about the stress test",
  assigneeId: SAM_ID,
  providerId: LARK.id,
});
const MINE = todo({
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f7d12",
  title: "Water the plants",
  assigneeId: TEST_USER.id,
});

const open = (id: string, role: GroupRole, theme?: "light" | "dark") =>
  renderWithDevice({ route: ROUTES, url: pageOf(id), role, fixtures: [SAM, LARK, LINKED, MINE], theme });
const onPage = (id: string) => () =>
  !!document.querySelector(`main[data-todo-page="${id}"]`) && !!document.querySelector("main .ProseMirror");
const onPageWith = async (id: string, also: () => boolean = () => true) => {
  await expect.poll(() => onPage(id)() && also()).toBe(true);
};

describe("the todo page's bands", () => {
  test("a writer's bands in order", async () => {
    await open(LINKED.id, "caretaker");
    await onPageWith(LINKED.id, () => bandNames().includes("Linked to"));
    expect(bandNames()).toEqual(["(header)", "Details", "Linked to", "Status", "Notes"]);
    expect(bandsAlternate()).toBe(true);
  });

  test.each(["light", "dark"] as const)(
    "a viewer it isn't assigned to gets no Status band; the rest still alternate (%s)",
    async (theme) => {
      await open(LINKED.id, "viewer", theme);
      await onPageWith(LINKED.id, () => bandNames().includes("Linked to"));
      expect(bandNames()).toEqual(["(header)", "Details", "Linked to", "Notes"]);
      expect(bandsAlternate()).toBe(true);
    },
  );

  test("the viewer it's assigned to completes it in its band; no links, no band", async () => {
    await open(MINE.id, "viewer");
    await onPageWith(MINE.id);
    expect(bandNames()).toEqual(["(header)", "Details", "Status", "Notes"]);
    expect(bandsAlternate()).toBe(true);
  });
});
