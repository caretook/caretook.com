import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { allergy, at, fx, TEST_RECIPIENT } from "../../../../../test/fixtures";
import { getByCss } from "../../../../../test/locators";
import { JUNE, openProfile, PROFILE_URL, sections } from "./profileWorld";

// The recipient's allergies on the profile (fixes-ui slice 34; they were a
// medications sheet): the section for each role and state (on file, most
// severe first and a severe one marked; No known allergies; not recorded),
// No known allergies recorded and cleared from the section, the sheet over
// the profile (add, which clears No known allergies; edit; remove behind a
// confirm, soft; Done back to the profile), and a viewer with no controls
// whose sheet URL shows the profile. The device is offline throughout, so
// every write is a local one. The Medications summary and the old URL are
// medications/allergies/allergies.browser.test.tsx's; the server's rules are
// recipientAllergy's integration tests; an allergy reaching another device is
// roundtrip's sync matrix (6b).

const SECTION = () => document.querySelector<HTMLElement>("main [data-section=allergies]");
const section = () => {
  const el = SECTION();
  return {
    state: el?.dataset.allergies ?? null,
    rows: [...(el?.querySelectorAll("[data-allergy]") ?? [])].map((li) => li.textContent?.trim()),
    severe: [...(el?.querySelectorAll("[data-allergy][data-severe]") ?? [])].map((li) =>
      li.textContent?.trim(),
    ),
    edit: el?.querySelector("a[data-edit-allergies]")?.textContent?.trim() ?? null,
  };
};
const SHEET = () => document.querySelector<HTMLElement>("[role=dialog] [data-allergies-sheet]");
const ADD = () => SHEET()?.querySelector<HTMLFormElement>('[data-allergy-form="add"]') ?? null;
const EDIT = () => SHEET()?.querySelector<HTMLFormElement>('[data-allergy-form="edit"]') ?? null;
const sheetRows = () =>
  [...(SHEET()?.querySelectorAll("[data-allergy-row]") ?? [])].map((li) => li.textContent?.trim());
const sheetButton = (label: string) =>
  SHEET()!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const dialogButton = (text: string) =>
  getByCss("dialog[open] button")
    .filter({ hasText: new RegExp(`^${text}$`) })
    .first();

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

const PENICILLIN = allergy({ substance: "Penicillin", reaction: "hives", severity: "severe" });
const LATEX = allergy({ substance: "Latex", severity: "mild" });
const GONE = allergy({ substance: "Shellfish", deletedAt: at() });

const open = (role: GroupRole, options: Parameters<typeof openProfile>[0] = {}) =>
  openProfile({ role, connected: false, ...options });

describe("the section", () => {
  test.each(["owner", "caretaker", "viewer"] as const)(
    "as %s: after Basics, before Conditions; most severe first, a severe one marked; a deleted one is gone",
    async (role) => {
      await open(role, { fixtures: [LATEX, PENICILLIN, GONE] });
      await expect.poll(() => section().rows).toEqual(["Penicillin (hives, severe)", "Latex (mild)"]);
      expect(sections().slice(0, 3)).toEqual(["basics", "allergies", "conditions"]);
      expect(section()).toMatchObject({
        state: "recorded",
        severe: ["Penicillin (hives, severe)"],
        edit: role === "viewer" ? null : "Edit allergies",
      });
    },
  );

  test("a viewer sees No known allergies and not recorded as text, with no controls; the sheet's URL shows the profile", async () => {
    const device = await open("viewer", { url: `${PROFILE_URL}/allergies` });
    await expect.poll(device.location).toBe(PROFILE_URL);
    await waitUntil(() => section().state === "notRecorded", "the section");
    expect(SECTION()?.textContent).toContain("Allergies not recorded");
    expect(SECTION()?.querySelectorAll("a, button")).toHaveLength(0);
    expect(SHEET()).toBeNull();

    await device.sync(fx.recipient({ ...JUNE, noKnownAllergiesAt: at() }));
    await device.settle();
    await expect.poll(() => section().state).toBe("none");
    expect(SECTION()?.textContent).toContain("No known allergies");
    expect(SECTION()?.querySelectorAll("a, button")).toHaveLength(0);
  });

  test("not recorded: a writer records No known allergies offline, and clears it", async () => {
    const device = await open("caretaker");
    await waitUntil(() => section().state === "notRecorded", "the section");
    expect(section().edit).toBe("Add allergies");
    await userEvent.click(await found(() => SECTION()?.querySelector("[data-record-no-known]")));
    await expect.poll(() => section().state).toBe("none");
    expect(
      (await device.query<{ at: string | null }>(NO_KNOWN_SQL, [TEST_RECIPIENT.id]))[0]?.at,
    ).toBeTruthy();
    expect(device.location()).toBe(PROFILE_URL);

    await userEvent.click(await found(() => SECTION()?.querySelector("[data-clear-no-known]")));
    await expect.poll(() => section().state).toBe("notRecorded");
    expect((await device.query<{ at: string | null }>(NO_KNOWN_SQL, [TEST_RECIPIENT.id]))[0]?.at).toBeNull();
  });
});

describe("the sheet", () => {
  test("offline: add (clearing No known allergies), edit and remove behind a confirm (soft); Done closes back to the profile", async () => {
    const device = await open("owner");
    await waitUntil(() => section().state === "notRecorded", "the section");
    await userEvent.click(await found(() => SECTION()?.querySelector("[data-record-no-known]")));
    await expect.poll(() => section().state).toBe("none");

    await userEvent.click(await found(() => SECTION()?.querySelector("a[data-edit-allergies]")));
    await waitUntil(() => !!ADD(), "the sheet");
    expect(device.location()).toBe(`${PROFILE_URL}/allergies`);

    await save(ADD, { substance: "Penicillin", reaction: "hives", severity: "severe" });
    await expect.poll(sheetRows).toEqual(["Penicillin (hives, severe)"]);
    expect(await device.query(ALLERGY_SQL, ["Penicillin"])).toEqual([
      { substance: "Penicillin", reaction: "hives", severity: "severe", deleted_at: null },
    ]);
    expect((await device.query<{ at: string | null }>(NO_KNOWN_SQL, [TEST_RECIPIENT.id]))[0]?.at).toBeNull();

    await save(ADD, { substance: "Sulfa" });
    await waitUntil(() => !!SHEET()?.querySelector('button[aria-label="Edit Sulfa"]'), "Sulfa's row");
    await userEvent.click(sheetButton("Edit Sulfa"));
    await save(EDIT, { reaction: "rash" });
    await waitUntil(() => !EDIT(), "the edit form to close");
    await device.settle();
    expect(sheetRows()).toEqual(["Penicillin (hives, severe)", "Sulfa (rash)"]);
    expect(await device.query(ALLERGY_SQL, ["Sulfa"])).toMatchObject([
      { reaction: "rash", severity: "unknown" },
    ]);

    await userEvent.click(sheetButton("Remove Sulfa"));
    await expect.element(dialogButton("Remove")).toBeEnabled();
    await userEvent.click(dialogButton("Remove"));
    await expect.poll(() => sheetRows().some((t) => t?.includes("Sulfa"))).toBe(false);
    expect(
      (await device.query<{ deleted_at: string | null }>(ALLERGY_SQL, ["Sulfa"]))[0]?.deleted_at,
    ).toBeTruthy();

    await userEvent.click(await found(() => SHEET()?.querySelector("[data-allergies-done]")));
    await expect.poll(() => !SHEET() && device.location()).toBe(PROFILE_URL);
    expect(section()).toMatchObject({
      state: "recorded",
      rows: ["Penicillin (hives, severe)"],
      severe: ["Penicillin (hives, severe)"],
      edit: "Edit allergies",
    });
  });
});
