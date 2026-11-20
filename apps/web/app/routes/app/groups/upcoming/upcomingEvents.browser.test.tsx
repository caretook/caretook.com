import type { SyncDb } from "~/lib/sync";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { fx } from "../../../../../test/fixtures";
import { cancelEvent, rescheduleEvent, uncancelEvent } from "~/lib/sync/appointments";
import {
  BLOOD_DRAW,
  CARDIOLOGY,
  DENTIST,
  entryUrl,
  EYES_NEW,
  EYES_OLD,
  fixClock,
  fromNow,
  HEARING,
  itemEl,
  laTime,
  menuItem,
  menuItems,
  dialogButton,
  NOW,
  openUpcoming,
  rowOf,
  SAM,
  TIMELINE_URL,
  TRAN,
} from "./upcomingWorld";

// Cancelling, undoing and rescheduling events on the test device (from
// upcoming.mjs's cancel and reschedule steps): from Upcoming's ⋯, a
// timeline row's ⋯ and the entry page's; the banner on the entry page; the
// reschedule sheet (keep the old one or just move); and the one local
// transaction a reschedule is. Every write is local (the device never
// connects): what's on the screen, what's stored and what's queued for
// upload. Who cancelled is the server's (appointments.int.test.ts); the
// reschedule reaching another device is roundtrip.mjs's step 6a; the rules
// (keep by default, can reschedule) are eventReschedule.test.ts's.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ACTIONS = 'button[aria-label^="Actions for"]';
const ENTRY_MENU = 'main header [data-region="actions"] button[aria-label^="Actions for"]';
const BANNER = () => document.querySelector<HTMLElement>("main [data-cancelled-banner]");
const SHEET = () => document.querySelector<HTMLFormElement>("[data-reschedule-sheet]");
const KEEP = () => SHEET()?.querySelector<HTMLInputElement>("[data-keep-old]") ?? null;
const EDITOR = () => document.querySelector<HTMLElement>(".ProseMirror");

/** A timeline row (or card), by its entry's open link. */
const timelineRow = (id: string) =>
  [...document.querySelectorAll<HTMLElement>("main li")].find((li) =>
    li.querySelector(`a[href$="/entries/${id}"]`),
  );
/** Whether a row is marked, labelled and struck through as cancelled. */
const cancelledState = (li: Element | null | undefined) =>
  li && {
    marked: li.hasAttribute("data-cancelled"),
    label: !!li.querySelector("[data-cancelled-label]")?.textContent?.includes("Cancelled"),
    struck: [...li.querySelectorAll("div")].some((d) =>
      getComputedStyle(d).textDecorationLine.includes("line-through"),
    ),
  };
const CANCELLED = { marked: true, label: true, struck: true };

/** Open the ⋯ menu in `scope` and wait for its items. */
const openMenu = async (button: Element | null | undefined) => {
  await userEvent.click(button!);
  await expect.poll(() => menuItems().length).toBeGreaterThan(0);
  return menuItems();
};
/** Pick Cancel event from the open menu, type `reason` (if any) and confirm. */
const confirmCancel = async (reason?: string) => {
  await userEvent.click(menuItem("Cancel event")!);
  await expect.poll(() => document.querySelector("dialog[open] [data-cancel-reason]")).not.toBeNull();
  if (reason)
    await userEvent.fill(
      document.querySelector<HTMLInputElement>("dialog[open] [data-cancel-reason]")!,
      reason,
    );
  await userEvent.click(dialogButton("Cancel event")!);
  await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
};
/** Pick Reschedule from the open menu and wait for the sheet. */
const openSheet = async () => {
  await userEvent.click(menuItem("Reschedule")!);
  await expect.poll(KEEP, { timeout: 5000 }).not.toBeNull();
};
/** Move the sheet's day `days` later, set Keep, and save. */
const rescheduleBy = async (days: number, keep: boolean) => {
  SHEET()!.querySelector<HTMLElement>('[data-type="day"]')!.focus();
  for (let i = 0; i < days; i++) await userEvent.keyboard("{ArrowUp}");
  if (KEEP()!.checked !== keep) await userEvent.click(KEEP()!);
  await userEvent.click(SHEET()!.querySelector<HTMLButtonElement>('button[type="submit"]')!);
  await expect.poll(SHEET, { timeout: 5000 }).toBeNull();
};

type Stored = {
  id: string;
  title: string | null;
  occurred_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  rescheduled_to: string | null;
  deleted_at: string | null;
};
const stored = async (db: SyncDb, id: string) =>
  (await db.powersync.getAll<Stored>("SELECT * FROM timeline_entry WHERE id = ?", [id]))[0];
const ms = (local: string | null) => (local ? Date.parse(local.replace(" ", "T")) : null);

beforeEach(() => fixClock());
afterEach(() => {
  vi.useRealTimers();
});

describe("cancel and undo", () => {
  test("from Upcoming's ⋯ with a reason: struck through and labelled at once, stored with the reason, one PATCH queued", async () => {
    const device = await openUpcoming({ role: "caretaker" });
    const items = await openMenu(itemEl(CARDIOLOGY.id)!.querySelector(ACTIONS));
    expect(items).toEqual(["Prepare for this visit", "Reschedule", "Cancel event", "Print", "Delete"]);
    await confirmCancel("Office called, doctor out sick");
    await device.settle();
    await expect.poll(() => cancelledState(itemEl(CARDIOLOGY.id))).toEqual(CANCELLED);
    const row = await stored(device.db, CARDIOLOGY.id);
    expect(row!.cancelled_at).not.toBeNull();
    expect(row!.cancel_reason).toBe("Office called, doctor out sick");
    const queued = await device.queued();
    expect(queued).toEqual([
      expect.objectContaining({ op: "PATCH", type: "timeline_entry", id: CARDIOLOGY.id }),
    ]);
    expect(queued[0]!.data).toMatchObject({ cancel_reason: "Office called, doctor out sick" });
  });

  test("a past event from a timeline row's ⋯, without a reason: struck through and labelled", async () => {
    const device = await openUpcoming({ url: TIMELINE_URL });
    await expect.poll(() => !!timelineRow(BLOOD_DRAW.id)).toBe(true);
    await openMenu(timelineRow(BLOOD_DRAW.id)!.querySelector(ACTIONS));
    await confirmCancel();
    await device.settle();
    await expect.poll(() => cancelledState(timelineRow(BLOOD_DRAW.id))).toEqual(CANCELLED);
    const row = await stored(device.db, BLOOD_DRAW.id);
    expect(row!.cancelled_at).not.toBeNull();
    expect(row!.cancel_reason).toBeNull();
  });

  test("Undo cancel from a row's ⋯: the label and the line go", async () => {
    const device = await openUpcoming({ url: TIMELINE_URL });
    await expect.poll(() => cancelledState(timelineRow(HEARING.id))).toEqual(CANCELLED);
    await openMenu(timelineRow(HEARING.id)!.querySelector(ACTIONS));
    await userEvent.click(menuItem("Undo cancel")!);
    await device.settle();
    await expect
      .poll(() => cancelledState(timelineRow(HEARING.id)))
      .toEqual({ marked: false, label: false, struck: false });
    expect((await stored(device.db, HEARING.id))!.cancelled_at).toBeNull();
  });

  test("a viewer sees cancelled ones labelled on Upcoming and the timeline, and their device refuses a cancel or an undo", async () => {
    const device = await openUpcoming({ role: "viewer" });
    expect(rowOf(DENTIST.id)).toMatchObject({ cancelled: true, struck: true });
    expect((await uncancelEvent(device.db, DENTIST.id)).ok).toBe(false);
    expect((await cancelEvent(device.db, CARDIOLOGY.id, "no")).ok).toBe(false);
    expect(await device.queued()).toEqual([]);
    await device.screen.unmount();

    await openUpcoming({ url: TIMELINE_URL, role: "viewer" });
    await expect.poll(() => cancelledState(timelineRow(HEARING.id))).toEqual(CANCELLED);
  });

  describe("the entry page's banner", () => {
    const CALLED_OFF = fx.event({
      title: "Audiology",
      occurredAt: laTime(4, 9),
      cancelledAt: fromNow(-30 * MINUTE),
      cancelledBy: SAM.id,
      cancelReason: "Office called, doctor out sick",
    });

    test("the reason, who and when, for everyone; Undo for the writer, not the viewer", async () => {
      const viewer = await openUpcoming({
        url: entryUrl(CALLED_OFF.id),
        extra: [CALLED_OFF],
        role: "viewer",
      });
      await expect
        .poll(() => BANNER()?.querySelector("[data-cancelled-by]")?.textContent)
        .toBe("Cancelled by Sam Okafor · Today, 9:30 AM");
      expect(BANNER()!.querySelector("[data-cancel-reason]")?.textContent).toBe(
        "Office called, doctor out sick",
      );
      expect(page.getByRole("button", { name: "Undo cancel" }).query()).toBeNull();
      await viewer.screen.unmount();

      await openUpcoming({ url: entryUrl(CALLED_OFF.id), extra: [CALLED_OFF], role: "caretaker" });
      await expect.element(page.getByRole("button", { name: "Undo cancel" })).toBeVisible();
    });

    test("Undo cancel restores it: the banner goes, stored and queued", async () => {
      const device = await openUpcoming({ url: entryUrl(CALLED_OFF.id), extra: [CALLED_OFF] });
      await userEvent.click(page.getByRole("button", { name: "Undo cancel" }));
      await device.settle();
      await expect.poll(BANNER).toBeNull();
      const row = await stored(device.db, CALLED_OFF.id);
      expect([row!.cancelled_at, row!.cancel_reason]).toEqual([null, null]);
      expect(await device.queued()).toEqual([
        expect.objectContaining({ op: "PATCH", type: "timeline_entry", id: CALLED_OFF.id }),
      ]);
    });

    test("Cancel from the page's ⋯ (offline): the banner at once, queued for upload", async () => {
      const device = await openUpcoming({ url: entryUrl(CARDIOLOGY.id) });
      await expect.poll(() => !!document.querySelector(ENTRY_MENU)).toBe(true);
      const items = await openMenu(document.querySelector(ENTRY_MENU));
      expect(items).toEqual(["Reschedule", "Cancel event", "Print", "Delete"]);
      await confirmCancel();
      await device.settle();
      await expect.poll(BANNER).not.toBeNull();
      expect(await device.queued()).toEqual([
        expect.objectContaining({ op: "PATCH", type: "timeline_entry", id: CARDIOLOGY.id }),
      ]);
    });
  });
});

describe("reschedule", () => {
  const NEURO = fx.event({
    title: "Neurology consult",
    occurredAt: laTime(2, 11),
    endsAt: laTime(2, 11, 45),
    text: "Bring the cuff log",
  });
  const NOTED_OLD = fx.event({
    title: "Eye doctor",
    occurredAt: EYES_OLD.row.occurred_at as string,
    cancelledAt: fromNow(-2 * DAY),
    rescheduledTo: EYES_NEW.id,
    id: EYES_OLD.id,
    text: "Ask about the drops",
  });

  test("an upcoming event's sheet starts with Keep on; keeping the old one opens the new event 3 days later, as long, with its title, provider and notes; the old one cancelled, linking to it; one transaction queued", async () => {
    const device = await openUpcoming({ extra: [NEURO, fx.link(NEURO.id, TRAN.id)] });
    await openMenu(itemEl(NEURO.id)!.querySelector(ACTIONS));
    await openSheet();
    expect(KEEP()!.checked).toBe(true);
    await rescheduleBy(3, true);
    await expect.poll(() => device.location(), { timeout: 5000 }).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    const fresh = device.location().split("/").at(-1)!;
    expect(fresh).not.toBe(NEURO.id);
    await expect.poll(() => EDITOR()?.textContent, { timeout: 5000 }).toContain("Bring the cuff log");

    const [old, made] = [await stored(device.db, NEURO.id), await stored(device.db, fresh)];
    expect(made!.title).toBe("Neurology consult");
    expect(made!.cancelled_at).toBeNull();
    expect(ms(made!.occurred_at)! - ms(NEURO.row.occurred_at as string)!).toBe(3 * DAY);
    expect(ms(made!.ends_at)! - ms(NEURO.row.ends_at as string)!).toBe(3 * DAY);
    expect(old!.cancelled_at).not.toBeNull();
    expect(old!.rescheduled_to).toBe(fresh);
    const links = await device.query<{ provider_id: string }>(
      "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?",
      [fresh],
    );
    expect(links).toEqual([{ provider_id: TRAN.id }]);
    // One local transaction, each row before what points at it: the new
    // event, its document and notes, its link, then the old one cancelled.
    const queued = (await device.queued()).map((w) => `${w.op} ${w.type}`);
    expect(queued.slice(0, 5)).toEqual([
      "PUT timeline_entry",
      "PUT note_document",
      "PUT note_update",
      "PUT timeline_entry_provider",
      "PATCH timeline_entry",
    ]);
  });

  test("the old one's page: Rescheduled to its day, linking to the new one, its notes read-only as earlier notes; Upcoming's ⋯ for it offers no Reschedule", async () => {
    const device = await openUpcoming({ url: entryUrl(EYES_OLD.id), extra: [NOTED_OLD] });
    const link = () => BANNER()?.querySelector<HTMLAnchorElement>(`[data-rescheduled-to="${EYES_NEW.id}"] a`);
    await expect.poll(() => link()?.textContent).toBe("Rescheduled to Tue, Nov 24");
    expect(link()!.getAttribute("href")).toBe(entryUrl(EYES_NEW.id));
    await expect.poll(() => EDITOR()?.textContent).toContain("Ask about the drops");
    expect(EDITOR()!.getAttribute("contenteditable")).toBe("false");
    expect(document.querySelector("[data-earlier-notes]")).not.toBeNull();
    await device.screen.unmount();

    await openUpcoming({ extra: [NOTED_OLD] });
    expect(await openMenu(itemEl(EYES_OLD.id)!.querySelector(ACTIONS))).toEqual([
      "Undo cancel",
      "Print",
      "Delete",
    ]);
    await userEvent.keyboard("{Escape}");
  });

  test("deleting the new event leaves the old one cancelled, with no link", async () => {
    const device = await openUpcoming();
    await openMenu(itemEl(EYES_NEW.id)!.querySelector(ACTIONS));
    await userEvent.click(menuItem("Delete")!);
    await expect.poll(() => dialogButton("Delete")).toBeTruthy();
    await userEvent.click(dialogButton("Delete")!);
    await device.settle();
    await expect.poll(() => itemEl(EYES_NEW.id)).toBeNull();
    expect(rowOf(EYES_OLD.id)).toMatchObject({ cancelled: true, struck: true });
    expect(itemEl(EYES_OLD.id)!.querySelector("[data-rescheduled-to]")).toBeNull();
    const old = await stored(device.db, EYES_OLD.id);
    expect(old!.cancelled_at).not.toBeNull();
    expect(old!.rescheduled_to).toBeNull();
    expect((await stored(device.db, EYES_NEW.id))!.deleted_at).not.toBeNull();
  });

  test("just move, from the entry page: the same event a day later, its link kept, not cancelled, no new event; the sheet closes there", async () => {
    const device = await openUpcoming({ url: entryUrl(CARDIOLOGY.id) });
    const before = await device.query<{ n: number }>("SELECT count(*) AS n FROM timeline_entry");
    await expect.poll(() => !!document.querySelector(ENTRY_MENU)).toBe(true);
    await openMenu(document.querySelector(ENTRY_MENU));
    await openSheet();
    await rescheduleBy(1, false);
    await device.settle();
    expect(device.location()).toBe(entryUrl(CARDIOLOGY.id));
    const row = await stored(device.db, CARDIOLOGY.id);
    expect(ms(row!.occurred_at)! - ms(CARDIOLOGY.row.occurred_at as string)!).toBe(DAY);
    expect(row!.cancelled_at).toBeNull();
    expect(await device.query("SELECT count(*) AS n FROM timeline_entry")).toEqual(before);
    expect(
      await device.query("SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ?", [
        CARDIOLOGY.id,
      ]),
    ).toEqual([{ provider_id: TRAN.id }]);
  });

  test("a past event's sheet, from a timeline row, starts with Keep off", async () => {
    await openUpcoming({ url: TIMELINE_URL });
    await expect.poll(() => !!timelineRow(BLOOD_DRAW.id)).toBe(true);
    await openMenu(timelineRow(BLOOD_DRAW.id)!.querySelector(ACTIONS));
    await openSheet();
    expect(KEEP()!.checked).toBe(false);
    await userEvent.keyboard("{Escape}");
    await expect.poll(SHEET).toBeNull();
  });

  test("a viewer's device refuses a reschedule", async () => {
    const device = await openUpcoming({ role: "viewer" });
    const res = await rescheduleEvent(device.db, CARDIOLOGY.id, {
      occurredAt: new Date(NOW.getTime() + 9 * DAY).toISOString(),
      endsAt: null,
      allDay: false,
      keepOldAsCancelled: true,
    });
    expect(res.ok).toBe(false);
    expect(await device.queued()).toEqual([]);
  });

  test("one local transaction: a failure inside it leaves no new rows, nothing queued, and the old event as it was", async () => {
    const device = await openUpcoming({ extra: [NEURO, fx.link(NEURO.id, TRAN.id)] });
    const db = device.db;
    const count = async () =>
      (
        await db.powersync.getAll(
          "SELECT (SELECT count(*) FROM timeline_entry) AS e, (SELECT count(*) FROM note_document) AS d, (SELECT count(*) FROM note_update) AS u, (SELECT count(*) FROM timeline_entry_provider) AS l, (SELECT count(*) FROM ps_crud) AS q",
        )
      )[0];
    const before = await count();
    const wrap = <T extends object>(target: T, override: Record<string, unknown>): T =>
      new Proxy(target, {
        get: (t, k) => {
          if (typeof k === "string" && k in override) return override[k];
          const v: unknown = Reflect.get(t, k);
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
        },
      });
    const drizzle = wrap(db.drizzle, {
      transaction: (fn: (tx: unknown) => Promise<unknown>) =>
        db.drizzle.transaction((tx) =>
          fn(
            wrap(tx, {
              update: () => {
                throw new Error("injected");
              },
            }),
          ),
        ),
    });
    await expect(
      rescheduleEvent({ ...db, drizzle }, NEURO.id, {
        occurredAt: new Date(NOW.getTime() + 8 * DAY).toISOString(),
        endsAt: null,
        allDay: false,
        keepOldAsCancelled: true,
      }),
    ).rejects.toThrow("injected");
    expect(await count()).toEqual(before);
    const old = await stored(db, NEURO.id);
    expect([old!.cancelled_at, old!.rescheduled_to]).toEqual([null, null]);
  });
});
