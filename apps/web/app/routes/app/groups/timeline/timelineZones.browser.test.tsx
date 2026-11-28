import { describe, expect, test } from "vitest";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_TIME_ZONE } from "../../../../../test/fixtures";
import { fixClock, waitUntil } from "../../../../../test/found";
import { deviceZone, recipientTime, SECOND_ZONE } from "../../../../../test/zone";
import { rows, rowWith, TIMELINE_ROUTES, TIMELINE_URL } from "./timelineWorld";
import { zonedInstant } from "@caretook/data/domain";

// Doses across midnight with the device and the recipient in different zones
// (B-372). The recipient is in Los Angeles; `web:components` runs the device
// there too, `web:components:ny` in New York, three hours ahead. A dose given
// at 22:30 in Los Angeles is 01:30 the next day in New York: the timeline
// shows it on the viewer's day at the viewer's time, with the time where it
// was given beside it, and one at 20:30 stays on the day before in both.

const inNewYork = deviceZone() === SECOND_ZONE;

const LATE = fx.medication({ name: "Sennaquil", strength: "10 mg" });
const EARLY = fx.medication({ name: "Doloramine", strength: "5 mg" });

const dayOf = (text: string) => rowWith(text)?.closest("section")?.querySelector("h3")?.textContent?.trim();
const timeOf = (text: string) => rowWith(text)?.querySelector("time")?.textContent?.trim();
const elsewhereOf = (text: string) =>
  [...(rowWith(text)?.querySelectorAll("p") ?? [])]
    .map((p) => p.textContent?.trim())
    .find((t) => t?.includes(" in "));

describe("a dose across midnight", () => {
  test("the recipient is in Los Angeles; the device in its project's zone", () => {
    expect(TEST_TIME_ZONE).toBe("America/Los_Angeles");
    expect([TEST_TIME_ZONE, SECOND_ZONE]).toContain(deviceZone());
  });

  test("the timeline puts it on the viewer's day at the viewer's time, with the recipient's time beside it in New York", async () => {
    // 13:00 on Wed Jun 9 2027 in Los Angeles (16:00 in New York).
    fixClock(zonedInstant("2027-06-09", "13:00", TEST_TIME_ZONE));
    await renderWithDevice({
      route: TIMELINE_ROUTES,
      url: TIMELINE_URL,
      role: "caretaker",
      fixtures: [
        LATE,
        EARLY,
        // Tue Jun 8, 22:30 in Los Angeles: Wed Jun 9, 01:30 in New York.
        fx.dose({ medicationId: LATE.id, occurredAt: at(recipientTime(1, 22, 30)) }),
        // Tue Jun 8, 20:30 in Los Angeles: 23:30 the same day in New York.
        fx.dose({ medicationId: EARLY.id, occurredAt: at(recipientTime(1, 20, 30)) }),
      ],
    });
    await waitUntil(() => rows().length >= 2 && dayOf("Sennaquil") && dayOf("Doloramine"), "both doses");

    if (inNewYork) {
      expect(dayOf("Sennaquil")).toBe("Today");
      expect(timeOf("Sennaquil")).toBe("1:30 AM");
      expect(elsewhereOf("Sennaquil")).toBe("10:30 PM in Los Angeles");
      expect(dayOf("Doloramine")).toBe("Yesterday");
      expect(timeOf("Doloramine")).toBe("11:30 PM");
      expect(elsewhereOf("Doloramine")).toBe("8:30 PM in Los Angeles");
    } else {
      expect(dayOf("Sennaquil")).toBe("Yesterday");
      expect(timeOf("Sennaquil")).toBe("10:30 PM");
      expect(elsewhereOf("Sennaquil")).toBeUndefined();
      expect(dayOf("Doloramine")).toBe("Yesterday");
      expect(timeOf("Doloramine")).toBe("8:30 PM");
    }
  });
});
