import type { DeviceRoute } from "../../../../../test/device";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_GROUP } from "../../../../../test/fixtures";
import {
  daysAgo,
  field,
  FORM,
  formButton,
  PERIOD_ROUTES,
  pickerChip,
  RIVERSIDE,
  SHEET,
  submit,
  track,
  typeRadio,
  waitUntil,
} from "../periods/periodWorld";
import * as entryRoute from "./route";

// The care period suggestion on the entry page (care-periods.mjs's
// suggestion steps): an event whose title says the recipient moved offers
// one chip; it opens the add sheet prefilled with the type, the event's time
// and its first linked practice; saving comes back to the entry with the
// chip gone; none when the period at that time already has the type, on a
// note, or for a viewer; a renamed event's chip follows, and its sheet opens
// and cancels back. The device is offline throughout. Which words suggest
// what is periodSuggestions.test.ts's.

const ROUTES: DeviceRoute[] = [
  ...PERIOD_ROUTES,
  { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute },
];
const entryUrl = (id: string) => `/app/groups/${TEST_GROUP.id}/entries/${id}`;

// Four days back: inside the track's current Home (from five days back).
const T = daysAgo(4, 10);
const DR = fx.provider({ name: "Dr. Ana Tran", specialty: "Cardiology" });
const ADMITTED = fx.event({ title: "Admitted to Riverside General", occurredAt: at(T) });
const HOME = fx.event({ title: "Discharged home", occurredAt: at(daysAgo(4, 9)) });
const REHAB = fx.event({ title: "Moved to rehab", occurredAt: at(daysAgo(4, 9)) });
const NOTE = fx.note({ title: "Admitted overnight", occurredAt: at(daysAgo(4, 9)), text: "" });
const fixtures = () => [
  ...track(),
  DR,
  ADMITTED,
  HOME,
  REHAB,
  NOTE,
  // A clinician first: the place is the first linked practice.
  fx.link(ADMITTED.id, DR.id),
  fx.link(ADMITTED.id, RIVERSIDE.id),
];

const open = (id: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url: entryUrl(id), fixtures: fixtures(), ...options });

const chips = () => [...document.querySelectorAll<HTMLAnchorElement>("main [data-period-suggestion]")];
const chip = () => chips()[0] ?? null;
const onEntry = () => !!document.querySelector("main .ProseMirror");
const TITLE = () => document.querySelector<HTMLInputElement>("main header input");

describe("the period suggestion", () => {
  test('"Admitted to Riverside General" offers one chip; it opens the add sheet with the type, the event\'s time and its linked practice; saving comes back to the entry, the chip gone', async () => {
    const device = await open(ADMITTED.id);
    await waitUntil(onEntry, 4000, "the entry page");
    await waitUntil(() => !!chip(), 4000, "the chip");
    expect(chips()).toHaveLength(1);
    expect(chip()!.dataset.periodSuggestion).toBe("hospital");
    expect(chip()!.textContent?.trim()).toBe("Start a hospital period?");

    await userEvent.click(chip()!);
    await waitUntil(() => !!FORM(), 4000, "the prefilled sheet");
    expect(device.location()).toMatch(/\/periods\/new\?/);
    expect(typeRadio("Hospital")!.checked).toBe(true);
    expect(field("dateOnly")!.checked).toBe(false);
    expect(Date.parse(field("startedAt")!.value.replace(/\[.*\]$/, ""))).toBe(T.getTime());
    expect(pickerChip()).toBe("Riverside General Hospital");

    await userEvent.fill(field("label")!, "Suggested");
    await userEvent.click(submit());
    await waitUntil(() => !SHEET() && onEntry(), 4000, "back on the entry");
    expect(device.location()).toBe(entryUrl(ADMITTED.id));
    await device.settle();
    expect(chip()).toBeNull();
    const [saved] = await device.query<{ type: string; started_at: string; place_provider_id: string }>(
      "SELECT type, started_at, place_provider_id FROM care_period WHERE label = 'Suggested'",
    );
    expect(saved).toMatchObject({ type: "hospital", place_provider_id: RIVERSIDE.id });
    expect(new Date(saved!.started_at).getTime()).toBe(T.getTime());
  });

  test.each([
    ['"Discharged home" while the period is already Home', HOME.id],
    ["a note", NOTE.id],
  ])("no chip on %s", async (_, id) => {
    const device = await open(id);
    await waitUntil(onEntry, 4000, "the entry page");
    await device.settle();
    expect(chip()).toBeNull();
  });

  test('"Moved to rehab" offers Rehab', async () => {
    await open(REHAB.id);
    await waitUntil(() => chip()?.dataset.periodSuggestion === "rehab", 4000, "the rehab chip");
    expect(chip()!.textContent?.trim()).toBe("Start a rehab period?");
  });

  test("a viewer gets no chip", async () => {
    const device = await open(REHAB.id, { role: "viewer" });
    await waitUntil(onEntry, 4000, "the entry page");
    await device.settle();
    expect(chip()).toBeNull();
  });

  test('a renamed event\'s chip follows ("Hospice intake" offers Hospice at home); its sheet opens prefilled, and Cancel comes back to the entry', async () => {
    const device = await open(REHAB.id);
    await waitUntil(() => chip()?.dataset.periodSuggestion === "rehab", 4000, "the rehab chip");
    await userEvent.fill(await found(TITLE), "Hospice intake");
    await userEvent.tab();
    await waitUntil(() => chip()?.dataset.periodSuggestion === "hospiceHome", 4000, "the hospice chip");
    expect(chip()!.textContent?.trim()).toBe("Start a hospice at home period?");

    await userEvent.click(chip()!);
    await waitUntil(() => !!FORM(), 4000, "the sheet");
    expect(typeRadio("Hospice at home")!.checked).toBe(true);
    await userEvent.click(formButton("Cancel"));
    await waitUntil(() => !SHEET() && onEntry() && !!chip(), 4000, "back on the entry with its chip");
    expect(device.location()).toBe(entryUrl(REHAB.id));
    await expect.element(page.getByRole("link", { name: "Start a hospice at home period?" })).toBeVisible();
  });
});
