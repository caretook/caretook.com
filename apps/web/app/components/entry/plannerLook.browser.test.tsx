import type { Locator } from "vitest/browser";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { fixClock } from "../../../test/found";
import { fx, recordTag, series, tag } from "../../../test/fixtures";
import {
  CARDIOLOGY,
  entryUrl,
  EYES_NEW,
  EYES_OLD,
  itemEl,
  laTime,
  menuItems,
  NOW,
  openPlanner,
  rowActions,
} from "../../routes/app/groups/planner/plannerWorld";

// The entry display's Planner look (`UpcomingEntryCard`, shared-displays
// slice 7), on the Planner's own world: a card's time range, place, Call and
// Directions, tags and the timeline's author avatar; its ⋯ (`EntryMenu`,
// with Copy link); the easy roles' card (no menu, a plain avatar, chips
// only); and a cancelled, rescheduled one's link. The menus' other items and
// their actions are the planner tests'.

const MOVE = tag("Care home move");
const DIALYSIS = series({ startsOn: "2026-11-16", title: "Dialysis" });
const VISIT = fx.event({
  title: "Dialysis",
  occurredAt: laTime(2, 6),
  endsAt: laTime(2, 10),
  seriesId: DIALYSIS.id,
  seriesDay: "2026-11-20",
  text: "",
});
const extra = [MOVE, recordTag(MOVE.id, CARDIOLOGY.id), DIALYSIS, VISIT];

const openMenu = async (button: Locator) => {
  await userEvent.click(button);
  await expect.poll(() => menuItems().length).toBeGreaterThan(0);
  return menuItems();
};
const chips = (root: Element | null | undefined) =>
  [...(root?.querySelectorAll("[data-tag-chip]") ?? [])].map((c) => c.textContent?.trim());

beforeEach(() => fixClock(NOW));
afterEach(() => {
  vi.useRealTimers();
});

describe("a writer's card", () => {
  test("shows its time range, place, Call and Directions, tags and the timeline's author avatar", async () => {
    await openPlanner({ extra });
    const card = itemEl(CARDIOLOGY.id);
    expect(card?.querySelector("[data-when]")?.textContent).toMatch(/^10:30\sAM–11:15\sAM$/);
    const place = card?.querySelector("[data-place]")?.textContent;
    expect(place).toContain("48 Harbor Way, Suite 2, Port Alder");
    expect(place).toContain("from Dr. Ana Tran");
    const footer = card?.querySelector("[data-row-footer]");
    expect(
      [...(footer?.querySelectorAll<HTMLElement>("[data-action]") ?? [])].map((a) => a.dataset.action),
    ).toEqual(["call", "map"]);
    expect(chips(card)).toEqual(["Care home move"]);
    expect(card?.querySelector("[data-quick-tag-add]")).not.toBeNull();
    // The timeline's author control: a filter link with the avatar, at the footer's end.
    const author = footer?.querySelector<HTMLElement>("[data-author]");
    expect(author?.tagName).toBe("A");
    expect(author?.getAttribute("aria-label")).toMatch(/^Show only/);
  });

  test("its ⋯ has Prepare, Cancel, Copy link and Delete, and Edit only on a series visit", async () => {
    await openPlanner({ extra, role: "caretaker" });
    const plain = await openMenu(rowActions(CARDIOLOGY.id));
    expect(plain).toEqual(
      expect.arrayContaining(["Prepare for this visit", "Cancel event", "Copy link", "Delete"]),
    );
    expect(plain).not.toContain("Edit");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => menuItems().length).toBe(0);
    const visit = await openMenu(rowActions(VISIT.id));
    expect(visit[0]).toBe("Edit");
    expect(visit).toEqual(
      expect.arrayContaining(["Prepare for this visit", "Cancel event", "Copy link", "Delete"]),
    );
  });

  test("a viewer's ⋯ has Copy link, but no writer's items", async () => {
    await openPlanner({ extra, role: "viewer" });
    const items = await openMenu(rowActions(CARDIOLOGY.id));
    expect(items).toContain("Copy link");
    for (const writer of ["Prepare for this visit", "Cancel event", "Delete", "Edit"]) {
      expect(items).not.toContain(writer);
    }
  });

  test("a cancelled one, rescheduled, links its new event", async () => {
    await openPlanner({ extra });
    const link = itemEl(EYES_OLD.id)?.querySelector<HTMLAnchorElement>("[data-rescheduled-to]");
    expect(link?.dataset.rescheduledTo).toBe(EYES_NEW.id);
    expect(link?.getAttribute("href")).toBe(entryUrl(EYES_NEW.id));
    expect(link?.textContent).toMatch(/^Rescheduled to /);
  });
});

describe("an easy role's card", () => {
  test("has no menu, a plain avatar, and chips with no Add tag", async () => {
    await openPlanner({ extra, role: "easy_viewer" });
    const card = itemEl(CARDIOLOGY.id);
    expect(card?.querySelector('button[aria-label^="Actions for"]')).toBeNull();
    expect(card?.querySelector("[data-author]")?.tagName).toBe("SPAN");
    expect(card?.querySelector('a[aria-label^="Show only"]')).toBeNull();
    expect(chips(card)).toEqual(["Care home move"]);
    expect(card?.querySelector("[data-quick-tag-add], [data-tag-remove]")).toBeNull();
  });
});
