import { afterEach, describe, expect, test } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../../test/found";
import { renderWithDevice } from "../../../../../../test/device";
import { allergy } from "../../../../../../test/fixtures";
import {
  dialogButton,
  field,
  FORM,
  LISINOPRIL,
  LIST,
  MEDS,
  MEDICATION_ROUTES,
  medicationUrl,
  RECIPIENT,
  submit,
  world,
} from "../medicationWorld";

// The recipient's allergies (medications.mjs's allergy steps): the region on
// the list and on a medication's page in its three states, the allergies
// sheet (No known allergies recorded and then cleared by adding one; add,
// edit and remove behind a confirm; closing back where it was opened), one
// arriving from another device, the print block at the top of the printed
// list in print media, the name field's warning on adding and renaming
// (which still saves), and a viewer with no controls whose sheet URL shows
// the list. The device is offline throughout, so every save here is an
// offline one. The server's rules are medicationPass.int.test.ts's and
// syncPasses.int.test.ts's; an allergy and "No known allergies" reaching
// another device are roundtrip.mjs's sync matrix (6b).

const PENICILLIN = allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" });
const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: MEDICATION_ROUTES, url, fixtures: world(), role: "caretaker", ...options });

const REGION = () => document.querySelector<HTMLElement>("main [data-allergies]");
const region = () => ({
  state: REGION()?.dataset.allergies ?? null,
  text: REGION()?.querySelector("[data-allergies-text]")?.textContent?.trim() ?? null,
  link: REGION()?.querySelector("[data-edit-allergies]")?.textContent?.trim() ?? null,
});
const SHEET = () => document.querySelector<HTMLElement>("[role=dialog] [data-allergies-sheet]");
const ADD = () => SHEET()?.querySelector<HTMLFormElement>('[data-allergy-form="add"]') ?? null;
const EDIT = () => SHEET()?.querySelector<HTMLFormElement>('[data-allergy-form="edit"]') ?? null;
const rows = () =>
  [...(SHEET()?.querySelectorAll("[data-allergy-row]") ?? [])].map((li) => li.textContent?.trim());
const sheetButton = (label: string) =>
  SHEET()!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

/** Fill one of the sheet's forms and save it. */
const save = async (
  form: () => HTMLFormElement | null,
  { substance, reaction, severity }: { substance?: string; reaction?: string; severity?: string },
) => {
  await waitUntil(() => !!form(), "the allergy form");
  if (substance !== undefined)
    await userEvent.fill(await found(() => form()?.querySelector("[name=substance]")), substance);
  if (reaction !== undefined)
    await userEvent.fill(await found(() => form()?.querySelector("[name=reaction]")), reaction);
  if (severity)
    await userEvent.click(
      await found(() => form()?.querySelector(`input[name="severity"][value="${severity}"]`)),
    );
  await userEvent.click(await found(() => form()?.querySelector('button[type="submit"]')));
};
const ALLERGY_SQL =
  "SELECT substance, reaction, severity, deleted_at FROM recipient_allergy WHERE substance = ? ORDER BY created_at DESC";
const NO_KNOWN_SQL = "SELECT no_known_allergies_at AS at FROM care_recipient WHERE id = ?";

afterEach(async () => {
  await commands.media(null);
});

describe("the region and the sheet", () => {
  test("the list tab starts with the region, under the tabs: not recorded, with Add allergies for a writer", async () => {
    await open(LIST);
    await waitUntil(() => !!REGION()?.querySelector("[data-edit-allergies]"), "the region");
    expect(document.querySelector<HTMLElement>("main > header + nav")?.nextElementSibling).toBe(REGION());
    expect(region()).toEqual({
      state: "notRecorded",
      text: "Allergies not recorded",
      link: "Add allergies",
    });
  });

  test("No known allergies records at once; adding one clears it; edit in place (severe first) and remove behind a confirm (soft); Done closes back to the list", async () => {
    const device = await open(LIST);
    await waitUntil(() => !!REGION()?.querySelector("[data-edit-allergies]"), "the region");
    await userEvent.click(await found(() => REGION()?.querySelector("[data-edit-allergies]")));
    await waitUntil(() => !!ADD(), "the sheet");
    expect(device.location()).toBe(`${LIST}/allergies`);

    await userEvent.click(await found(() => SHEET()?.querySelector("[data-record-no-known]")));
    await expect.poll(() => region().state).toBe("none");
    expect(region().text).toBe("No known allergies");
    expect((await device.query<{ at: string | null }>(NO_KNOWN_SQL, [RECIPIENT.id]))[0]?.at).toBeTruthy();

    await save(ADD, { substance: "Penicillin", reaction: "hives", severity: "severe" });
    await expect.poll(rows).toEqual(["Penicillin (hives, severe)"]);
    expect(await device.query(ALLERGY_SQL, ["Penicillin"])).toEqual([
      { substance: "Penicillin", reaction: "hives", severity: "severe", deleted_at: null },
    ]);
    expect((await device.query<{ at: string | null }>(NO_KNOWN_SQL, [RECIPIENT.id]))[0]?.at).toBeNull();

    await save(ADD, { substance: "Sulfa" });
    await waitUntil(() => !!SHEET()?.querySelector('button[aria-label="Edit Sulfa"]'), "Sulfa's row");
    await userEvent.click(sheetButton("Edit Sulfa"));
    await save(EDIT, { reaction: "rash" });
    await waitUntil(() => !EDIT(), "the edit form to close");
    await device.settle();
    expect(rows()[0]).toMatch(/^Penicillin/);
    expect(rows()).toContain("Sulfa (rash)");
    expect(await device.query(ALLERGY_SQL, ["Sulfa"])).toMatchObject([
      { reaction: "rash", severity: "unknown" },
    ]);

    await userEvent.click(sheetButton("Remove Sulfa"));
    await waitUntil(() => dialogButton("Remove")?.disabled === false, "the confirm");
    await userEvent.click(await found(() => dialogButton("Remove")));
    await expect.poll(() => rows().some((t) => t?.includes("Sulfa"))).toBe(false);
    expect(
      (await device.query<{ deleted_at: string | null }>(ALLERGY_SQL, ["Sulfa"]))[0]?.deleted_at,
    ).toBeTruthy();

    await userEvent.click(await found(() => SHEET()?.querySelector("[data-allergies-done]")));
    await expect.poll(() => !SHEET() && device.location()).toBe(LIST);
    const listed = region();
    expect(listed.state).toBe("recorded");
    expect(listed.text).toMatch(/^Allergies:/);
    expect(listed.text).toContain("Penicillin (hives, severe)");
    expect(listed.link).toMatch(/^Edit/);
  });

  test("an allergy added on another device shows in the region", async () => {
    const device = await open(LIST);
    await waitUntil(() => region().state === "notRecorded", "the region");
    await device.sync(PENICILLIN);
    await device.settle();
    expect(region().text).toContain("Penicillin (hives, severe)");
  });

  test("a medication's page shows the allergies, and the sheet opened there closes back to it", async () => {
    const device = await open(medicationUrl(LISINOPRIL.id), { fixtures: [world(), PENICILLIN] });
    await waitUntil(() => !!REGION()?.querySelector("[data-edit-allergies]"), "the region");
    expect(region().text).toContain("Penicillin (hives, severe)");
    await userEvent.click(await found(() => REGION()?.querySelector("[data-edit-allergies]")));
    await waitUntil(() => !!ADD(), "the sheet");
    await userEvent.click(await found(() => SHEET()?.querySelector("[data-allergies-done]")));
    await expect.poll(() => !SHEET() && device.location()).toBe(medicationUrl(LISINOPRIL.id));
    await waitUntil(() => !!REGION(), "the page again");
  });

  test("a viewer reads the region with no controls, and the sheet's URL shows the list", async () => {
    const device = await open(`${LIST}/allergies`, { role: "viewer", fixtures: [world(), PENICILLIN] });
    await expect.poll(device.location).toBe(LIST);
    await waitUntil(() => !!REGION(), "the region");
    expect(region().state).toBe("recorded");
    await expect.poll(() => REGION()?.querySelectorAll("a, button")).toHaveLength(0);
    expect(document.querySelector<HTMLElement>("[role=dialog]")).toBeNull();
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
