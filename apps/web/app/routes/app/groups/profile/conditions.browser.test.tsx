import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { at, condition, fx, TEST_RECIPIENT } from "../../../../../test/fixtures";
import { $, JUNE, openProfile, PROFILE_URL } from "./profileWorld";

// The recipient's conditions on the profile (conditions slice 1): the card
// for each role and state (active and Past, No known conditions, not
// recorded), the add sheet with a suggestion and with free text, the since
// rules, Resolve and Reactivate, Delete behind a confirm, an edit made
// offline and then synced, and a viewer with no actions. Every write is
// local (the device is offline unless a test connects it). What the server
// decides is recipientCondition.int.test.ts's and syncConditions.int.test.ts's;
// a condition reaching another device is roundtrip's sync matrix (6b).

const CARD = () => $("main [data-section=conditions]");
const card = () => {
  const el = CARD();
  const names = (list: string) =>
    [...(el?.querySelectorAll(`[data-condition-list=${list}] li`) ?? [])].map((li) =>
      [li.querySelector("[data-condition-name]"), li.querySelector("[data-condition-since]")]
        .map((x) => x?.textContent?.trim())
        .filter(Boolean)
        .join(" · "),
    );
  return {
    active: names("active"),
    past: names("past"),
    none: !!el?.querySelector("[data-no-known-conditions]"),
    notRecorded: !!el?.querySelector("[data-conditions-not-recorded]"),
    add: !!el?.querySelector("a[data-add-condition]"),
    noKnownButton: !!el?.querySelector("[data-record-no-known-conditions]"),
  };
};
const conditionUrl = (id: string) => `${PROFILE_URL}/conditions/${id}`;
const SHEET = () => $("[role=dialog]");
const FORM = () => SHEET()?.querySelector<HTMLFormElement>("form[data-condition-form]") ?? null;
const nameInput = () =>
  FORM()?.querySelector<HTMLInputElement>('[data-condition-name-field] input[role="combobox"]');
const field = (name: string) =>
  FORM()?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
const dialogButton = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")].find(
    (b) => b.textContent?.trim() === text,
  );
const ROWS_SQL =
  "SELECT name, status, since_year, since_month, note, deleted_at FROM recipient_condition ORDER BY created_at";
const NO_KNOWN_SQL = "SELECT no_known_conditions_at AS at FROM care_recipient WHERE id = ?";

const HBP = condition({ name: "High blood pressure", sinceYear: 2012 });
const DIABETES = condition({
  name: "Type 2 diabetes",
  sinceYear: 2016,
  sinceMonth: 3,
  note: "Diet-controlled",
});
const PNEUMONIA = condition({ name: "Pneumonia", status: "resolved", sinceYear: 2025, sinceMonth: 11 });
const DELETED = condition({ name: "Gout", deletedAt: at() });
const recorded = [HBP, DIABETES, PNEUMONIA, DELETED];

const open = (role: GroupRole, fixtures: Parameters<typeof openProfile>[0] = {}) =>
  openProfile({ role, connected: false, ...fixtures });

describe("the card", () => {
  test.each(["owner", "caretaker", "viewer"] as const)(
    "as %s: active (most recent since first), then Past; a deleted one is gone",
    async (role) => {
      await open(role, { fixtures: recorded });
      await expect
        .poll(() => card().active)
        .toEqual(["Type 2 diabetes · Since March 2016", "High blood pressure · Since 2012"]);
      expect(card()).toMatchObject({
        past: ["Pneumonia · Since November 2025"],
        none: false,
        notRecorded: false,
        add: role !== "viewer",
        noKnownButton: false,
      });
      expect(CARD()?.textContent).not.toContain("Gout");
    },
  );

  test("not recorded: a writer records No known conditions offline, and clears it", async () => {
    const device = await open("caretaker");
    await expect.poll(() => card().notRecorded).toBe(true);
    expect(card()).toMatchObject({ add: true, noKnownButton: true });

    await userEvent.click(await found(() => CARD()?.querySelector("[data-record-no-known-conditions]")));
    await expect.poll(() => card().none).toBe(true);
    expect(
      (await device.query<{ at: string | null }>(NO_KNOWN_SQL, [TEST_RECIPIENT.id]))[0]?.at,
    ).toBeTruthy();
    expect((await device.queued()).map((w) => [w.op, w.type, Object.keys(w.data ?? {})])).toEqual([
      ["PATCH", "care_recipient", ["no_known_conditions_at"]],
    ]);

    await userEvent.click(await found(() => CARD()?.querySelector("[data-clear-no-known-conditions]")));
    await expect.poll(() => card().notRecorded).toBe(true);
  });

  test("a viewer sees No known conditions and not recorded as text, with no actions", async () => {
    const device = await open("viewer", { fixtures: fx.recipient({ ...JUNE, noKnownConditionsAt: at() }) });
    await expect.poll(() => card().none).toBe(true);
    expect(CARD()?.querySelectorAll("button, a")).toHaveLength(0);
    await device.sync(fx.recipient({ ...JUNE, noKnownConditionsAt: null }));
    await device.settle();
    expect(card()).toMatchObject({ notRecorded: true, add: false, noKnownButton: false });
  });
});

describe("adding", () => {
  test("with a suggestion: picked from the list, with a since; it clears No known conditions", async () => {
    const device = await open("owner", { fixtures: fx.recipient({ ...JUNE, noKnownConditionsAt: at() }) });
    await expect.poll(() => card().none).toBe(true);
    await userEvent.click(await found(() => CARD()?.querySelector("a[data-add-condition]")));
    await expect.poll(device.location).toBe(`${PROFILE_URL}/conditions/new`);

    await userEvent.click(await found(nameInput));
    await userEvent.keyboard("2 diab");
    await userEvent.click(page.getByRole("option", { name: "Type 2 diabetes" }));
    await expect.poll(() => nameInput()?.value).toBe("Type 2 diabetes");
    await userEvent.fill(field("sinceYear") as HTMLInputElement, "2016");
    await userEvent.selectOptions(field("sinceMonth") as HTMLSelectElement, "March");
    await userEvent.fill(field("note") as HTMLInputElement, "Diet-controlled");
    await userEvent.click(page.getByRole("button", { name: "Add condition" }));

    await expect.poll(() => !SHEET() && device.location()).toBe(PROFILE_URL);
    await expect.poll(() => card().active).toEqual(["Type 2 diabetes · Since March 2016"]);
    expect(await device.query(ROWS_SQL)).toEqual([
      {
        name: "Type 2 diabetes",
        status: "active",
        since_year: 2016,
        since_month: 3,
        note: "Diet-controlled",
        deleted_at: null,
      },
    ]);
    expect((await device.query<{ at: string | null }>(NO_KNOWN_SQL, [TEST_RECIPIENT.id]))[0]?.at).toBeNull();
  });

  test("with free text, as past, and the group's own names suggested first", async () => {
    const device = await open("caretaker", { fixtures: [HBP], url: `${PROFILE_URL}/conditions/new` });
    await userEvent.click(await found(nameInput));
    await userEvent.keyboard("high");
    await expect
      .poll(() =>
        [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim()).slice(0, 2),
      )
      .toEqual(["High blood pressure", "High cholesterol"]);

    await userEvent.fill(nameInput()!, "Long COVID");
    await expect
      .element(page.getByText("No suggestions: keep typing to use your own words"))
      .toBeInTheDocument();
    await userEvent.click(FORM()!.querySelector<HTMLInputElement>('input[name="status"][value="resolved"]')!);
    await userEvent.click(page.getByRole("button", { name: "Add condition" }));
    await expect.poll(() => card().past).toEqual(["Long COVID"]);
    expect((await device.query<{ name: string; status: string }>(ROWS_SQL)).at(-1)).toMatchObject({
      name: "Long COVID",
      status: "resolved",
    });
  });

  test("refuses a month without a year and an empty name, on their fields", async () => {
    const device = await open("owner", { url: `${PROFILE_URL}/conditions/new` });
    await userEvent.selectOptions(await found(() => field("sinceMonth") as HTMLSelectElement), "June");
    await userEvent.click(page.getByRole("button", { name: "Add condition" }));
    await expect.element(page.getByText("Enter the condition")).toBeInTheDocument();
    await expect.poll(() => document.activeElement).toBe(nameInput());

    await userEvent.fill(nameInput()!, "Asthma");
    // Leaving the field closes its list.
    await userEvent.keyboard("{Tab}");
    await userEvent.click(page.getByRole("button", { name: "Add condition" }));
    await expect.poll(() => field("sinceYear")?.getAttribute("aria-invalid")).toBe("true");
    await expect.element(page.getByText("Enter the year too")).toBeInTheDocument();
    expect(await device.query(ROWS_SQL)).toEqual([]);
  });
});

describe("a condition's sheet", () => {
  test("shows the status, since and note; resolving moves it to Past and reactivating back", async () => {
    const device = await open("caretaker", { fixtures: recorded });
    await userEvent.click(page.getByRole("link", { name: /Type 2 diabetes/ }));
    await expect.poll(device.location).toBe(conditionUrl(DIABETES.id));
    const line = (id: string) =>
      SHEET()?.querySelector(`[data-condition-line=${id}] dd`)?.textContent?.trim();
    await expect.poll(() => line("status")).toBe("Active");
    expect([line("since"), line("note")]).toEqual(["March 2016", "Diet-controlled"]);

    await userEvent.click(page.getByRole("button", { name: "Mark resolved" }));
    await expect.poll(() => line("status")).toBe("Resolved");
    await expect
      .poll(() => card().past)
      .toEqual(["Pneumonia · Since November 2025", "Type 2 diabetes · Since March 2016"]);
    expect(card().active).toEqual(["High blood pressure · Since 2012"]);

    await userEvent.click(page.getByRole("button", { name: "Mark active again" }));
    await expect.poll(() => card().active).toHaveLength(2);
    await userEvent.click(page.getByRole("button", { name: "Done" }));
    await expect.poll(() => !SHEET() && device.location()).toBe(PROFILE_URL);
  });

  test("deletes only after the confirm: the sheet closes and it's gone (a soft delete)", async () => {
    const device = await open("owner", { fixtures: recorded, url: conditionUrl(HBP.id) });
    await userEvent.click(
      await found(() => SHEET()?.querySelector<HTMLButtonElement>("[data-delete-condition]")),
    );
    await expect.poll(() => dialogButton("Delete")?.disabled).toBe(false);
    await userEvent.click(dialogButton("Cancel")!);
    await expect.poll(() => document.querySelector("dialog[open]")).toBeNull();
    expect(card().active).toContain("High blood pressure · Since 2012");

    await userEvent.click(SHEET()!.querySelector<HTMLButtonElement>("[data-delete-condition]")!);
    await expect.poll(() => dialogButton("Delete")?.disabled).toBe(false);
    await userEvent.click(dialogButton("Delete")!);
    await expect.poll(() => !SHEET() && device.location()).toBe(PROFILE_URL);
    // The card's live query can rerun after the sheet has closed.
    await expect.poll(() => card().active).toEqual(["Type 2 diabetes · Since March 2016"]);
    const [row] = await device.query<{ deleted_at: string | null }>(
      "SELECT deleted_at FROM recipient_condition WHERE id = ?",
      [HBP.id],
    );
    expect(row?.deleted_at).toBeTruthy();
  });

  test("an edit made offline queues only what changed, and stays once the server's copy syncs", async () => {
    const device = await open("caretaker", { fixtures: recorded, url: conditionUrl(DIABETES.id) });
    await userEvent.click(await found(() => SHEET()?.querySelector("a[data-edit-condition]")));
    await expect.poll(device.location).toBe(`${conditionUrl(DIABETES.id)}/edit`);
    await expect.poll(() => (field("note") as HTMLInputElement | undefined)?.value).toBe("Diet-controlled");
    expect([nameInput()?.value, field("sinceYear")?.value, field("sinceMonth")?.value]).toEqual([
      "Type 2 diabetes",
      "2016",
      "3",
    ]);
    await userEvent.fill(field("note") as HTMLInputElement, "Metformin and diet");
    await userEvent.click(page.getByRole("button", { name: "Save" }));

    // Back on the condition's sheet.
    await expect.poll(device.location).toBe(conditionUrl(DIABETES.id));
    await expect
      .poll(() => SHEET()?.querySelector("[data-condition-line=note] dd")?.textContent?.trim())
      .toBe("Metformin and diet");
    const writes = await device.queued();
    expect(writes.map((w) => [w.op, w.type, w.id])).toEqual([["PATCH", "recipient_condition", DIABETES.id]]);
    expect(Object.keys(writes[0]?.data ?? {}).sort()).toEqual(["note", "updated_at"]);

    // The upload lands; the server's copy comes back with it.
    await device.sync(
      condition({
        id: DIABETES.id,
        name: "Type 2 diabetes",
        sinceYear: 2016,
        sinceMonth: 3,
        note: "Metformin and diet",
        updatedAt: at(),
      }),
    );
    await device.settle();
    expect(SHEET()?.querySelector("[data-condition-line=note] dd")?.textContent?.trim()).toBe(
      "Metformin and diet",
    );
  });

  test("a viewer sees the sheet with Done only", async () => {
    await open("viewer", { fixtures: recorded, url: conditionUrl(PNEUMONIA.id) });
    await expect
      .poll(() => SHEET()?.querySelector("[data-condition-line=status] dd")?.textContent?.trim())
      .toBe("Resolved");
    const controls = SHEET()?.querySelectorAll("[data-condition-view] button, [data-condition-view] a") ?? [];
    expect([...controls].map((b) => b.textContent?.trim())).toEqual(["Done"]);
  });

  test.each([
    ["a viewer's edit URL", "viewer", "edit", "view"],
    ["a viewer's add URL", "viewer", "new", "profile"],
    ["a deleted condition's URL", "owner", "deleted", "profile"],
  ] as const)("%s lands back", async (_what, role, sheet, lands) => {
    const url =
      sheet === "edit"
        ? `${conditionUrl(PNEUMONIA.id)}/edit`
        : sheet === "new"
          ? `${PROFILE_URL}/conditions/new`
          : conditionUrl(DELETED.id);
    const device = await open(role, { fixtures: recorded, url });
    await expect.poll(device.location).toBe(lands === "view" ? conditionUrl(PNEUMONIA.id) : PROFILE_URL);
  });
});
