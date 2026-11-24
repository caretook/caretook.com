import type { Device } from "../../../../../test/device";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fixClock, found, waitUntil } from "../../../../../test/found";
import { at } from "../../../../../test/fixtures";
import { updateEntry } from "~/lib/timeline/timeline.sync";
import {
  CARDIOLOGY,
  entryUrl,
  item,
  NOW,
  openPlanner,
  PAST_URL,
  PLANNER_URL,
  PODIATRY,
  SAM,
  TIMELINE_URL,
  TODOS_URL,
} from "./plannerWorld";

// An event opened from the Planner goes back to the Planner (B-690), on the
// test device. A new one from Add > Event goes to Upcoming or Past by its
// time when leaving (in progress counts as Upcoming); an unsaved draft back
// to the tab it came from. An existing one opened from a row goes back to
// that exact tab and its filters, even after a time edit moved it. Delete
// leaves the same way. A direct link keeps the Timeline. The rule itself is
// lib/appointments/plannerReturn.test.ts's. The memory router has no
// browser history index, so Back here is always a navigation (the history
// step that restores scroll is the unit test's).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ON_ENTRY = /\/entries\/[0-9a-f-]{36}$/;

const backLink = () =>
  [...document.querySelectorAll<HTMLAnchorElement>("main a")].find((a) =>
    /^(Planner|Timeline)$/.test(a.textContent?.trim() ?? ""),
  ) ?? null;
const TITLE = () => document.querySelector<HTMLInputElement>("main header input");
const CHIP_DIALOG = () => document.querySelector<HTMLElement>('[role=dialog][aria-label="When it happened"]');
const TIME_CHIP = () =>
  document.querySelector<HTMLButtonElement>('main header button[aria-label="Change when it happened"]');
const DAY_SEGMENT = () => document.querySelector<HTMLElement>('[role=dialog] [data-type="day"]');
const ENTRY_MENU = () =>
  document.querySelector<HTMLButtonElement>(
    'main header [data-region="actions"] button[aria-label^="Actions for"]',
  );
const button = (text: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const menuItem = (text: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((m) => m.textContent?.trim() === text);
const dialogButton = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")].find(
    (b) => b.textContent?.trim() === text,
  );
const idOf = (path: string) => path.split("/").at(-1)!;

beforeEach(() => fixClock(NOW));
afterEach(() => vi.useRealTimers());

/** From the Planner tab at `url`: Add > Event, the picker closed, and a title typed (which saves it). */
const addEvent = async (device: Device, title: string | null) => {
  await userEvent.click(page.getByRole("button", { name: "Add", exact: true }));
  await userEvent.click(page.getByRole("menuitem", { name: "Event" }));
  await expect.poll(() => device.location()).toMatch(/\/entries\/new\?kind=event&when=pick$/);
  await waitUntil(() => !!CHIP_DIALOG(), "the time picker");
  // Escape closes the calendar first, then the time chip's dialog.
  await waitUntil(() => !!document.querySelector("[role=grid]"), "the calendar");
  await userEvent.keyboard("{Escape}");
  await waitUntil(() => !document.querySelector("[role=grid]"), "the calendar closed");
  await userEvent.keyboard("{Escape}");
  await waitUntil(() => !CHIP_DIALOG(), "the picker closed");
  if (title === null) return null;
  (await found(TITLE)).focus();
  await userEvent.keyboard(title);
  (await found(TITLE)).blur();
  await expect.poll(() => device.location()).toMatch(ON_ENTRY);
  return idOf(device.location());
};

/** Move the stored event's time (`from`/`to` from the fixed now), as an edit elsewhere would. */
const moveTo = async (device: Device, id: string, from: number, to: number | null = null) => {
  const res = await updateEntry(device.db, id, {
    occurredAt: at(new Date(NOW.getTime() + from)),
    endsAt: to === null ? null : at(new Date(NOW.getTime() + to)),
  });
  expect(res.ok).toBe(true);
  await device.settle();
};

/** Open the time chip and move the day by `steps` (negative is earlier), then Done. */
const shiftDay = async (steps: number) => {
  await userEvent.click(await found(TIME_CHIP));
  (await found(DAY_SEGMENT)).focus();
  for (let i = 0; i < Math.abs(steps); i++) await userEvent.keyboard(steps < 0 ? "{ArrowDown}" : "{ArrowUp}");
  await userEvent.click(await found(() => button("Done")));
  await waitUntil(() => !CHIP_DIALOG(), "the picker closed");
};

const goBack = async () => userEvent.click(await found(backLink));

const deleteFromMenu = async () => {
  await userEvent.click(await found(ENTRY_MENU));
  await userEvent.click(await found(() => menuItem("Delete")));
  await userEvent.click(await found(() => dialogButton("Delete")));
};

describe("a new event from Add > Event", () => {
  test("a future one goes to Upcoming, labelled Planner", async () => {
    const device = await openPlanner({ role: "caretaker", url: PAST_URL });
    const id = (await addEvent(device, "Lab results review"))!;
    await moveTo(device, id, 2 * DAY);
    expect(backLink()?.textContent?.trim()).toBe("Planner");
    await goBack();
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.element(item(id)).toBeInTheDocument();
  });

  test("a past one goes to Past", async () => {
    const device = await openPlanner({ role: "caretaker" });
    const id = (await addEvent(device, "Pharmacy pickup"))!;
    await moveTo(device, id, -2 * DAY);
    await goBack();
    await expect.poll(() => device.location()).toBe(PAST_URL);
    await expect.element(item(id)).toBeInTheDocument();
  });

  test("one in progress goes to Upcoming", async () => {
    const device = await openPlanner({ role: "caretaker", url: PAST_URL });
    const id = (await addEvent(device, "Home visit"))!;
    await moveTo(device, id, -30 * MINUTE, 30 * MINUTE);
    await goBack();
    await expect.poll(() => device.location()).toBe(PLANNER_URL);
    await expect.element(item(id)).toBeInTheDocument();
  });

  test("a time changed on the page before leaving decides it", async () => {
    const device = await openPlanner({ role: "caretaker" });
    const id = (await addEvent(device, "Flu shot"))!;
    await moveTo(device, id, 2 * HOUR);
    expect(backLink()?.getAttribute("href")).toBe(PLANNER_URL);
    await shiftDay(-3);
    await expect.poll(() => backLink()?.getAttribute("href")).toBe(PAST_URL);
    await goBack();
    await expect.poll(() => device.location()).toBe(PAST_URL);
  });

  test("the first save's URL replace keeps the return: the link reads Planner on /entries/:id", async () => {
    const device = await openPlanner({ role: "caretaker" });
    await addEvent(device, "Dentist call");
    expect(device.location()).toMatch(ON_ENTRY);
    expect(backLink()?.textContent?.trim()).toBe("Planner");
  });

  test("an unsaved draft goes back to the tab it came from, its filter kept", async () => {
    const opener = `${PAST_URL}?author=${SAM.id}`;
    const device = await openPlanner({ role: "caretaker", url: opener });
    await addEvent(device, null);
    expect(device.location()).toMatch(/\/entries\/new/);
    expect(backLink()?.textContent?.trim()).toBe("Planner");
    await goBack();
    await expect.poll(() => device.location()).toBe(opener);
  });

  test("from Todos, an unsaved draft goes back to Todos", async () => {
    const device = await openPlanner({ role: "caretaker", url: TODOS_URL });
    await addEvent(device, null);
    await goBack();
    await expect.poll(() => device.location()).toBe(TODOS_URL);
  });

  test("deleting it goes to the Planner by its time", async () => {
    const device = await openPlanner({ role: "caretaker" });
    const id = (await addEvent(device, "Wrong day"))!;
    await moveTo(device, id, -DAY);
    await deleteFromMenu();
    await expect.poll(() => device.location()).toBe(PAST_URL);
  });
});

describe("an existing event opened from a row", () => {
  test("from Upcoming with a filter: Back returns there, even after a time edit moved it to Past", async () => {
    const opener = `${PLANNER_URL}?kind=event`;
    const device = await openPlanner({ role: "caretaker", url: opener });
    await userEvent.click(item(CARDIOLOGY.id).getByRole("link", { name: /^Open / }));
    await expect.poll(() => device.location()).toBe(entryUrl(CARDIOLOGY.id));
    expect(backLink()?.textContent?.trim()).toBe("Planner");
    expect(backLink()?.getAttribute("href")).toBe(opener);
    await shiftDay(-5);
    await expect
      .poll(async () =>
        Date.parse(
          (
            await device.query<{ occurred_at: string }>(
              "SELECT occurred_at FROM timeline_entry WHERE id = ?",
              [CARDIOLOGY.id],
            )
          )[0]!.occurred_at.replace(" ", "T"),
        ),
      )
      .toBeLessThan(NOW.getTime());
    expect(backLink()?.getAttribute("href")).toBe(opener);
    await goBack();
    await expect.poll(() => device.location()).toBe(opener);
  });

  test("from Past with a filter: Back returns there", async () => {
    const opener = `${PAST_URL}?author=${SAM.id}`;
    const device = await openPlanner({ role: "caretaker", url: opener });
    await userEvent.click(item(PODIATRY.id).getByRole("link", { name: /^Open / }));
    await expect.poll(() => device.location()).toBe(entryUrl(PODIATRY.id));
    await goBack();
    await expect.poll(() => device.location()).toBe(opener);
  });

  test("deleting it returns to its opener", async () => {
    const opener = `${PLANNER_URL}?kind=event`;
    const device = await openPlanner({ role: "caretaker", url: opener });
    await userEvent.click(item(CARDIOLOGY.id).getByRole("link", { name: /^Open / }));
    await expect.poll(() => device.location()).toBe(entryUrl(CARDIOLOGY.id));
    await deleteFromMenu();
    await expect.poll(() => device.location()).toBe(opener);
  });
});

test("a direct link keeps the Timeline", async () => {
  await openPlanner({ role: "caretaker", url: entryUrl(CARDIOLOGY.id) });
  await waitUntil(() => !!backLink(), "the back link");
  expect(backLink()?.textContent?.trim()).toBe("Timeline");
  expect(backLink()?.getAttribute("href")).toBe(TIMELINE_URL);
});
