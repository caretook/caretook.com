import type { Fixtures } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { fx, newId, symptomType } from "../../../../../test/fixtures";
import { rowWith, TIMELINE_URL as T, openTimeline } from "./timelineWorld";

// The symptom sheet's name field suggests the group's catalog (symptom-catalog
// slice 1): a native `datalist` read from the local copy, so it works
// offline and follows what sync brings. Any other name can still be typed.

const NAME = () => document.querySelector<HTMLInputElement>('[role=dialog] input[name="symptomName"]');
const SUBMIT = () => document.querySelector<HTMLButtonElement>('[role=dialog] button[type="submit"]');
const suggestions = () => {
  const id = NAME()?.getAttribute("list");
  const list = id ? document.getElementById(id) : null;
  return list ? [...list.querySelectorAll("option")].map((o) => o.value) : [];
};

const OTHER_GROUP = newId();

const openAdd = (fixtures: Fixtures) =>
  openTimeline({ url: `${T}/new/symptom?kind=symptom`, role: "caretaker", fixtures });

describe("the symptom sheet's suggestions", () => {
  test("lists the group's catalog A to Z, and no other group's", async () => {
    await openAdd([
      symptomType("Nausea"),
      symptomType("Fall"),
      symptomType("Knee pain"),
      fx.group({ id: OTHER_GROUP, name: "Another family" }),
      symptomType("Hiccups", { groupId: OTHER_GROUP }),
    ]);
    await found(NAME);
    expect(NAME()!.tagName).toBe("INPUT");
    await expect.poll(suggestions).toEqual(["Fall", "Knee pain", "Nausea"]);
  });

  test("follows a type that arrives by sync", async () => {
    const device = await openAdd([symptomType("Nausea")]);
    await expect.poll(suggestions).toEqual(["Nausea"]);
    await device.sync(symptomType("Dizziness"));
    await expect.poll(suggestions).toEqual(["Dizziness", "Nausea"]);
  });

  test("still saves a name that isn't in the catalog", async () => {
    await openAdd([symptomType("Nausea")]);
    await userEvent.fill(await found(NAME), "Sore elbow");
    await userEvent.click(await found(SUBMIT));
    await expect.poll(() => rowWith("Sore elbow")).toBeTruthy();
  });
});
