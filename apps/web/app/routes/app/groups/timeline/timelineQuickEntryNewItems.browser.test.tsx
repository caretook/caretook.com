import type { DeviceRoute } from "../../../../../test/device";

import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";
import { clearUndo } from "~/lib/medications/passUndo";
import { MEDICATION_ROUTES } from "../medications/medicationWorld";
import { PROVIDER_ROUTES } from "../providers/providerWorld";
import * as timeline from "./route";
import { rowWith, TIMELINE_URL } from "./timelineWorld";

// Quick entry's new medications and providers (B-762): "new med …" and
// "add provider …" make a card whose Save opens the Add sheet filled in;
// nothing is written until the sheet saves. Writers only.

const LISINOPRIL = fx.medication({ name: "Lisinopril", strength: "5 mg", dose: "1 tablet" });
const RIVERSIDE = fx.provider({ name: "Riverside Dialysis", type: "practice" });

const ROUTES: DeviceRoute[] = [
  { path: "/app/groups/:groupId/timeline", module: timeline },
  ...MEDICATION_ROUTES,
  ...PROVIDER_ROUTES,
];

const open = (options: Parameters<typeof renderWithDevice>[0] = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: TIMELINE_URL,
    fixtures: [LISINOPRIL, RIVERSIDE, fx.note({ text: "Older note" })],
    ...options,
  });

const GROUP_URL = `/app/groups/${TEST_GROUP.id}`;
const box = () => page.getByRole("textbox", { name: "What happened?" });
const cards = () => [...document.querySelectorAll<HTMLElement>("[data-quick-card]")];
const cardKinds = () => cards().map((c) => c.dataset.quickCard);
const saveButton = () => document.querySelector<HTMLButtonElement>("[data-quick-entry] button[type=submit]");
const type = async (text: string, kinds: string[]) => {
  await userEvent.fill(box(), text);
  await waitUntil(() => cardKinds().join() === kinds.join(), "the cards");
};
const field = (form: string, name: string) =>
  document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `[${form}] [name="${name}"]`,
  );
const valueOf = (form: string, name: string) => () => field(form, name)?.value;

afterEach(() => clearUndo());

describe("new medications and providers from quick entry (B-762)", () => {
  test('"new med lisinopril 10 mg tablet": a new-medication card (not the current Lisinopril); Save opens Add a medication filled in, and it saves as the sheet does', async () => {
    const device = await open();
    const LINE = "new med lisinopril 10 mg tablet once daily";
    await type(LINE, ["medication"]);
    const card = cards()[0];
    expect(card?.querySelector("[data-quick-kind]")?.textContent).toBe("New medication");
    expect(card?.querySelector("[data-quick-title]")?.textContent).toBe("Lisinopril");
    expect(card?.querySelector("[data-quick-detail]")?.textContent).toBe("10 mg · Tablet · once daily");
    expect(card?.querySelector("[data-quick-opens-draft]")?.textContent).toBe(
      "Opens Add a medication to finish",
    );
    const before = await device.query("SELECT id FROM medication");

    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(`${GROUP_URL}/medications/list/new`);
    await expect.poll(valueOf("data-medication-form", "name")).toBe("Lisinopril");
    expect(valueOf("data-medication-form", "strength")()).toBe("10 mg");
    expect(valueOf("data-medication-form", "form")()).toBe("tablet");
    expect(valueOf("data-medication-form", "directions")()).toBe("once daily");
    // Nothing is written until the sheet saves.
    expect(await device.query("SELECT id FROM medication")).toHaveLength(before.length);
    expect(await device.queued()).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Add medication" }));
    await expect.poll(() => device.location()).toMatch(/\/medications\/[0-9a-f-]{36}$/);
    const saved = await device.query<{ name: string; strength: string; form: string }>(
      "SELECT name, strength, form FROM medication WHERE id <> ?",
      [LISINOPRIL.id],
    );
    expect(saved).toEqual([{ name: "Lisinopril", strength: "10 mg", form: "tablet" }]);
  });

  test('"add provider Dr Kim cardiology 555-0100": Save opens Add a provider filled in; closing it comes back to the timeline, writing nothing', async () => {
    const device = await open();
    await type("add provider Dr Kim cardiology 555-0100 at Riverside", ["provider"]);
    const card = cards()[0];
    expect(card?.querySelector("[data-quick-title]")?.textContent).toBe("Dr Kim");
    expect(card?.querySelector("[data-quick-detail]")?.textContent).toBe(
      "Cardiology · Riverside Dialysis · 555-0100",
    );

    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(`${GROUP_URL}/providers/new`);
    await expect.poll(valueOf("data-provider-form", "name")).toBe("Dr Kim");
    expect(valueOf("data-provider-form", "specialty")()).toBe("Cardiology");
    expect(valueOf("data-provider-form", "phoneNumber")()).toBe("555-0100");
    expect(valueOf("data-provider-form", "practiceId")()).toBe(RIVERSIDE.id);

    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => device.location()).toBe(TIMELINE_URL);
    await expect.element(box()).toHaveValue("");
    expect(await device.query("SELECT id FROM provider WHERE id <> ?", [RIVERSIDE.id])).toEqual([]);
    expect(await device.queued()).toEqual([]);
  });

  test("Edit opens the sheet too; a provider with its address saves as the sheet does", async () => {
    const device = await open();
    const LINE = "add provider dr kim, heart doctor, (555) 555-0100, 12 Main St, Springfield";
    await type(LINE, ["provider"]);
    await userEvent.click(page.getByRole("button", { name: `Edit "${LINE}"` }));
    await expect.poll(() => device.location()).toBe(`${GROUP_URL}/providers/new`);
    await expect.poll(valueOf("data-provider-form", "address")).toBe("12 Main St, Springfield");
    await userEvent.click(page.getByRole("button", { name: "Add provider" }));
    await expect.poll(() => device.location()).toMatch(/\/providers\/[0-9a-f-]{36}$/);
    const saved = await device.query<{ name: string; specialty: string; address: string }>(
      "SELECT name, specialty, address FROM provider WHERE id <> ?",
      [RIVERSIDE.id],
    );
    expect(saved).toEqual([
      { name: "Dr Kim", specialty: "Heart doctor", address: "12 Main St, Springfield" },
    ]);
  });

  test("the rest of a line saves first, then the sheet opens", async () => {
    const device = await open();
    await type("pain 4; new med amlodipine 5 mg", ["symptom", "medication"]);
    await userEvent.click(await found(saveButton));
    await expect.poll(() => device.location()).toBe(`${GROUP_URL}/medications/list/new`);
    await expect.poll(valueOf("data-medication-form", "name")).toBe("Amlodipine");
    expect(await device.query("SELECT id FROM timeline_entry WHERE kind = 'symptom'")).toHaveLength(1);
  });

  test("viewers get no such card (no box at all)", async () => {
    await open({ role: "viewer" });
    await waitUntil(() => !!rowWith("Older note"), "the timeline");
    expect(document.querySelector("[data-quick-entry]")).toBeNull();
    expect(document.querySelector('[data-quick-card="medication"], [data-quick-card="provider"]')).toBeNull();
  });
});
