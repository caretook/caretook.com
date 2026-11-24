import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { fx } from "../../../../../test/fixtures";
import {
  EVENING,
  field,
  FORM,
  historyTexts,
  LIST,
  MEDS,
  MEDICATION_ROUTES,
  MEDICATION_SQL,
  medicationUrl,
  medPage,
  MORNING,
  RECIPIENT,
  SHEET,
  submit,
  times,
  openAddMedication,
} from "./medicationWorld";
import { pickTime } from "../../../../../test/timeSelect";

// Passes in a medication's schedule (medications.mjs's pass schedule steps):
// adding one by passes (Morning with an amount of its own, the dose as its
// placeholder, and Evening) plus a time of its own with an amount, which the
// list, the page and the printed list read by pass; then an edit that starts
// as saved, unticks Evening and changes Morning's amount, which the history
// names. The device never connects, so the edit is the offline one too. The
// slots' rules are scheduleSlots.test.ts's and medicationFormData.test.ts's;
// the timeline's row for the change is timelineDoses.browser.test.tsx's.

/** Saved by passes, as the add test saves it. */
const METOPROLOL = fx.medication({
  name: "Metoprolol",
  strength: null,
  dose: "25 mg",
  schedule: {
    type: "scheduled",
    slots: [
      { passId: MORNING.id, amount: "50 mg" },
      { passId: EVENING.id },
      { time: "14:00", amount: "12.5 mg" },
    ],
  },
});

const open = (url: string) =>
  renderWithDevice({
    route: MEDICATION_ROUTES,
    url,
    role: "caretaker",
    fixtures: [RECIPIENT, MORNING, EVENING, METOPROLOL],
  });

const passBox = (passId: string) =>
  FORM()!.querySelector<HTMLInputElement>(`[data-pass-slot="${passId}"] input[type="checkbox"]`)!;
const passAmount = (passId: string) => field(`passAmount:${passId}`);
const timeAmounts = () => [...FORM()!.querySelectorAll<HTMLInputElement>('input[name="timeAmount"]')];
/** A schedule with its slots in a fixed order, so it compares with a literal. */
const sorted = (schedule: string) => {
  const s = JSON.parse(schedule) as { type: string; slots: { passId?: string; time?: string }[] };
  return {
    ...s,
    slots: [...s.slots].sort((a, b) => (a.passId ?? `~${a.time}`).localeCompare(b.passId ?? `~${b.time}`)),
  };
};
const BY_PASS = "Morning (50 mg), Evening and 14:00 (12.5 mg)";

/** Add "Atenolol" by passes from the list (the save opens its page); returns its id. */
const addByPasses = async (device: Awaited<ReturnType<typeof open>>) => {
  await openAddMedication();
  await userEvent.fill(await found(() => field("name")), "Atenolol");
  await userEvent.fill(await found(() => field("dose")), "25 mg");
  await userEvent.click(passBox(MORNING.id));
  await expect.poll(() => passAmount(MORNING.id)).toBeTruthy();
  const placeholder = passAmount(MORNING.id)!.placeholder;
  await userEvent.fill(await found(() => passAmount(MORNING.id)), "50 mg");
  await userEvent.click(passBox(EVENING.id));
  await userEvent.click(await found(() => FORM()?.querySelector("[data-add-time]")));
  await expect.poll(() => times().length).toBe(1);
  await pickTime(() => times()[0], "14:00");
  await userEvent.fill(await found(() => timeAmounts()[0]), "12.5 mg");
  await userEvent.click(submit());
  await expect.poll(() => SHEET()).toBeNull();
  await device.settle();
  const [added] = await device.query<{ id: string }>("SELECT id FROM medication WHERE name = 'Atenolol'");
  await expect.poll(() => device.location()).toBe(medicationUrl(added!.id));
  return { id: added!.id, placeholder };
};

describe("a schedule by passes", () => {
  test("saves as pass slots (Morning's own amount, the dose as its placeholder) and a time with its amount; the list reads it by pass", async () => {
    const device = await open(LIST);
    const { id, placeholder } = await addByPasses(device);
    expect(placeholder).toBe("25 mg");
    // Its page says it by pass too; the list is a link away.
    await expect
      .poll(() => medPage().rows.schedule ?? "")
      .toMatch(new RegExp(`^${BY_PASS.replace(/[()]/g, "\\$&")}`));
    await userEvent.click(await found(() => document.querySelector<HTMLAnchorElement>("main a")));
    await expect.poll(() => device.location()).toBe(LIST);
    const [row] = await device.query<{ schedule: string }>(MEDICATION_SQL, [id]);
    expect(sorted(row?.schedule ?? "null")).toEqual(
      sorted(
        JSON.stringify({
          type: "scheduled",
          slots: [
            { passId: MORNING.id, amount: "50 mg" },
            { passId: EVENING.id },
            { time: "14:00", amount: "12.5 mg" },
          ],
        }),
      ),
    );
    await expect
      .poll(() =>
        document
          .querySelector<HTMLElement>(`main li[data-medication-id="${id}"] [data-medication-summary]`)
          ?.textContent?.trim(),
      )
      .toBe(`25 mg · ${BY_PASS}`);
  });

  test("the page and the printed list read it by pass; Edit starts as saved, and unticking Evening and changing Morning's amount is named in the history", async () => {
    const print = await renderWithDevice({
      route: MEDICATION_ROUTES,
      url: `${MEDS}/print`,
      role: "caretaker",
      fixtures: [RECIPIENT, MORNING, EVENING, METOPROLOL],
    });
    await expect
      .poll(
        () =>
          document.querySelector<HTMLElement>(`main tr[data-print-medication="${METOPROLOL.id}"]`)
            ?.textContent ?? "",
      )
      .toContain(BY_PASS);
    await print.screen.unmount();

    const id = METOPROLOL.id;
    const page = await open(medicationUrl(id));
    await expect
      .poll(() => medPage().rows.schedule ?? "")
      .toMatch(new RegExp(`^${BY_PASS.replace(/[()]/g, "\\$&")}`));

    await waitUntil(() => !!document.querySelector<HTMLElement>("main [data-edit-medication]"), "Edit");
    await userEvent.click(getByCss("main [data-edit-medication]"));
    await waitUntil(() => !!FORM() && !!passAmount(MORNING.id), "the edit sheet");
    expect(passBox(MORNING.id).checked).toBe(true);
    expect(passAmount(MORNING.id)?.value).toBe("50 mg");
    expect(passBox(EVENING.id).checked).toBe(true);
    expect(times().map((t) => t.value)).toEqual(["14:00"]);
    expect(timeAmounts().map((t) => t.value)).toEqual(["12.5 mg"]);

    await userEvent.click(passBox(EVENING.id));
    await userEvent.fill(await found(() => passAmount(MORNING.id)), "75 mg");
    await userEvent.click(submit());
    await expect.poll(() => !SHEET() && page.location()).toBe(medicationUrl(id));
    await expect.poll(() => historyTexts()[0]).toBe("Removed from Evening; Morning amount 50 mg → 75 mg");
    const [row] = await page.query<{ schedule: string }>(MEDICATION_SQL, [id]);
    expect(sorted(row?.schedule ?? "null")).toEqual(
      sorted(
        JSON.stringify({
          type: "scheduled",
          slots: [
            { passId: MORNING.id, amount: "75 mg" },
            { time: "14:00", amount: "12.5 mg" },
          ],
        }),
      ),
    );
  });
});
