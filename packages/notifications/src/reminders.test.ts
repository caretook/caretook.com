import type { ReminderItem } from "@caretook/data/schema";

import { describe, expect, it } from "vitest";
import { reminderEmailData } from "./reminders";
import { renderNotification } from "./render";

// The two reminder emails (appointments-2 slice 6), rendered from a send the
// way the sweep builds them: generic says only the kind, whose it is, the
// time and a link; details add the title, place and providers. Made up.

const APP_URL = "https://app.example.test";
const GROUP = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const ENTRY = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0002";
const TODO = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0003";
const UNSUBSCRIBE = "/api/reminders/unsubscribe/user.group.signature";
const LA = "America/Los_Angeles";

const appointment: ReminderItem = {
  uid: `entry:${ENTRY}`,
  source: { type: "entry", id: ENTRY },
  groupId: GROUP,
  kind: "appointment",
  allDay: false,
  start: "2026-11-19T17:00:00.000Z",
  end: "2026-11-19T18:00:00.000Z",
  timeZone: LA,
  status: "confirmed",
  recipientName: "Pat",
  title: "Kidney dialysis",
  place: "Riverside Clinic",
  providers: ["Dr. Rivera Example"],
  series: null,
  appUrl: `/app/groups/${GROUP}/entries/${ENTRY}`,
  createdAt: "2026-11-01T00:00:00.000Z",
};

const todo: ReminderItem = {
  ...appointment,
  uid: `todo:${TODO}`,
  source: { type: "todo", id: TODO },
  kind: "todo",
  end: "2026-11-19T17:30:00.000Z",
  title: "Refill the insulin",
  place: null,
  providers: [],
  appUrl: `/app/groups/${GROUP}/todos/${TODO}`,
};

const render = async (
  name: "appointmentReminder" | "todoDue",
  item: ReminderItem,
  level: "generic" | "details",
) => {
  const out = await renderNotification(name, reminderEmailData({ item, timeZone: LA }, level, UNSUBSCRIBE), {
    recipient: "ana@example.com",
    appUrl: APP_URL,
  });
  if ("code" in out) throw new Error(String(out.code));
  return out;
};

describe("reminder emails", () => {
  it("say only the kind, the time and a link in the generic form", async () => {
    const visit = await render("appointmentReminder", appointment, "generic");
    expect(visit.subject).toBe("Event for Pat · Thu, Nov 19 · 9:00–10:00 AM PST");
    const due = await render("todoDue", todo, "generic");
    expect(due.subject).toBe("Todo for Pat · Thu, Nov 19 · 9:00 AM PST");
    for (const out of [visit, due]) {
      expect(out.html).toContain("<html");
      for (const part of [out.subject, out.html, out.text]) {
        for (const secret of ["dialysis", "Kidney", "Riverside", "Rivera", "insulin"]) {
          expect(part).not.toContain(secret);
        }
      }
      expect(out.text).toContain(`${APP_URL}${UNSUBSCRIBE}`);
      expect(out.text).toContain("Turn off reminder emails");
    }
    expect(visit.text).toContain(`${APP_URL}/app/groups/${GROUP}/entries/${ENTRY}`);
    expect(due.text).toContain(`${APP_URL}/app/groups/${GROUP}/todos/${TODO}`);
  });

  it("add the title, place and providers with details", async () => {
    const visit = await render("appointmentReminder", appointment, "details");
    expect(visit.subject).toBe("Event for Pat: Kidney dialysis · Thu, Nov 19 · 9:00–10:00 AM PST");
    expect(visit.text).toContain("At Riverside Clinic");
    expect(visit.text).toContain("With Dr. Rivera Example");
    const due = await render("todoDue", todo, "details");
    expect(due.subject).toBe("Todo for Pat: Refill the insulin · Thu, Nov 19 · 9:00 AM PST");
  });

  it("put the times in the member's zone", () => {
    const data = reminderEmailData({ item: appointment, timeZone: "Europe/London" }, "generic", UNSUBSCRIBE);
    expect(data.when).toBe("Thu, Nov 19 · 5:00–6:00 PM GMT");
  });
});
