import type { Route } from "./+types/route";
import type { DeviceRoute } from "../../../../../test/device";

import { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, TEST_GROUP } from "../../../../../test/fixtures";
import * as editSheet from "./edit/route";
import * as newSheet from "./new/route";
import * as timeline from "./route";
import { frames, rows, rowWith, TIMELINE_URL as T, world } from "./timelineWorld";

// The sheets' URLs (routing.mjs's add- and edit-sheet steps): the + menu and
// a row open `timeline/new/:kind` and `timeline/:entryId/edit` with the
// filters kept; Back, Cancel, Escape and a save close them onto the same
// timeline (scroll position, loaded pages and filters) and leave no sheet in
// the history; a sheet opened from a link replaces itself with the timeline;
// an entry deleted on another device closes its sheet; a viewer's sheet URLs
// are the timeline. The device is offline throughout, so every sheet here
// opens and saves offline. Where each URL leads is sheetGuard.test.ts's;
// sheets opening offline after a full page load is layout-offline.mjs's, and
// a deep link after a full load is first-sync.mjs's.

/** Back (history −1), as the browser's button does: set by whichever screen is showing. */
let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}
function TimelineWithBack(props: Route.ComponentProps) {
  const Timeline = timeline.default;
  return (
    <>
      <BackProbe />
      <Timeline {...props} />
    </>
  );
}

const VITALS = "?kind=vital";
const SYMPTOMS = "?kind=symptom";
const DEEP_VITAL = `${T}/new/vital${VITALS}&type=heartRate`;

/** The page before the timeline: links in, as from another screen (the deep link carries no sheet state). */
function StartPage() {
  return (
    <main>
      <BackProbe />
      <h1>Start</h1>
      <Link to={`${T}${VITALS}`}>Vitals</Link>
      <Link to={`${T}${SYMPTOMS}`}>Symptoms</Link>
      <Link to={DEEP_VITAL}>Heart rate link</Link>
    </main>
  );
}
const START = `/app/groups/${TEST_GROUP.id}/start`;

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/start", module: { default: StartPage } },
  {
    path: "/app/groups/:groupId/timeline",
    module: { ...timeline, default: TimelineWithBack },
    children: [
      { path: "/app/groups/:groupId/timeline/new/:kind", module: newSheet },
      { path: "/app/groups/:groupId/timeline/:entryId/edit", module: editSheet },
    ],
  },
];

/** Ours, deep enough to need the second page of symptoms. */
const KNEE_AT = hoursAgo(24 * 30);
const KNEE = fx.symptom({ name: "Sore knee", severity: 2, occurredAt: KNEE_AT });
const fixtures = () => [...world(120), KNEE];

const dialog = () => document.querySelector("[role=dialog]");
const NAME = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
const VITAL_TYPE = () =>
  document.querySelector<HTMLInputElement>('[role=dialog] input[name="vital.0.type"]')?.value ?? null;
const sheetButton = (text: string) =>
  [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === text)!;
const loading = () =>
  document.querySelector("[data-older-entries] [role=status]")?.textContent === "Loading older…";

/** A synthetic press (pointer down and up, then click) that doesn't scroll the page, as a tap in place does. */
const press = (el: Element) => {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  (el as HTMLElement).click();
};
const menuItem = (text: string) =>
  [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].find(
    (el) => el.textContent?.trim() === text,
  );
/** + → `item`, pressed where they are. */
const addFrom = async (item: string) => {
  press(document.querySelector('button[aria-label="Add to Today"]')!);
  await waitUntil(() => !!menuItem(item), `${item} in the + menu`);
  press(menuItem(item)!);
  await waitUntil(() => !!dialog()?.querySelector("form"), "the sheet");
};

const where = () => ({ y: Math.round(scrollY), rows: rows().length });
const open = (url = START, role?: "viewer") =>
  renderWithDevice({ route: ROUTES, url, fixtures: fixtures(), role });

/** Start, then the timeline from its link (one entry in the history before it). */
const fromStart = async (link: "Vitals" | "Symptoms") => {
  const device = await open();
  await userEvent.click(page.getByRole("link", { name: link, exact: true }));
  await waitUntil(() => rows().length > 0, "the first rows");
  await device.settle();
  return device;
};

describe("the add sheet", () => {
  test("+ → Symptom goes to new/symptom with the filters; Back, Cancel, Escape and a save each close it onto the same scroll, pages and filters, leaving no sheet behind", async () => {
    const device = await fromStart("Vitals");
    // An older page loaded, and scrolled down into it.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await waitUntil(() => rows().length > 30 && !loading(), "the second page");
    await device.settle();
    window.scrollTo(0, 1500);
    await frames();
    await device.settle();
    const before = where();
    expect(before.rows).toBeGreaterThan(30);
    expect(before.y).toBeGreaterThan(1000);

    const closes: [string, () => Promise<void>][] = [
      ["Back", () => Promise.resolve(back())],
      ["Cancel", () => Promise.resolve(press(sheetButton("Cancel")))],
      ["Escape", () => userEvent.keyboard("{Escape}")],
      [
        "a save",
        async () => {
          await userEvent.fill(await found(NAME), "Hiccups");
          await userEvent.click(await found(() => dialog()?.querySelector('button[type="submit"]')));
        },
      ],
    ];
    for (const [how, close] of closes) {
      await addFrom("Symptom");
      expect(device.location(), how).toBe(`${T}/new/symptom${VITALS}`);
      await close();
      await waitUntil(() => !dialog(), `${how} to close the sheet`);
      await expect.poll(device.location).toBe(`${T}${VITALS}`);
      await frames();
      const after = where();
      expect(Math.abs(after.y - before.y), `${how}: the scroll position`).toBeLessThanOrEqual(2);
      expect(after.rows, `${how}: the loaded entries`).toBe(before.rows);
    }

    // The save is on the device (queued: there's no server).
    const saved = await device.query<{ id: string }>(
      "SELECT id FROM timeline_entry WHERE json_extract(details, '$.name') = 'Hiccups'",
    );
    expect(saved).toHaveLength(1);
    expect((await device.queued()).some((w) => w.id === saved[0]!.id)).toBe(true);

    // No sheet left in the history: Back goes to the page before the timeline.
    back();
    await expect.poll(device.location).toBe(START);
    expect(dialog()).toBeNull();
  });

  test("a link to new/vital?type=heartRate opens the sheet with Heart rate; closing replaces it with the timeline, filters kept", async () => {
    const device = await open();
    await userEvent.click(page.getByRole("link", { name: "Heart rate link" }));
    await waitUntil(() => !!dialog(), "the sheet");
    expect(VITAL_TYPE()).toBe("heartRate");
    await userEvent.click(sheetButton("Cancel"));
    await waitUntil(() => !dialog(), "the sheet to close");
    await expect.poll(device.location).toBe(`${T}${VITALS}`);
    // Replaced, not pushed: Back is the page before it.
    back();
    await expect.poll(device.location).toBe(START);
  });

  test("opened at new/vital?type=heartRate (a bookmark, or a reload): the sheet with Heart rate; Cancel lands on the timeline", async () => {
    const device = await open(DEEP_VITAL);
    await waitUntil(() => !!dialog(), "the sheet");
    expect(VITAL_TYPE()).toBe("heartRate");
    await userEvent.click(sheetButton("Cancel"));
    await expect.poll(device.location).toBe(`${T}${VITALS}`);
    await waitUntil(() => rows().length > 0 && !dialog(), "the timeline");
  });
});

describe("the edit sheet", () => {
  const knee = () => rowWith("Sore knee");
  const editLink = () => knee()!.querySelector<HTMLElement>('a[aria-label^="Edit "]')!;
  const toKnee = async () => {
    for (let i = 0; i < 20 && !knee(); i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await waitUntil(() => !loading(), "a page to load");
      await frames();
    }
    expect(knee()).toBeTruthy();
  };

  test("a row tap goes to <id>/edit with the filters, filled; a save updates the row and closes it, filters kept, no sheet left behind", async () => {
    const device = await fromStart("Symptoms");
    await toKnee();
    await userEvent.click(editLink());
    await waitUntil(() => !!dialog()?.textContent?.includes("Edit symptom"), "the edit sheet");
    expect(device.location()).toBe(`${T}/${KNEE.id}/edit${SYMPTOMS}`);
    await expect.poll(() => NAME()?.value).toBe("Sore knee");

    await userEvent.fill(await found(NAME), "Sore knee, left");
    await userEvent.click(await found(() => dialog()?.querySelector('button[type="submit"]')));
    await waitUntil(() => !dialog(), "the sheet to close");
    await expect.poll(device.location).toBe(`${T}${SYMPTOMS}`);
    await waitUntil(() => !!rowWith("Sore knee, left"), "the changed row");

    back();
    await expect.poll(device.location).toBe(START);
  });

  test("⋯ → Edit opens the same URL, filled; Escape closes it, filters kept", async () => {
    const device = await fromStart("Symptoms");
    await toKnee();
    await userEvent.click(await found(() => knee()?.querySelector('button[aria-label^="Actions"]')));
    await expect.element(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await userEvent.click(page.getByRole("menuitem", { name: "Edit" }));
    await waitUntil(() => !!NAME(), "the edit sheet");
    expect(device.location()).toBe(`${T}/${KNEE.id}/edit${SYMPTOMS}`);
    await expect.poll(() => NAME()?.value).toBe("Sore knee");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !dialog(), "the sheet to close");
    await expect.poll(device.location).toBe(`${T}${SYMPTOMS}`);
  });

  test("opened at its URL (a bookmark, or a reload), it has the entry's current values: a change synced since shows", async () => {
    const device = await open(`${T}/${KNEE.id}/edit${SYMPTOMS}`);
    await waitUntil(() => !!NAME(), "the edit sheet");
    await expect.poll(() => NAME()?.value).toBe("Sore knee");
    await userEvent.keyboard("{Escape}");
    await expect.poll(device.location).toBe(`${T}${SYMPTOMS}`);

    // Changed on another device; the next open reads the device's copy.
    await device.sync(fx.symptom({ id: KNEE.id, name: "Sore knee (from Sam)", occurredAt: KNEE_AT }));
    await device.settle();
    await toKnee().catch(() => undefined);
    await waitUntil(() => !!rowWith("Sore knee (from Sam)"), "the synced change");
    await userEvent.click(
      await found(() =>
        rowWith("Sore knee (from Sam)")?.querySelector<HTMLElement>('a[aria-label^="Edit "]'),
      ),
    );
    await waitUntil(() => !!NAME(), "the edit sheet");
    await expect.poll(() => NAME()?.value).toBe("Sore knee (from Sam)");
  });

  test("deleted on another device while open: the sheet closes onto the timeline, filters kept, with no error", async () => {
    const device = await open(`${T}/${KNEE.id}/edit${SYMPTOMS}`);
    await waitUntil(() => !!NAME(), "the edit sheet");
    await device.sync(fx.symptom({ id: KNEE.id, name: "Sore knee", occurredAt: KNEE_AT, deletedAt: at() }));
    await device.settle();
    await waitUntil(() => !dialog(), "the sheet to close");
    await expect.poll(device.location).toBe(`${T}${SYMPTOMS}`);
    expect(document.body.textContent).not.toMatch(/Not found|Something went wrong/);
  });
});

describe("a viewer", () => {
  test("new/symptom is the timeline, filters kept, with no form", async () => {
    const device = await open(`${T}/new/symptom${VITALS}`, "viewer");
    await expect.poll(device.location).toBe(`${T}${VITALS}`);
    await waitUntil(() => rows().length > 0, "the timeline");
    expect(dialog()).toBeNull();
    expect(document.querySelector('input[name="symptomName"]')).toBeNull();
  });

  test("a symptom's edit URL is the timeline, filters kept, with no form and no edit targets", async () => {
    const device = await open(`${T}/${KNEE.id}/edit${SYMPTOMS}`, "viewer");
    await expect.poll(device.location).toBe(`${T}${SYMPTOMS}`);
    await waitUntil(() => rows().length > 0, "the timeline");
    expect(dialog()).toBeNull();
    expect(document.querySelector('input[name="symptomName"]')).toBeNull();
    expect(document.querySelector('main ol [aria-label^="Edit "]')).toBeNull();
  });
});
