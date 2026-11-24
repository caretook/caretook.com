import { afterEach, describe, expect, test } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../../test/found";
import { renderWithDevice } from "../../../../../../test/device";
import { allergy, TEST_GROUP } from "../../../../../../test/fixtures";
import {
  field,
  FORM,
  LISINOPRIL,
  LIST,
  MEDS,
  MEDICATION_ROUTES,
  medicationUrl,
  submit,
  world,
} from "../medicationWorld";
import { PROFILE_ROUTES } from "../../profile/profileWorld";

// The recipient's allergies on the Medications side: the read-only summary
// on the list and on a medication's page in its three states (a severe one
// prominent, and for writers only a Manage link to the profile, where
// they're managed since fixes-ui slice 34: profile/allergies.browser.test.tsx),
// one arriving from another device, the old allergies URL landing on the
// profile, the print block at the top of the printed list in print media,
// and the name field's warning on adding and renaming (which still saves).
// The device is offline throughout. An allergy and "No known allergies"
// reaching another device are roundtrip.mjs's sync matrix (6b).

const PENICILLIN = allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" });
const SULFA = allergy({ substance: "Sulfa", reaction: "rash", severity: "mild" });
const ROUTES = [...MEDICATION_ROUTES, ...PROFILE_ROUTES];
const PROFILE = `/app/groups/${TEST_GROUP.id}/profile`;
const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url, fixtures: world(), role: "caretaker", ...options });

const REGION = () => document.querySelector<HTMLElement>("main [data-allergies]");
const MANAGE = () => REGION()?.querySelector<HTMLAnchorElement>("a[data-manage-allergies]") ?? null;
const region = () => ({
  state: REGION()?.dataset.allergies ?? null,
  text: REGION()?.querySelector("[data-allergies-text]")?.textContent?.trim() ?? null,
  manage: MANAGE()?.textContent?.trim() ?? null,
});
/** The summary's severe allergies, as their bold text. */
const severe = () =>
  [...(REGION()?.querySelectorAll("[data-allergy][data-severe] strong") ?? [])].map((el) =>
    el.textContent?.trim(),
  );
const SHEET = () => document.querySelector<HTMLElement>("[role=dialog] [data-allergies-sheet]");

afterEach(async () => {
  await commands.media(null);
});

describe("the summary", () => {
  test("the list tab starts with the summary, under the tabs: not recorded, with Manage for a writer", async () => {
    await open(LIST);
    await waitUntil(() => !!MANAGE(), "the summary");
    expect(document.querySelector<HTMLElement>("main > header + nav")?.nextElementSibling).toBe(REGION());
    expect(region()).toEqual({
      state: "notRecorded",
      text: "Allergies not recorded",
      manage: "Manage allergies on the profile",
    });
  });

  test("it is read-only, a severe allergy first and in bold, and Manage opens the profile's allergies sheet", async () => {
    const device = await open(LIST, { fixtures: [world(), SULFA, PENICILLIN] });
    await waitUntil(() => region().state === "recorded" && !!MANAGE(), "the summary");
    expect(region().text).toBe("Allergies: Penicillin (hives, severe) · Sulfa (rash, mild)");
    expect(severe()).toEqual(["Penicillin (hives, severe)"]);
    // Manage is its only control: nothing here edits.
    expect([...REGION()!.querySelectorAll("a, button")]).toEqual([MANAGE()]);
    expect(MANAGE()!.getAttribute("href")).toBe(`${PROFILE}/allergies`);

    await userEvent.click(MANAGE()!);
    await waitUntil(() => !!SHEET(), "the profile's allergies sheet");
    expect(device.location()).toBe(`${PROFILE}/allergies`);
    expect(document.querySelector("[data-profile]")).not.toBeNull();
    await userEvent.click(await found(() => SHEET()?.querySelector("[data-allergies-done]")));
    await expect.poll(() => !SHEET() && device.location()).toBe(PROFILE);
  });

  test("an allergy added on another device shows in the summary", async () => {
    const device = await open(LIST);
    await waitUntil(() => region().state === "notRecorded", "the summary");
    await device.sync(PENICILLIN);
    await device.settle();
    expect(region().text).toContain("Penicillin (hives, severe)");
    expect(severe()).toEqual(["Penicillin (hives, severe)"]);
  });

  test("a medication's page shows the summary, severe in bold, with Manage to the profile", async () => {
    await open(medicationUrl(LISINOPRIL.id), { fixtures: [world(), PENICILLIN] });
    await waitUntil(() => !!MANAGE(), "the summary");
    expect(region().text).toContain("Penicillin (hives, severe)");
    expect(severe()).toEqual(["Penicillin (hives, severe)"]);
    expect(MANAGE()!.getAttribute("href")).toBe(`${PROFILE}/allergies`);
  });

  test("a viewer reads the summary with no controls", async () => {
    await open(LIST, { role: "viewer", fixtures: [world(), PENICILLIN] });
    await waitUntil(() => region().state === "recorded", "the summary");
    expect(severe()).toEqual(["Penicillin (hives, severe)"]);
    await expect.poll(() => REGION()?.querySelectorAll("a, button")).toHaveLength(0);
  });
});

describe("the old allergies URL", () => {
  test.each(["list", "schedule"] as const)(
    "over the %s tab, it lands a writer on the profile's allergies sheet",
    async (tab) => {
      const device = await open(`${MEDS}/${tab}/allergies`, { fixtures: [world(), PENICILLIN] });
      await expect.poll(device.location).toBe(`${PROFILE}/allergies`);
      await waitUntil(() => !!SHEET(), "the profile's allergies sheet");
      expect(document.querySelector("main [data-section=allergies]")).not.toBeNull();
    },
  );

  test("it lands a viewer on the profile, with the Allergies section", async () => {
    const device = await open(`${LIST}/allergies`, { role: "viewer", fixtures: [world(), PENICILLIN] });
    await expect.poll(device.location).toBe(PROFILE);
    await waitUntil(() => !!document.querySelector("main [data-section=allergies]"), "the section");
    expect(SHEET()).toBeNull();
  });
});

describe("the printed list", () => {
  test.each([420, 1280])(
    "at %i in print media, the allergies are at the top, above the medications",
    async (width) => {
      await open(`${MEDS}/print`, { width, frame: true, fixtures: [world(), PENICILLIN] });
      await waitUntil(
        () => !!document.querySelector<HTMLElement>("main [data-print-allergies]"),
        "the print block",
      );
      await commands.media("print");
      const block = document.querySelector<HTMLElement>("main [data-print-allergies]")!;
      const current = document.querySelector<HTMLElement>('main [data-print-section="print-current"]')!;
      expect(block.dataset.printAllergies).toBe("recorded");
      expect(
        [...document.querySelectorAll<HTMLElement>("main [data-print-allergy]")].map((li) =>
          li.textContent?.trim(),
        ),
      ).toContain("Penicillin (hives, severe)");
      expect(block.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(block.getClientRects().length).toBeGreaterThan(0);
      expect(block.getBoundingClientRect().right).toBeLessThanOrEqual(
        document.documentElement.clientWidth + 0.5,
      );
    },
  );
});

describe("the name field's warning", () => {
  const warning = () => {
    const input = field("name");
    return input ? (document.getElementById(`${input.id}-warn`)?.textContent?.trim() ?? null) : null;
  };

  test("adding a medication whose name matches an allergy warns on the name; a partial-word match doesn't", async () => {
    await open(`${LIST}/new`, { fixtures: [world(), PENICILLIN] });
    await waitUntil(() => !!FORM(), "the add sheet");
    await userEvent.fill(await found(() => field("name")), "penicillin VK");
    await expect.poll(warning).toBe("Matches an allergy on file: Penicillin (severe)");
    await userEvent.fill(await found(() => field("name")), "Amoxicillin");
    await expect.poll(warning).toBe(null);
  });

  test("renaming a medication to a matching name warns (not an error) and still saves", async () => {
    const device = await open(`${LIST}/${LISINOPRIL.id}/edit`, { fixtures: [world(), PENICILLIN] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    await userEvent.fill(await found(() => field("name")), "Penicillin VK");
    await expect.poll(warning).toBe("Matches an allergy on file: Penicillin (severe)");
    expect(field("name")?.getAttribute("aria-invalid")).not.toBe("true");
    await userEvent.click(submit());
    await waitUntil(() => !FORM(), "the sheet to close");
    await device.settle();
    expect(await device.query("SELECT name FROM medication WHERE id = ?", [LISINOPRIL.id])).toEqual([
      { name: "Penicillin VK" },
    ]);
  });
});
