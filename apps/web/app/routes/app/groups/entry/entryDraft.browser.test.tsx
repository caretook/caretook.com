import type { DeviceRoute } from "../../../../../test/device";
import type { EventDraft } from "~/lib/assistant/quickEntryDraft";

import { useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";
import { QUICK_ENTRY_DRAFT } from "~/lib/assistant/quickEntryDraft";
import * as entryRoute from "./route";

// The new-event page opened with a draft (quick entry's provider events,
// history state): its title, day (all day), place and providers shown, and
// nothing written until a real change, which writes the event linked to the
// providers. Opened with only `?provider=` it behaves as before. How quick
// entry opens it is timelineQuickEntry.browser.test.tsx's.

const GROUP = TEST_GROUP.id;
const ADDRESS = "400 Example Ave, Springfield";
const ALVAREZ = fx.provider({ name: "Dr. Elena Alvarez", address: ADDRESS });
const LEE = fx.provider({ name: "Dr. Sandra Lee" });
const NEW_EVENT = `/app/groups/${GROUP}/entries/new?kind=event`;
const LAUNCH = `/app/groups/${GROUP}/launch`;
const ON_ENTRY = /\/entries\/[0-9a-f-]{36}$/;

/** The 25th of next month at midnight on the test device (Los Angeles). */
const day25 = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  return new Date(now.getFullYear(), month, 25).toISOString();
};

const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
  kind: "event",
  title: "Dr. Elena Alvarez",
  occurredAt: day25(),
  allDay: true,
  place: ADDRESS,
  providerIds: [ALVAREZ.id],
  timeZone: "America/Los_Angeles",
  ...over,
});

/** Stands in for quick entry: a button that opens the new-event page with a draft in history state. */
const launcher = (state: EventDraft) =>
  function Launch() {
    const navigate = useNavigate();
    return (
      <button
        type="button"
        onClick={() => void navigate(NEW_EVENT, { state: { [QUICK_ENTRY_DRAFT]: state } })}
      >
        Open the draft
      </button>
    );
  };

const routes = (state: EventDraft): DeviceRoute[] => [
  { path: "/app/groups/:groupId/launch", module: { default: launcher(state) } },
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
];

const open = async (state: EventDraft) => {
  const device = await renderWithDevice({ route: routes(state), url: LAUNCH, fixtures: [ALVAREZ, LEE] });
  await userEvent.click(await found(() => buttonNamed("Open the draft")));
  await expect.poll(() => device.location()).toBe(NEW_EVENT);
  return device;
};
const buttonNamed = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === name);
const TITLE = () => document.querySelector<HTMLInputElement>("main header input");
const HEADER_TIME = () => document.querySelector<HTMLTimeElement>("main header time");
const PLACE = () => document.querySelector<HTMLInputElement>('main [data-region="place"] input');
const EDITOR = () => document.querySelector<HTMLElement>(".ProseMirror");
const chipNames = () =>
  [...document.querySelectorAll('main header [data-region="with"] li[data-chip]')].map((li) =>
    li.textContent.trim(),
  );

type Device = Awaited<ReturnType<typeof renderWithDevice>>;
const events = (device: Device) =>
  device.query<{ id: string; title: string; all_day: number; place: string | null; occurred_at: string }>(
    "SELECT id, title, all_day, place, occurred_at FROM timeline_entry WHERE kind = 'event'",
  );
const links = async (device: Device, entryId: string) =>
  (
    await device.query<{ provider_id: string }>(
      "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ? ORDER BY created_at",
      [entryId],
    )
  ).map((r) => r.provider_id);

describe("the new-event page with a quick entry draft", () => {
  test("shows the title, the day (all day), the provider and the place, and writes nothing", async () => {
    const device = await open(draft());
    await expect.poll(() => TITLE()?.value).toBe("Dr. Elena Alvarez");
    await expect.poll(() => HEADER_TIME()?.textContent ?? "").toMatch(/All day/);
    expect(HEADER_TIME()?.textContent).toMatch(/25/);
    await expect.poll(chipNames).toEqual(["Dr. Elena Alvarez"]);
    await expect.poll(() => PLACE()?.value).toBe(ADDRESS);
    expect(await events(device)).toEqual([]);
    expect(await device.queued()).toEqual([]);
  });

  test("a first real change writes one event with the draft's fields, linked to its providers", async () => {
    const device = await open(draft({ providerIds: [ALVAREZ.id, LEE.id] }));
    await expect.poll(chipNames).toEqual(["Dr. Elena Alvarez", "Dr. Sandra Lee"]);
    await userEvent.click(await found(EDITOR));
    await userEvent.keyboard("Ask about the new pills");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const [event] = await events(device);
    expect(event).toMatchObject({ title: "Dr. Elena Alvarez", all_day: 1, place: ADDRESS });
    expect(event?.occurred_at).toMatch(/^\d{4}-\d{2}-25T0[78]:00:00/);
    await expect.poll(() => links(device, event!.id)).toEqual([ALVAREZ.id, LEE.id]);
    await expect.poll(chipNames).toEqual(["Dr. Elena Alvarez", "Dr. Sandra Lee"]);
  });

  test("a provider removed from the draft isn't linked", async () => {
    const device = await open(draft({ providerIds: [ALVAREZ.id, LEE.id] }));
    await expect.poll(chipNames).toEqual(["Dr. Elena Alvarez", "Dr. Sandra Lee"]);
    await userEvent.click(
      await found(() =>
        document.querySelector<HTMLElement>('main header button[aria-label="Remove Dr. Sandra Lee"]'),
      ),
    );
    await expect.poll(chipNames).toEqual(["Dr. Elena Alvarez"]);
    expect(await events(device)).toEqual([]);
    await userEvent.click(await found(EDITOR));
    await userEvent.keyboard("Bring the list");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const [event] = await events(device);
    await expect.poll(() => links(device, event!.id)).toEqual([ALVAREZ.id]);
  });

  test("opened with only ?provider=: an empty draft, linked to the provider once it's saved, as before", async () => {
    const device = await renderWithDevice({
      route: routes(draft()),
      url: `${NEW_EVENT}&provider=${LEE.id}`,
      fixtures: [ALVAREZ, LEE],
    });
    await found(EDITOR);
    expect(TITLE()?.value).toBe("");
    expect(PLACE()?.value).toBe("");
    expect(HEADER_TIME()?.textContent ?? "").not.toMatch(/All day/);
    await expect.poll(chipNames).toEqual(["Dr. Sandra Lee"]);
    expect(await events(device)).toEqual([]);

    await userEvent.click(await found(EDITOR));
    await userEvent.keyboard("Checkup");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const [event] = await events(device);
    expect(event?.title).toBe("Event");
    await expect.poll(() => links(device, event!.id)).toEqual([LEE.id]);
  });
});
