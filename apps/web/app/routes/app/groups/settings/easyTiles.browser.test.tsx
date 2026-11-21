import type { DeviceRoute } from "../../../../../test/device";
import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as details from "./details/route";
import * as settingsLayout from "./layout/route";
import { apiCalls } from "../../../../../test/api";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP } from "../../../../../test/fixtures";

// Group settings Details' "Easy mode tiles" card (assistant slice 6):
// owners and admins choose, online, how easy mode picks its four tiles
// (learned from use, a fixed set, or four picked), through careGroup.update;
// everyone else, and anyone offline, reads the choice. The tiles themselves
// are timeline/timelineEasyTiles.browser.test.tsx's.

const BASE = "/app/groups/:groupId/settings";
const ROUTES: DeviceRoute[] = [
  { path: BASE, module: settingsLayout, children: [{ path: `${BASE}/details`, module: details }] },
];
const DETAILS = `/app/groups/${TEST_GROUP.id}/settings/details`;

const ONLINE = {
  "careGroup.recipient": () => ({ id: "r", name: "June Moreno", preferredName: "Grandma June" }),
};

const open = ({
  role = "owner",
  api,
  easyTiles = null,
}: {
  role?: GroupRole;
  api?: Record<string, (input: unknown) => unknown>;
  easyTiles?: object | null;
} = {}) =>
  renderWithDevice({
    route: ROUTES,
    url: DETAILS,
    role,
    fixtures: [
      fx.group({ easyTiles: easyTiles ? JSON.stringify(easyTiles) : null }),
      fx.recipient({ pronouns: "she/her" }),
    ],
    api: api && { ...ONLINE, ...api },
  });

const card = () => page.getByRole("region", { name: "Easy mode tiles" });
const tile = (n: number) => card().getByRole("combobox", { name: `Tile ${n}` });
/** The read-only card's details, as "label: value" lines. */
const shown = () =>
  [...(card().element().querySelectorAll("dl > div") ?? [])].map(
    (d) => `${d.querySelector("dt")?.textContent}: ${d.querySelector("dd")?.textContent}`,
  );
const save = () => card().getByRole("button", { name: "Save" });

describe("the Easy mode tiles card", () => {
  test("an owner, online: learned to start with; picking four sends them, labelled about the recipient", async () => {
    const calls = apiCalls();
    await open({ api: calls.record({ "careGroup.update": () => null }) });
    await expect.element(card().getByRole("radio", { name: "Learned from use" })).toBeChecked();
    expect(card().getByRole("combobox").elements()).toHaveLength(0);

    await userEvent.click(card().getByRole("radio", { name: "Pick four" }));
    // The fixed set to start from, in plain words.
    await expect.element(tile(1)).toHaveValue("symptom");
    await expect.element(tile(1).getByRole("option", { name: "How she feels" })).toBeInTheDocument();
    await userEvent.selectOptions(tile(1), "Blood sugar");
    await userEvent.click(save());
    await expect
      .poll(() => calls.of("careGroup.update"))
      .toEqual([
        {
          groupId: TEST_GROUP.id,
          easyTiles: {
            mode: "custom",
            tiles: [
              { kind: "vital", vitalType: "bloodGlucose" },
              { kind: "vital", vitalType: "bloodPressure" },
              { kind: "dose" },
              { kind: "note" },
            ],
          },
        },
      ]);
    await expect.element(card().getByText("Saved.")).toBeVisible();
  });

  test("the fixed set is sent as itself; the same tile twice is refused before sending", async () => {
    const calls = apiCalls();
    await open({ role: "admin", api: calls.record({ "careGroup.update": () => null }) });
    await userEvent.click(card().getByRole("radio", { name: "Pick four" }));
    await userEvent.selectOptions(tile(2), "How she feels");
    await userEvent.click(save());
    await expect.element(card().getByRole("alert")).toHaveTextContent("Pick four different tiles.");
    expect(calls.of("careGroup.update")).toEqual([]);

    await userEvent.click(card().getByRole("radio", { name: "A fixed set" }));
    await expect
      .element(card().getByText(/How she feels, Blood pressure, Her medicines, A note about her day/))
      .toBeVisible();
    await userEvent.click(save());
    await expect
      .poll(() => calls.of("careGroup.update"))
      .toEqual([{ groupId: TEST_GROUP.id, easyTiles: { mode: "fixed" } }]);
  });

  test("a caretaker reads the choice, and follows another device's change", async () => {
    const device = await open({ role: "caretaker", api: {} });
    await expect.poll(shown).toEqual(["Tiles: Learned from use"]);
    expect(card().getByRole("radio").elements()).toHaveLength(0);
    await device.sync(
      fx.group({
        easyTiles: JSON.stringify({
          mode: "custom",
          tiles: [
            { kind: "note" },
            { kind: "dose" },
            { kind: "symptom" },
            { kind: "vital", vitalType: "weight" },
          ],
        }),
      }),
    );
    await expect
      .poll(shown)
      .toEqual(["Tiles: Pick four", "Picked: A note about her day, Her medicines, How she feels, Weight"]);
  });

  test("offline, an owner reads it too", async () => {
    await open({ easyTiles: { mode: "fixed" } });
    await expect
      .poll(shown)
      .toEqual([
        "Tiles: A fixed set",
        "Shown: How she feels, Blood pressure, Her medicines, A note about her day",
      ]);
    expect(card().getByRole("button", { name: "Save" }).elements()).toHaveLength(0);
  });
});
