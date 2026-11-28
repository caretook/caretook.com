import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { at, condition, conditionManager, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { openProfile, PROFILE_URL } from "./profileWorld";

// Who diagnosed a condition and who manages it (conditions slice 3): picking
// both on the add sheet (one of the group's providers, and a new one added
// from the picker by name), changing them on the edit sheet, the view's
// lines with each provider a link, and a deleted provider greyed "Removed
// provider" and not a link (scrubbed or not). Every write is local and offline: the order it queues in
// is what the server reads (syncConditionManagers.int.test.ts); what the
// server decides is conditionProviders.int.test.ts's.

const LEE = fx.provider({ name: "Dr. Mei Lee", specialty: "Cardiology" });
const ORTIZ = fx.provider({ name: "Dr. Ana Ortiz", specialty: "Internal medicine" });
const GONE = fx.provider({ name: "Dr. Old Hart", deletedAt: at() });
const RX = fx.provider({ name: "Corner Pharmacy", type: "pharmacy", specialty: null });
const PROVIDERS = [LEE, ORTIZ, GONE, RX];

const AFIB = condition({ name: "Atrial fibrillation", sinceYear: 2019, diagnosedById: LEE.id });
const AFIB_MANAGERS = [conditionManager(AFIB.id, LEE.id), conditionManager(AFIB.id, ORTIZ.id)];
const GOUT = condition({ name: "Gout", diagnosedById: GONE.id });
const GOUT_MANAGERS = [conditionManager(GOUT.id, GONE.id)];
const WORLD = [PROVIDERS, AFIB, AFIB_MANAGERS, GOUT, GOUT_MANAGERS];

const conditionUrl = (id: string) => `${PROFILE_URL}/conditions/${id}`;
const SHEET = () => document.querySelector("[role=dialog]");
const FORM = () => SHEET()?.querySelector<HTMLFormElement>("form[data-condition-form]") ?? null;
const nameInput = () =>
  FORM()?.querySelector<HTMLInputElement>('[data-condition-name-field] input[role="combobox"]');
const picker = (id: "diagnosedBy" | "managedBy") =>
  FORM()?.querySelector(
    id === "diagnosedBy" ? `[data-provider-picker=diagnosedBy]` : `[data-providers-picker=managedBy]`,
  );
const pickerInput = (id: "diagnosedBy" | "managedBy") =>
  picker(id)?.querySelector<HTMLInputElement>('input[role="combobox"]');
const chips = (id: "diagnosedBy" | "managedBy") =>
  [...(picker(id)?.querySelectorAll("li[data-chip]") ?? [])].map((li) => li.textContent?.trim());
const option = (text: string) =>
  [...document.querySelectorAll('[role="option"]')].find((o) => o.firstElementChild?.textContent === text);
const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((o) => o.firstElementChild?.textContent);

const pick = async (id: "diagnosedBy" | "managedBy", text: string, optionText: string) => {
  await userEvent.click(await found(() => pickerInput(id)));
  await userEvent.keyboard(text);
  await userEvent.click(await found(() => option(optionText)));
};

/** The view's provider lines: each name, and whether it's a link. */
const viewLine = (line: "diagnosedBy" | "managedBy") =>
  [...(SHEET()?.querySelectorAll(`[data-condition-line=${line}] [data-condition-provider]`) ?? [])].map(
    (el) => [el.textContent?.trim(), el.tagName === "A" ? el.getAttribute("href") : null],
  );

/** A form button by its text or label (a DOM read: an open list hides the rest from the accessibility tree). */
const button = (text: string) =>
  [...(FORM()?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text,
  )!;

const open = (role: "owner" | "caretaker" | "viewer", url: string) =>
  openProfile({ role, connected: false, url, fixtures: WORLD });

describe("a condition's sheet", () => {
  test.each(["caretaker", "viewer"] as const)(
    "as %s: shows who diagnosed it and who manages it, each opening their page",
    async (role) => {
      await open(role, conditionUrl(AFIB.id));
      await expect
        .poll(() => viewLine("managedBy"))
        .toEqual([
          ["Dr. Ana Ortiz", `/app/groups/${TEST_GROUP.id}/providers/${ORTIZ.id}`],
          ["Dr. Mei Lee", `/app/groups/${TEST_GROUP.id}/providers/${LEE.id}`],
        ]);
      expect(viewLine("diagnosedBy")).toEqual([
        ["Dr. Mei Lee", `/app/groups/${TEST_GROUP.id}/providers/${LEE.id}`],
      ]);
    },
  );

  test('a deleted provider is greyed "Removed provider" and not a link', async () => {
    await open("caretaker", conditionUrl(GOUT.id));
    await expect.poll(() => viewLine("diagnosedBy")).toEqual([["Removed provider", null]]);
    expect(viewLine("managedBy")).toEqual([["Removed provider", null]]);
    const shown = SHEET()?.querySelector("[data-condition-line=diagnosedBy] [data-condition-provider]");
    expect(shown?.classList.contains("text-faint")).toBe(true);
  });

  test("a provider deleted (and scrubbed) on another device turns grey while the sheet is open", async () => {
    const device = await open("viewer", conditionUrl(AFIB.id));
    await expect.poll(() => viewLine("diagnosedBy").length).toBe(1);
    await device.sync(fx.provider({ id: LEE.id, name: "", specialty: null, deletedAt: at() }));
    await device.settle();
    expect(viewLine("diagnosedBy")).toEqual([["Removed provider", null]]);
  });
});

describe("the add sheet", () => {
  test("picks who diagnosed it and two managers, one added by name; one local write, queued in order", async () => {
    const device = await open("caretaker", `${PROFILE_URL}/conditions/new`);
    await userEvent.fill(await found(nameInput), "Heart failure");
    // Pharmacies and deleted providers aren't offered.
    await userEvent.click(await found(() => pickerInput("diagnosedBy")));
    await userEvent.keyboard("r");
    await expect
      .poll(() => options().filter((o) => !o?.startsWith("Add")))
      .toEqual(["Dr. Ana Ortiz", "Dr. Mei Lee"]);
    await userEvent.keyboard("{Backspace}lee");
    await userEvent.click(await found(() => option("Dr. Mei Lee")));
    await expect.poll(() => chips("diagnosedBy")).toEqual(["Dr. Mei Lee"]);

    await pick("managedBy", "lee", "Dr. Mei Lee");
    await pick("managedBy", "Dr. Ada Moss", 'Add "Dr. Ada Moss" as a new provider');
    await expect.poll(() => chips("managedBy")).toEqual(["Dr. Mei Lee", "Dr. Ada Moss (new)"]);
    const before = (await device.queued()).length;
    await userEvent.click(button("Add condition"));
    await expect.poll(() => !!SHEET()).toBe(false);

    const writes = (await device.queued()).slice(before);
    expect(writes.map((w) => `${w.op} ${w.type}`)).toEqual([
      "PUT provider",
      "PUT recipient_condition",
      "PUT condition_manager",
      "PUT condition_manager",
      "PUT timeline_entry",
    ]);
    const [made] = await device.query<{ id: string; diagnosed: string; manages: string }>(
      `SELECT c.id, d.name AS diagnosed,
              (SELECT group_concat(p.name, ', ') FROM (SELECT p.name FROM condition_manager cm
                 JOIN provider p ON p.id = cm.provider_id WHERE cm.condition_id = c.id ORDER BY p.name) p) AS manages
       FROM recipient_condition c JOIN provider d ON d.id = c.diagnosed_by_id WHERE c.name = 'Heart failure'`,
    );
    expect(made).toMatchObject({ diagnosed: "Dr. Mei Lee", manages: "Dr. Ada Moss, Dr. Mei Lee" });
    const [moss] = await device.query<{ type: string }>(
      "SELECT type FROM provider WHERE name = 'Dr. Ada Moss'",
    );
    expect(moss?.type).toBe("clinician");
    expect(JSON.parse(String(writes[4]?.data?.details))).toMatchObject({
      change: "added",
      after: { diagnosedBy: "Dr. Mei Lee", managedBy: ["Dr. Ada Moss", "Dr. Mei Lee"] },
    });
  });

  test("cancelling after adding a provider by name leaves nothing behind", async () => {
    const device = await open("caretaker", `${PROFILE_URL}/conditions/new`);
    await userEvent.fill(await found(nameInput), "Asthma");
    await pick("diagnosedBy", "Dr. Kim Noor", 'Add "Dr. Kim Noor" as a new provider');
    await expect.poll(() => chips("diagnosedBy")).toEqual(["Dr. Kim Noor (new)"]);
    await userEvent.click(button("Cancel"));
    await expect.poll(() => !!SHEET()).toBe(false);
    expect(await device.query("SELECT id FROM provider WHERE name = 'Dr. Kim Noor'")).toEqual([]);
  });
});

describe("the edit sheet", () => {
  test("opens with both; a change unlinks (stamped, then deleted), links, and records one change", async () => {
    const device = await open("caretaker", `${conditionUrl(AFIB.id)}/edit`);
    await expect.poll(() => chips("managedBy")).toEqual(["Dr. Ana Ortiz", "Dr. Mei Lee"]);
    expect(chips("diagnosedBy")).toEqual(["Dr. Mei Lee"]);

    await userEvent.click(button("Clear the provider"));
    await pick("diagnosedBy", "ortiz", "Dr. Ana Ortiz");
    await userEvent.click(button("Remove Dr. Mei Lee"));
    await expect.poll(() => chips("managedBy")).toEqual(["Dr. Ana Ortiz"]);
    const before = (await device.queued()).length;
    await userEvent.click(button("Save"));
    // Opened by its URL, so it closes to the profile.
    await expect.poll(device.location).toBe(PROFILE_URL);

    const writes = (await device.queued()).slice(before);
    expect(writes.map((w) => `${w.op} ${w.type}`)).toEqual([
      "PATCH recipient_condition",
      "PATCH condition_manager",
      "DELETE condition_manager",
      "PUT timeline_entry",
    ]);
    expect(Object.keys(writes[0]?.data ?? {}).sort()).toEqual(["diagnosed_by_id", "updated_at"]);
    expect(Object.keys(writes[1]?.data ?? {})).toEqual(["updated_at"]);
    expect([writes[1]?.id, writes[2]?.id]).toEqual([AFIB_MANAGERS[0]!.id, AFIB_MANAGERS[0]!.id]);
    // The stamp is the save's time: the condition's updated_at, and the entry's.
    expect(writes[1]?.data?.updated_at).toBe(writes[0]?.data?.updated_at);
    expect(JSON.parse(String(writes[3]?.data?.details))).toMatchObject({
      change: "changed",
      fields: ["diagnosedBy", "managedBy"],
      before: { diagnosedBy: "Dr. Mei Lee", managedBy: ["Dr. Ana Ortiz", "Dr. Mei Lee"] },
      after: { diagnosedBy: "Dr. Ana Ortiz", managedBy: ["Dr. Ana Ortiz"] },
    });
    expect(
      await device.query<{ provider_id: string }>(
        "SELECT provider_id FROM condition_manager WHERE condition_id = ?",
        [AFIB.id],
      ),
    ).toEqual([{ provider_id: ORTIZ.id }]);
  });

  test("a deleted provider already chosen stays greyed, and other edits save without touching it", async () => {
    const device = await open("caretaker", `${conditionUrl(GOUT.id)}/edit`);
    await expect.poll(() => chips("diagnosedBy")).toEqual(["Removed provider"]);
    expect(chips("managedBy")).toEqual(["Removed provider"]);
    for (const id of ["diagnosedBy", "managedBy"] as const)
      expect(picker(id)?.querySelector("li[data-chip]")?.classList.contains("text-faint")).toBe(true);
    await userEvent.fill(
      await found(() => FORM()?.querySelector<HTMLInputElement>('[name="note"]')),
      "Flares in winter",
    );
    const before = (await device.queued()).length;
    await userEvent.click(button("Save"));
    await expect.poll(device.location).toBe(PROFILE_URL);
    expect((await device.queued()).slice(before).map((w) => `${w.op} ${w.type}`)).toEqual([
      "PATCH recipient_condition",
      "PUT timeline_entry",
    ]);
  });
});
