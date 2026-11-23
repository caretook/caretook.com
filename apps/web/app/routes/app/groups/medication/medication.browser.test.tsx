import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, newId, TEST_USER } from "../../../../../test/fixtures";
import { medicationEntriesQuery } from "~/lib/medications/medications.sync";
import * as provider from "../provider/route";
import {
  ACETAMINOPHEN,
  daysAgo,
  ELM,
  GROUP,
  LARK,
  LATANOPROST,
  LISINOPRIL,
  MEDICATION_ROUTES,
  medicationUrl,
  medPage,
  METFORMIN,
  NOTES,
  OXYBUTYNIN,
  RECIPIENT,
  world,
} from "../medications/medicationWorld";

// A medication's page (medications.mjs's page, notes, offline, viewer and
// 404 steps): the details (its type, or "not set") with the schedule's zone note when the recipient
// lives elsewhere, the prescriber and pharmacy as links to their pages with
// contact actions, refills, the history newest first, a stopped medication's
// how and why, the notes (writable for a writer, made on the first
// keystroke; read-only for a viewer with no actions), and the 404s with no
// names. The device is offline throughout, so the page here is the offline
// one too. Two browsers writing one document together is live-notes.mjs's; a
// medication or its document reaching another device is roundtrip.mjs's
// sync matrix (6b).

const ROUTES = [
  ...MEDICATION_ROUTES,
  { path: "/app/groups/:groupId/providers/:providerId", module: provider },
];
const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url, fixtures: world(), ...options });
/** The page is up: its title, notes editor and history (whichever medication the URL names). */
const onPage = () =>
  !!document.querySelector<HTMLElement>("main .ProseMirror") &&
  !!document.querySelector<HTMLElement>("main h1")?.textContent &&
  !!document.querySelector<HTMLElement>("main [data-medication-history]");
const NOT_FOUND = () => page.getByRole("heading", { name: "Not found" });
/** The world with its recipient living in `timeZone`; the schedule's zone note compares it with the device's. */
const recipientIn = (timeZone: string) => [
  world(),
  { ...RECIPIENT, row: { ...RECIPIENT.row, time_zone: timeZone } },
];
const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe("the page", () => {
  test("Lisinopril's details, its prescriber and pharmacy as links with contact actions, and its doses and changes newest first", async () => {
    const device = await open(medicationUrl(LISINOPRIL.id), { fixtures: recipientIn(DEVICE_ZONE) });
    await waitUntil(onPage, "the page");
    const state = medPage();
    expect(state).toMatchObject({ h1: "Lisinopril 10 mg", badge: null, details: "Tablet · 1 tablet" });
    expect(state.rows.schedule).toBe("Morning");
    expect(state.rows.type).toBe("Prescription");
    expect(document.querySelector<HTMLElement>('main [data-detail="type"] dt')?.textContent).toBe("Type");
    expect(state.rows.reason).toBe("Blood pressure");
    expect(state.rows.directions).toMatch(/^Once every morning/);
    expect(state.rows.started).toBeTruthy();
    expect(state.providers).toEqual([
      ["prescriber", "Dr. Mira Lark", `/app/groups/${GROUP}/providers/${LARK.id}`, true],
      ["pharmacy", "Elm Street Pharmacy", `/app/groups/${GROUP}/providers/${ELM.id}`, true],
    ]);
    const q = medicationEntriesQuery(LISINOPRIL.id);
    const ids = (await device.query<{ id: string }>(q.sql, q.params)).map((r) => r.id);
    expect(state.history.map((h) => h.id)).toEqual(ids);
    expect(state.history.filter((h) => h.kind === "medicationChange").map((h) => h.text)).toEqual([
      "Changed strength 5 mg → 10 mg",
      "Started",
    ]);
    expect(state.history.at(-1)?.text).toBe("Started");
    expect(state.history.filter((h) => h.kind === "dose").map((h) => h.text)).toEqual([
      "Given 1 tablet",
      "Given 1 tablet",
    ]);

    // The prescriber's name opens their page.
    await userEvent.click(getByCss('main li[data-medication-provider="prescriber"] a[data-provider-name]'));
    await expect.poll(device.location).toBe(`/app/groups/${GROUP}/providers/${LARK.id}`);
  });

  test("an over-the-counter medication says so", async () => {
    await open(medicationUrl(ACETAMINOPHEN.id));
    await waitUntil(onPage, "the page");
    expect(medPage().rows.type).toBe("Over the counter");
  });

  test("with the recipient in another zone, the schedule says whose times they are", async () => {
    // Chicago is neither zone the tests run in, so it is always another zone.
    await open(medicationUrl(LISINOPRIL.id), { fixtures: recipientIn("America/Chicago") });
    await waitUntil(onPage, "the page");
    expect(medPage().rows.schedule).toBe("MorningTimes are Chicago time");
  });

  test("a discontinued medication says so, with the reason and the note, its stop first in the history", async () => {
    await open(medicationUrl(OXYBUTYNIN.id));
    await waitUntil(onPage, "the page");
    const state = medPage();
    expect(state.badge).toBe("Discontinued");
    // Added before types.
    expect(state.rows.type).toBe("not set");
    expect(state.stopped).toMatch(/^Discontinued \w{3} \d{1,2}, \d{4} · Side effects/);
    expect(state.stopped).toContain("Dry mouth");
    expect(state.history[0]?.text).toBe("Discontinued: side effects");
  });

  test("refills show on the page, the refill wrote no change entry, and only the pharmacy is listed", async () => {
    await open(medicationUrl(LATANOPROST.id));
    await waitUntil(
      () => onPage() && !!document.querySelector<HTMLElement>("main li[data-medication-provider]"),
      "the page",
    );
    const state = medPage();
    expect(state.rows.quantity).toBe("1 bottle (2.5 mL)");
    expect(state.rows["refills-left"]).toBe("3");
    expect(state.rows["rx-number"]).toBe("RX 0104-2277");
    expect(state.rows["last-filled"]).toBeTruthy();
    expect(state.history.filter((h) => h.kind === "medicationChange").map((h) => h.text)).toEqual([
      "Started",
    ]);
    expect(state.providers.map((p) => p[0])).toEqual(["pharmacy"]);
  });
});

describe("the notes", () => {
  test("the seeded notes show in the editor, writable for a caretaker, with Edit and the status actions", async () => {
    await open(medicationUrl(METFORMIN.id), { role: "caretaker" });
    await waitUntil(() => !!NOTES()?.textContent?.includes("applesauce"), "the notes");
    const state = medPage();
    expect(state.editable).toBe("true");
    expect(state.actions).toBe(true);
    expect(document.querySelector<HTMLElement>("main [data-edit-medication]")).not.toBeNull();
  });

  test("a medication without notes opens with an empty editor and no document; the first keystroke makes it (subject medication)", async () => {
    const device = await open(medicationUrl(LISINOPRIL.id));
    await waitUntil(() => medPage().editable === "true", "an editable editor");
    expect(medPage().notes).toBe("");
    expect(await device.query("SELECT id FROM note_document WHERE id = ?", [LISINOPRIL.id])).toEqual([]);
    await userEvent.click(await found(NOTES));
    await userEvent.keyboard("Crush into yogurt");
    await expect
      .poll(() =>
        device.query("SELECT subject, medication_id, entry_id FROM note_document WHERE id = ?", [
          LISINOPRIL.id,
        ]),
      )
      .toEqual([{ subject: "medication", medication_id: LISINOPRIL.id, entry_id: null }]);
  });

  test("a viewer reads the notes read-only, with no Edit or status actions", async () => {
    await open(medicationUrl(METFORMIN.id), { role: "viewer" });
    await waitUntil(() => !!NOTES()?.textContent?.includes("applesauce"), "the notes");
    expect(medPage()).toMatchObject({ editable: "false", readonly: "true", actions: false });
    await expect
      .element(page.getByText("Shared with the care group. You can view these notes."))
      .toBeVisible();
  });
});

describe("the 404s", () => {
  const OTHER = { group: newId(), recipient: newId() };
  const otherGroup = (member: boolean) => [
    fx.group({ id: OTHER.group, name: "Moreno Family 2" }),
    fx.recipient({
      id: OTHER.recipient,
      groupId: OTHER.group,
      name: "Lou Moreno",
      preferredName: "Grandpa Lou",
    }),
    member && fx.member({ userId: TEST_USER.id, groupId: OTHER.group, role: "owner" }),
  ];
  const TAMSULOSIN = fx.medication({
    name: "Tamsulosin",
    reason: "Prostate",
    groupId: OTHER.group,
    recipientId: OTHER.recipient,
  });
  const DELETED = fx.medication({ name: "Deletedmed", deletedAt: at(daysAgo(1)) });
  const fixtures = (member: boolean) => [world(), otherGroup(member), TAMSULOSIN, DELETED];

  test.each([
    ["a deleted medication", medicationUrl(DELETED.id), true],
    ["another group's medication under this group (the user is in both)", medicationUrl(TAMSULOSIN.id), true],
    ["a medication that isn't on the device", medicationUrl(newId()), true],
    ["a group the user isn't in", `/app/groups/${OTHER.group}/medications/${TAMSULOSIN.id}`, false],
  ])("%s is Not found, with no names", async (_, url, member) => {
    await open(url, { fixtures: fixtures(member) });
    await expect.element(NOT_FOUND()).toBeVisible();
    expect(document.querySelector<HTMLElement>("main")?.textContent).not.toMatch(
      /Tamsulosin|Prostate|Grandpa Lou|Deletedmed/,
    );
  });

  test("another group's medication opens under its own group", async () => {
    await open(`/app/groups/${OTHER.group}/medications/${TAMSULOSIN.id}`, { fixtures: fixtures(true) });
    await expect.element(page.getByRole("heading", { name: /^Tamsulosin/, level: 1 })).toBeVisible();
  });
});
