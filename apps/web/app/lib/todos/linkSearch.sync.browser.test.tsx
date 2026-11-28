import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../test/device";
import { at, fx, TEST_GROUP } from "../../../test/fixtures";
import { suggestLinkables } from "./linkSearch.sync";

// The empty "Link to…" box's suggestions on the device (B-947): the group's
// next events come from `upcomingEvents`, which reads in start order before
// Upcoming's rules drop what's over (B-993).

/**
 * 10:30 UTC: yesterday's all-day events (in UTC) and the day before's (in
 * Pago Pago, UTC-11, a day that ended at 11:00 UTC yesterday) are over, but
 * all start inside the query's two-day window.
 */
const NOW = new Date("2026-03-10T10:30:00.000Z");

const allDay = (title: string, start: string, timeZone: string) =>
  fx.event({ title, occurredAt: at(start), allDay: 1, timeZone });

/** Far more than the query's `limit + 10`, all over by `NOW`. */
const ended = [
  ...Array.from({ length: 16 }, (_, i) => allDay(`Respite day ${i + 1}`, "2026-03-09T00:00:00.000Z", "UTC")),
  ...Array.from({ length: 12 }, (_, i) =>
    allDay(`Garden day ${i + 1}`, "2026-03-08T11:00:00.000Z", "Pacific/Pago_Pago"),
  ),
];

const TOMORROW = fx.event({
  id: "3b8d5f10-6c2a-4e7d-9f41-2a7c0e5db001",
  title: "Physio with Dr. Wren",
  occurredAt: at("2026-03-11T10:00:00.000Z"),
  endsAt: at("2026-03-11T11:00:00.000Z"),
});

describe("suggestLinkables", () => {
  test("past all-day events don't crowd the next timed event out of the suggestions", async () => {
    const { db } = await renderWithDevice({
      element: <p>Device</p>,
      url: `/app/groups/${TEST_GROUP.id}/todos`,
      fixtures: [ended, TOMORROW],
    });
    const suggested = await suggestLinkables(db, TEST_GROUP.id, { now: NOW });
    expect(suggested.map((c) => c.id)).toEqual(["3b8d5f10-6c2a-4e7d-9f41-2a7c0e5db001"]);
  });
});
