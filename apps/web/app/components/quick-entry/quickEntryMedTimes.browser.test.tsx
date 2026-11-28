import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { renderInRouter, renderWithDevice } from "../../../test/device";
import { fx, medicationPass, TEST_GROUP } from "../../../test/fixtures";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import { QuickEntrySuggestButton } from "./QuickEntrySuggestButton";
import type { DuePass } from "@caretook/data/schema";

// Quick entry calls a pass a med time, as the Medications screens do
// (B-695): the Suggestions button's name when one is due, and the refusal
// when the one a line named is gone. The code keeps "pass".

const EVENING: DuePass = {
  key: "pass:evening",
  passId: "6b0f5c1e-3d2a-4e8b-9c7f-1a2b3c4d5e6f",
  name: "Evening",
  time: "20:00",
  at: "2026-11-24T04:00:00.000Z",
  slots: [],
  open: [],
  state: "due",
} as unknown as DuePass;

const button = (duePasses: DuePass[]) =>
  renderInRouter(
    <div className="relative">
      <QuickEntrySuggestButton
        size="md"
        usual={[]}
        recent={["slept well"]}
        duePasses={duePasses}
        onFill={() => undefined}
        onGivePass={() => undefined}
      />
    </div>,
  );

describe("med times in quick entry", () => {
  test("the Suggestions button says a med time is due", async () => {
    await button([EVENING]);
    await expect
      .element(page.getByRole("button", { name: "Suggestions, a med time is due", exact: true }))
      .toBeVisible();
    expect(document.body.textContent ?? "").not.toMatch(/\bpass(es)?\b/i);
  });

  test("with none due it's just Suggestions", async () => {
    await button([]);
    await expect.element(page.getByRole("button", { name: "Suggestions", exact: true })).toBeVisible();
  });

  test("Given all for a med time that's gone is refused in those words", async () => {
    const gone = medicationPass({ name: "Evening", time: "20:00", deletedAt: new Date().toISOString() });
    const device = await renderWithDevice({ element: <p>Quick entry</p>, fixtures: [gone, fx.medication()] });
    const result = await runActions(device.db, TEST_GROUP.id, [
      { type: "givePass", passId: gone.id, occurredAt: new Date(Date.now() - 60_000).toISOString() },
    ]);
    expect(result).toMatchObject({ ok: false, error: "That med time is gone. It may have been deleted." });
  });
});
