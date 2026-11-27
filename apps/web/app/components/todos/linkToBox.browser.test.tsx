import type { LinkPick } from "~/lib/todos/linkOptions";

import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import { at, condition, fx, todo, TEST_GROUP } from "../../../test/fixtures";
import { LinkToBox } from "./LinkToBox";

// The shared "Link to" box (todo-links slice 1) on the real device index:
// one list of providers, medications, notes and events in site search's
// order, never a todo, a condition, another entry kind or a cancelled
// event; each choice with its type's icon and a second line; what's linked
// left out. The options' words are `linkOptions.test.ts`'s.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const when = (ms: number) => at(new Date(Date.now() + ms));

const LARK = fx.provider({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a01",
  name: "Dr. Mira Lark",
  specialty: "Cardiology",
});
const METFORMIN = fx.medication({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a02",
  name: "Metformin",
  strength: "500 mg",
  reason: "Started by Dr. Lark",
});
const NOTE = fx.note({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a03",
  occurredAt: when(-DAY),
  text: "Asked Dr. Lark about the new diet",
});
const VISIT = fx.event({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a04",
  title: "Lark follow-up",
  occurredAt: when(2 * DAY),
});
const CANCELLED = fx.event({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a05",
  title: "Lark checkup",
  occurredAt: when(3 * DAY),
  cancelledAt: when(-HOUR),
});
const TODO = todo({ id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a06", title: "Call the Lark office" });
const CONDITION = condition({ id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a07", name: "Lark syndrome" });
const DOSE = fx.dose({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0a08",
  medicationId: METFORMIN.id,
  note: "Lark said with food",
});
const WORLD = [LARK, METFORMIN, NOTE, VISIT, CANCELLED, TODO, CONDITION, DOSE];

const show = (linked: string[] = [], onPick: (pick: LinkPick) => void = () => {}) =>
  renderWithDevice({
    element: <LinkToBox groupId={TEST_GROUP.id} linked={linked} onPick={onPick} />,
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    fixtures: WORLD,
    search: true,
  });

const BOX = () => page.getByRole("combobox", { name: "Link to" });
const optionText = () =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => o.textContent);
const option = (name: RegExp) => page.getByRole("option", { name });

describe("the Link to box", () => {
  test("finds a provider, a medication, a note and an event in one list, title matches first", async () => {
    await show();
    await userEvent.click(BOX());
    await userEvent.keyboard("lark");
    await expect.poll(() => optionText().length).toBe(4);
    const texts = optionText();
    // The provider's name and the event's title match; the medication's reason and the note's text don't.
    const firstNames = texts
      .slice(0, 2)
      .map((t) => (t?.startsWith("Dr. Mira Lark") ? "provider" : t?.slice(0, 14)));
    expect(firstNames.sort()).toEqual(["Lark follow-up", "provider"]);
    expect(texts.slice(2).join(" ")).toContain("Metformin");
    expect(texts.slice(2).join(" ")).toContain("Asked Dr. Lark about the new diet");
    // Never a todo, a condition, a dose or a cancelled event.
    for (const gone of ["Call the Lark office", "Lark syndrome", "Lark checkup", "with food"])
      expect(texts.join(" ")).not.toContain(gone);
  });

  test("each option has its type's icon and its second line", async () => {
    await show();
    await userEvent.click(BOX());
    await userEvent.keyboard("lark");
    await expect.poll(() => optionText().length).toBe(4);
    const iconIn = (name: RegExp, icon: string) =>
      expect(option(name).element().querySelector(`svg[class*="lucide-${icon}"]`)).not.toBeNull();
    iconIn(/^Dr\. Mira Lark/, "stethoscope");
    iconIn(/^Metformin/, "pill");
    iconIn(/^Lark follow-up/, "calendar-clock");
    iconIn(/^Asked Dr\. Lark/, "notebook-pen");
    const line = (name: RegExp) => option(name).element().textContent;
    expect(line(/^Dr\. Mira Lark/)).toBe("Dr. Mira LarkCardiology");
    expect(line(/^Metformin/)).toBe("Metformin500 mg");
    expect(line(/^Lark follow-up/)).toMatch(/^Lark follow-up\w+, \w+ \d+ \d{1,2}:\d\d [AP]M$/);
    expect(line(/^Asked Dr\. Lark/)).toBe("Asked Dr. Lark about the new dietYesterday");
  });

  test("leaves out what's linked, and a pick says what it is and clears the text", async () => {
    const onPick = vi.fn<(pick: LinkPick) => void>();
    await show([LARK.id, NOTE.id], onPick);
    await userEvent.click(BOX());
    await userEvent.keyboard("lark");
    await expect.poll(() => optionText().length).toBe(2);
    expect(optionText().join(" ")).not.toContain("Dr. Mira Lark");
    // The event is the one title match left, so it's first.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect.poll(() => onPick.mock.calls).toEqual([[{ type: "event", id: VISIT.id }]]);
    await expect.element(BOX()).toHaveValue("");
  });
});
