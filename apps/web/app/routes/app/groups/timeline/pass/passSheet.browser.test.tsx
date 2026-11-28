import type { DeviceRoute } from "../../../../../../test/device";
import type { Fixture } from "../../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found } from "../../../../../../test/found";
import { renderWithDevice } from "../../../../../../test/device";
import { at, fx, medicationPass, newId } from "../../../../../../test/fixtures";
import * as timeline from "../route";
import { TIMELINE_URL } from "../timelineWorld";
import * as passSheet from "./route";

// A round logged together and the pass sheet (medications.mjs's pass log
// steps): one row on the dose filter that expands to each medication; the
// sheet opens from the row's text with each dose, saves a status and an
// amount together, adds a forgotten medication in the same round, and
// deletes the whole log; viewers and a deleted log's URL land on the
// timeline. The device never connects, so every write here is the offline
// one too. The sheet's form rules are passSheet.test.ts's; the fold is
// passLogs.test.ts's; the row's look is timelineStrips.browser.test.tsx's.

const ROUTES: DeviceRoute[] = [
  {
    path: "/app/groups/:groupId/timeline",
    module: timeline,
    children: [{ path: "/app/groups/:groupId/timeline/pass/:passLogId/edit", module: passSheet }],
  },
];

const LOG_PASS = medicationPass({ name: "Log", time: "06:00" });
const med = (name: string, slots: object[]) =>
  fx.medication({
    name,
    strength: "5 mg",
    dose: "1 tablet",
    schedule: { type: "scheduled", slots } as never,
  });
const QA = med("Qa", [{ passId: LOG_PASS.id }]);
const QB = med("Qb", [{ passId: LOG_PASS.id }]);
const QC = med("Qc", [{ passId: LOG_PASS.id }]);
const QD = med("Qd", [{ time: "13:00" }]);
const LOG = newId();
const roundDose = (m: Fixture, status: "given" | "refused") =>
  fx.dose({
    medicationId: m.id,
    status,
    occurredAt: at(new Date(Date.now() - 3 * 60_000)),
    details: JSON.stringify({
      medicationId: m.id,
      status,
      amount: "1 tablet",
      scheduledFor: "06:00",
      passId: LOG_PASS.id,
      passLogId: LOG,
    }),
  });
const DA = roundDose(QA, "given");
const DB = roundDose(QB, "given");
const DC = roundDose(QC, "refused");
const ROUND = [LOG_PASS, QA, QB, QC, QD, DA, DB, DC];

const DOSE_URL = `${TIMELINE_URL}?kind=dose`;
const SHEET_URL = `${TIMELINE_URL}/pass/${LOG}/edit`;
const row = () => document.querySelector<HTMLElement>(`main [data-pass-log="${LOG}"]`);
const rowText = () => row()?.querySelector("[data-pass-log-text]")?.textContent ?? null;
const SHEET = () => document.querySelector<HTMLElement>("[role=dialog]");
const FORM = () => SHEET()?.querySelector<HTMLFormElement>("[data-pass-log-form]") ?? null;
const fieldsets = () => FORM()?.querySelectorAll("fieldset[data-pass-dose]").length ?? 0;
const button = (text: string, root: ParentNode = SHEET()!) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text)!;
const logRows = (device: { query: <T>(sql: string, p?: unknown[]) => Promise<T[]> }) =>
  device.query<{ medicationId: string; status: string; amount: string | null; live: number }>(
    "SELECT json_extract(details, '$.medicationId') AS medicationId, json_extract(details, '$.status') AS status, json_extract(details, '$.amount') AS amount, deleted_at IS NULL AS live FROM timeline_entry WHERE kind = 'dose' AND json_extract(details, '$.passLogId') = ?",
    [LOG],
  );

const open = async (role: "caretaker" | "viewer" = "caretaker", url = DOSE_URL) => {
  const device = await renderWithDevice({ route: ROUTES, url, role, fixtures: ROUND });
  if (url === DOSE_URL) await expect.poll(rowText).toBe("Log: 2 given, 1 refused");
  return device;
};
/** Tap the row's text (the expanded list's medication links sit above the open target), and wait for the sheet. */
const openSheet = async (device: Awaited<ReturnType<typeof open>>) => {
  await userEvent.click(await found(() => row()?.querySelector("[data-pass-log-text]")), { force: true });
  await expect.poll(() => device.location()).toBe(`${SHEET_URL}?kind=dose`);
  await expect.poll(fieldsets).toBeGreaterThanOrEqual(3);
};

describe("a pass log", () => {
  test("a round logged together is one row on the dose filter; expanding it lists each medication and what happened", async () => {
    await open();
    const named = [...document.querySelectorAll("main ol > li")].filter((li) =>
      ["Qa", "Qb", "Qc"].some((n) => li.textContent?.includes(n)),
    );
    expect(named).toHaveLength(1);
    await userEvent.click(await found(() => row()?.querySelector("[data-pass-log-toggle]")));
    await expect
      .poll(() => row()?.querySelector("[data-pass-log-doses]")?.hasAttribute("data-open"))
      .toBe(true);
    const lines = [...row()!.querySelectorAll("[data-pass-log-doses] li")].map((li) => li.textContent);
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(expect.arrayContaining(["Qc 5 mg: Refused", "Qa 5 mg: Given 1 tablet"]));
  });

  test("the pass sheet saves a status and an amount together, and the row says so", async () => {
    const device = await open();
    await openSheet(device);
    await userEvent.click(
      await found(() =>
        FORM()?.querySelector<HTMLInputElement>(`input[name="status:${DB.id}"][value="skipped"]`),
      ),
    );
    await userEvent.fill(
      await found(() => FORM()?.querySelector<HTMLInputElement>(`[name="amount:${DA.id}"]`)),
      "3 tablets",
    );
    await userEvent.click(
      await found(() => FORM()?.querySelector<HTMLButtonElement>('button[type="submit"]')),
    );
    await expect.poll(() => device.location()).toBe(DOSE_URL);
    await expect.poll(rowText).toBe("Log: 1 given, 1 skipped, 1 refused");
    const saved = await logRows(device);
    expect(saved).toEqual(
      expect.arrayContaining([
        { medicationId: QA.id, status: "given", amount: "3 tablets", live: 1 },
        { medicationId: QB.id, status: "skipped", amount: "1 tablet", live: 1 },
      ]),
    );
  });

  test("Add a medication logs it in the same round at once; Delete this log removes every dose in it, and its URL is then the timeline", async () => {
    const device = await open();
    await openSheet(device);
    const select = SHEET()!.querySelector<HTMLSelectElement>("[data-pass-log-add] select")!;
    await userEvent.selectOptions(select, QD.id);
    await userEvent.click(
      await found(() => SHEET()?.querySelector<HTMLElement>('[data-pass-log-add] button[type="submit"]')),
    );
    await expect.poll(fieldsets).toBe(4);
    expect(await logRows(device)).toEqual(
      expect.arrayContaining([{ medicationId: QD.id, status: "given", amount: "1 tablet", live: 1 }]),
    );

    await userEvent.click(await found(() => SHEET()?.querySelector<HTMLElement>("[data-pass-log-delete]")));
    await expect.poll(() => document.querySelector("dialog[open]")).toBeTruthy();
    await expect.poll(() => button("Delete", document.querySelector("dialog[open]")!)?.disabled).toBe(false);
    await userEvent.click(await found(() => button("Delete", document.querySelector("dialog[open]")!)));
    await expect.poll(() => device.location()).toBe(DOSE_URL);
    await expect.poll(row).toBeNull();
    const gone = await logRows(device);
    expect(gone).toHaveLength(4);
    expect(gone.every((d) => d.live === 0)).toBe(true);
    await device.screen.unmount();

    // A log whose doses are all deleted: its sheet's URL is the timeline.
    const deleted = [DA, DB, DC].map((d) => ({ ...d, row: { ...d.row, deleted_at: at() } }));
    const again = await renderWithDevice({
      route: ROUTES,
      url: SHEET_URL,
      fixtures: [LOG_PASS, QA, QB, QC, QD, deleted],
    });
    await expect.poll(() => again.location()).toBe(TIMELINE_URL);
    expect(SHEET()).toBeNull();
  });

  test("a deleted medication in the round reads Removed medication, in the row and on the sheet", async () => {
    // Scrubbed as a delete leaves it: no name or strength.
    const gone = { ...QC, row: { ...QC.row, name: "", strength: null, deleted_at: at() } };
    const device = await renderWithDevice({
      route: ROUTES,
      url: DOSE_URL,
      fixtures: [LOG_PASS, QA, QB, gone, QD, DA, DB, DC],
    });
    await expect.poll(rowText).toBe("Log: 2 given, 1 refused");
    await userEvent.click(await found(() => row()?.querySelector("[data-pass-log-toggle]")));
    await expect
      .poll(() => [...row()!.querySelectorAll("[data-pass-log-doses] li")].map((li) => li.textContent))
      .toContain("Removed medication: Refused");
    await openSheet(device);
    const legends = [...FORM()!.querySelectorAll("fieldset[data-pass-dose] legend")].map(
      (l) => l.textContent,
    );
    expect(legends).toContain("Removed medication");
    expect(legends.some((l) => l?.includes("(removed)"))).toBe(false);
  });

  test("a viewer sees the row but no sheet link; the sheet's URL is the timeline, filters kept", async () => {
    const device = await open("viewer");
    await expect.poll(() => row()?.querySelector('a[aria-label^="Edit"]')).toBeNull();
    await device.screen.unmount();
    const sheet = await open("viewer", `${SHEET_URL}?kind=dose`);
    await expect.poll(() => sheet.location()).toBe(DOSE_URL);
    expect(SHEET()).toBeNull();
  });
});
