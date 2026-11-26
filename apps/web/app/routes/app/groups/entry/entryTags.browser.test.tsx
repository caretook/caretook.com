import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, recordTag, tag, TEST_GROUP } from "../../../../../test/fixtures";
import * as entryRoute from "./route";

// Tags on the entry page (tags slice 2): every chip under the time, for
// every role; Tags in the ⋯ menu opens the picker for whoever may tag it,
// and the chips follow live. The rows' chips and the roles in full are
// timeline/timelineTags.browser.test.tsx's.

const ROUTES = [{ path: "/app/groups/:groupId/entries/:entryId", module: entryRoute }];
const VISIT = fx.event({
  title: "Knee check",
  occurredAt: at(new Date(Date.now() - 20 * 60_000)),
  text: "Fine.",
});
const URGENT = tag("Urgent");
const KNEE = tag("Knee");
const MOVE = tag("Care home move");
const world = () => [VISIT, URGENT, KNEE, MOVE, recordTag(URGENT.id, VISIT.id), recordTag(KNEE.id, VISIT.id)];
const openEntry = (role: "owner" | "viewer") =>
  renderWithDevice({
    route: ROUTES,
    url: `/app/groups/${TEST_GROUP.id}/entries/${VISIT.id}`,
    fixtures: world(),
    role,
  });

const chips = () =>
  [...document.querySelectorAll('[data-region="tags"] [data-tag-chip]')]
    .map((c) => c.textContent?.trim())
    .join(",");
const MENU = () =>
  document.querySelector<HTMLButtonElement>(
    'main header [data-region="actions"] button[aria-label^="Actions for"]',
  );
const menuItems = () => [...document.querySelectorAll("[role=menuitem]")].map((m) => m.textContent?.trim());

describe("tags on the entry page", () => {
  test("a writer sees every chip (no +N) and tags it from ⋯ Tags; the chips follow live", async () => {
    const device = await openEntry("owner");
    await expect.poll(chips).toBe("Knee,Urgent");
    await userEvent.click(await found(MENU));
    await waitUntil(() => menuItems().includes("Tags"), "Tags in the menu");
    await userEvent.click(page.getByRole("menuitem", { name: "Tags" }));
    await found(() => document.querySelector("[data-tag-picker]"));
    await userEvent.click(page.getByRole("checkbox", { name: "Care home move" }));
    await device.settle();
    await expect.poll(chips).toBe("Care home move,Knee,Urgent");
    expect(document.querySelector('[data-region="tags"] [data-tag-more]')).toBeNull();
  });

  test("a viewer sees the chips and no Tags", async () => {
    await openEntry("viewer");
    await expect.poll(chips).toBe("Knee,Urgent");
    await userEvent.click(await found(MENU));
    await waitUntil(() => menuItems().length > 0, "the menu");
    expect(menuItems()).toEqual(["Print"]);
  });
});
