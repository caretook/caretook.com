import type { LinkPick } from "~/lib/todos/linkOptions";

import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../test/device";
import type { Fixture } from "../../../test/fixtures";

import {
  at,
  condition,
  fx,
  medicationCondition,
  recordTag,
  tag,
  todo,
  TEST_GROUP,
} from "../../../test/fixtures";
import { LinkToBox } from "./LinkToBox";

// The shared "Link to" box (todo-links slice 1) on the real device index:
// one list of providers, medications, notes and events in site search's
// order, never a todo, a condition, another entry kind or a cancelled
// event; each choice with its type's icon and a second line; what's linked
// left out. The options' words are `linkOptions.test.ts`'s. Slice 3: the
// type chips and typed type words, and what the box finds by (B-946's
// phones and linked conditions, B-988, B-989).

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

const show = (
  linked: string[] = [],
  onPick: (pick: LinkPick) => void = () => {},
  fixtures: readonly Fixture[] = WORLD,
) =>
  renderWithDevice({
    element: <LinkToBox groupId={TEST_GROUP.id} linked={linked} onPick={onPick} />,
    url: `/app/groups/${TEST_GROUP.id}/todos`,
    fixtures,
    search: true,
  });

const BOX = () => page.getByRole("combobox", { name: "Link to" });
const optionText = () =>
  [...document.querySelectorAll<HTMLElement>('[role="option"]')].map((o) => o.textContent);
const option = (name: RegExp) => page.getByRole("option", { name });
// While the list is open, React Aria hides the rest of the page from the
// accessibility tree, so the chips are found by their text, as a tap finds them.
const chip = (name: string) => page.getByCss('[aria-label="Link type"]').getByText(name, { exact: true });
const pressed = () =>
  [...document.querySelectorAll<HTMLElement>('[aria-label="Link type"] [aria-pressed="true"]')].map(
    (b) => b.textContent,
  );
/** Replace the box's text with `text`, as typed. */
const search = async (text: string) => {
  await userEvent.clear(BOX());
  await userEvent.click(BOX());
  await userEvent.keyboard(text);
};
const names = () => optionText().flatMap((t) => (t && t !== "Nothing to link matches" ? [t] : []));

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

describe("the Link to box's type chips and type words", () => {
  test("a chip narrows to its type, one on at a time; All is on at first", async () => {
    await show();
    expect(pressed()).toEqual(["All"]);
    await search("lark");
    await expect.poll(() => optionText().length).toBe(4);
    await userEvent.click(chip("Providers"));
    expect(pressed()).toEqual(["Providers"]);
    await expect.poll(names).toEqual(["Dr. Mira LarkCardiology"]);
    await userEvent.click(chip("Meds"));
    expect(pressed()).toEqual(["Meds"]);
    await expect.poll(() => names().map((t) => t.slice(0, 9))).toEqual(["Metformin"]);
    await userEvent.click(chip("Notes"));
    await expect.poll(() => names().map((t) => t.slice(0, 14))).toEqual(["Asked Dr. Lark"]);
    await userEvent.click(chip("Events"));
    await expect.poll(() => names().map((t) => t.slice(0, 14))).toEqual(["Lark follow-up"]);
    await userEvent.click(chip("All"));
    await expect.poll(() => optionText().length).toBe(4);
  });

  test("a type word typed first or last turns its chip on and is left out of the search", async () => {
    await show();
    await search("provider lark");
    await expect.poll(pressed).toEqual(["Providers"]);
    await expect.poll(names).toEqual(["Dr. Mira LarkCardiology"]);
    await search("lark notes");
    await expect.poll(pressed).toEqual(["Notes"]);
    await expect.poll(() => names().map((t) => t.slice(0, 14))).toEqual(["Asked Dr. Lark"]);
    // A chip tapped takes the typed word out, keeping the rest.
    await userEvent.click(chip("Events"));
    await expect.element(BOX()).toHaveValue("lark");
    await expect.poll(() => names().map((t) => t.slice(0, 14))).toEqual(["Lark follow-up"]);
  });
});

// What the box finds by: names, practices, phones, brands, reasons, linked
// conditions, places, an event's providers, a note's text and tag names.
const PRACTICE = fx.provider({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b01",
  type: "practice",
  name: "Brookside Neurology Group",
  specialty: null,
  phones: [],
});
const LEE = fx.provider({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b02",
  name: "Dr. Ana Lee",
  specialty: "Neurology",
  practiceId: PRACTICE.id,
  phones: [{ label: "Office", number: "(555) 010-0134" }],
});
const GLUCOPHAGE = fx.medication({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b03",
  name: "Metformin (Glucophage)",
  strength: "500 mg",
  reason: "Blood sugar",
});
const PREDIABETES = condition({ id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b04", name: "Prediabetes" });
const FOR_PREDIABETES = medicationCondition(GLUCOPHAGE.id, PREDIABETES.id);
const NEURO = fx.event({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b05",
  title: "Neuro visit",
  place: "Harbor Clinic",
  occurredAt: when(4 * DAY),
});
const WITH_LEE = fx.link(NEURO.id, LEE.id);
const WALKER = fx.note({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b06",
  occurredAt: when(-2 * DAY),
  text: "Picked up the walker rental",
});
const BOXES = fx.note({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b07",
  occurredAt: when(-3 * DAY),
  text: "Packed the kitchen boxes",
});
const EYE = fx.event({
  id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b0a",
  title: "Eye doctor",
  occurredAt: when(5 * DAY),
});
const MOVING = tag("Moving day");
const BOXES_TAGGED = recordTag(MOVING.id, BOXES.id);
const FINDS = [
  PRACTICE,
  LEE,
  GLUCOPHAGE,
  PREDIABETES,
  FOR_PREDIABETES,
  NEURO,
  WITH_LEE,
  WALKER,
  BOXES,
  MOVING,
  BOXES_TAGGED,
  EYE,
];

describe("what the Link to box finds by", () => {
  test("a provider's name with a type word, practice and phone; a medication's brand, reason and linked condition", async () => {
    const device = await show([], () => {}, FINDS);
    await search("provider lee");
    await expect.poll(pressed).toEqual(["Providers"]);
    await expect.poll(() => names().map((t) => t.slice(0, 11))).toEqual(["Dr. Ana Lee"]);
    await userEvent.click(chip("All"));
    const finds = async (text: string, name: string) => {
      await search(text);
      await expect.poll(() => names().some((t) => t.startsWith(name)), { message: text }).toBe(true);
    };
    await finds("brookside", "Dr. Ana Lee");
    await finds("555 010 0134", "Dr. Ana Lee");
    await finds("5550100134", "Dr. Ana Lee");
    await finds("glucophage", "Metformin (Glucophage)");
    await finds("blood sugar", "Metformin (Glucophage)");
    await finds("prediabetes", "Metformin (Glucophage)");

    // The condition renamed: the medication is found by its new name, not its old one.
    await device.sync([condition({ id: PREDIABETES.id, name: "Insulin resistance" })]);
    await device.settle();
    await search("insulin");
    await expect.poll(() => names().some((t) => t.startsWith("Metformin (Glucophage)"))).toBe(true);
    await search("prediabetes");
    await expect.poll(names).toEqual([]);
  });

  test("an event by its place and its provider, a note by its text, an item by its tag's name", async () => {
    await show([], () => {}, FINDS);
    await search("harbor");
    await expect.poll(() => names().map((t) => t.slice(0, 11))).toEqual(["Neuro visit"]);
    await search("event lee");
    await expect.poll(() => names().map((t) => t.slice(0, 11))).toEqual(["Neuro visit"]);
    await search("walker");
    await expect.poll(() => names().map((t) => t.slice(0, 15))).toEqual(["Picked up the w"]);
    await search("moving");
    await expect.poll(() => names().map((t) => t.slice(0, 15))).toEqual(["Packed the kitc"]);
    // A type word that finds nothing of its type is searched as typed: an event named "Eye doctor".
    await search("eye doctor");
    await expect.poll(() => names().map((t) => t.slice(0, 10))).toEqual(["Eye doctor"]);
  });

  test("renaming a tag, or tagging and untagging, refreshes an open tag-name search (B-989)", async () => {
    const device = await show([], () => {}, FINDS);
    await search("relocation");
    await expect.poll(names).toEqual([]);
    await device.sync([tag("Moving day", { name: "Relocation" })]);
    await device.settle();
    await expect.poll(() => names().map((t) => t.slice(0, 15))).toEqual(["Packed the kitc"]);
    await device.sync([recordTag(MOVING.id, WALKER.id)]);
    await device.settle();
    await expect.poll(() => names().length).toBe(2);
    await device.unsync([BOXES_TAGGED]);
    await device.settle();
    await expect.poll(() => names().map((t) => t.slice(0, 15))).toEqual(["Picked up the w"]);
  });

  test("many matching doses don't hide a matching note (B-988)", async () => {
    const LISINOPRIL = fx.medication({ id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b08", name: "Lisinopril" });
    const doses = Array.from({ length: 120 }, (_, i) =>
      fx.dose({ medicationId: LISINOPRIL.id, occurredAt: when(-(i + 1) * HOUR) }),
    );
    const question = fx.note({
      id: "5b2d8e61-3c7a-4f19-9e04-1d6a2c8b0b09",
      occurredAt: when(-10 * DAY),
      text: "Ask whether the lisinopril can move to evenings",
    });
    await show([], () => {}, [LISINOPRIL, ...doses, question]);
    await search("lisinopril");
    // The medication (a title match), then the note; never the doses.
    await expect.poll(() => names().length).toBe(2);
    expect(names()[0]).toMatch(/^Lisinopril/);
    expect(names()[1]).toMatch(/^Ask whether the lisinopril/);
  });
});
