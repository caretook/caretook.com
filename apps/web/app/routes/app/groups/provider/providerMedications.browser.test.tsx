import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import {
  $,
  $$,
  ELM,
  GROUP,
  LARK,
  LATANOPROST,
  MEDICATION_ROUTES,
  medicationUrl,
  OKAFOR,
  waitUntil,
  world,
} from "../medications/medicationWorld";
import * as provider from "./route";

// The provider page's Medications region (medications.mjs's provider page
// steps): a prescriber's current medications ("Prescribes"; not the stopped
// ones), the pharmacy's ("Fills"), each opening its page, and no region for
// a provider no medication names.

const ROUTES = [
  ...MEDICATION_ROUTES,
  { path: "/app/groups/:groupId/providers/:providerId", module: provider },
];
const providerUrl = (id: string) => `/app/groups/${GROUP}/providers/${id}`;
const open = (id: string) => renderWithDevice({ route: ROUTES, url: providerUrl(id), fixtures: world() });

const region = () =>
  $$("main [data-provider-medications] a[data-medication-id]").map((a) => [
    a.querySelector("[data-medication-name]")?.textContent?.trim(),
    a.querySelector("[data-medication-role]")?.textContent?.trim(),
  ]);
const ready = () => !!$("main [data-provider-medications] a[data-medication-id]");

describe("the provider page's medications", () => {
  test("a prescriber's page lists the current medications they prescribe, not the stopped ones", async () => {
    await open(LARK.id);
    await waitUntil(ready, 4000, "the region");
    expect(region()).toEqual([
      ["Lisinopril 10 mg", "Prescribes"],
      ["Metformin 500 mg", "Prescribes"],
    ]);
  });

  test("the pharmacy's page lists the current medications it fills, and each opens its page", async () => {
    const device = await open(ELM.id);
    await waitUntil(ready, 4000, "the region");
    expect(region()).toEqual([
      ["Latanoprost 0.005%", "Fills"],
      ["Lisinopril 10 mg", "Fills"],
      ["Metformin 500 mg", "Fills"],
    ]);
    await userEvent.click($(`main [data-provider-medications] a[data-medication-id="${LATANOPROST.id}"]`)!);
    await expect.poll(device.location).toBe(medicationUrl(LATANOPROST.id));
  });

  test("a provider with no medications has no Medications region", async () => {
    await open(OKAFOR.id);
    await waitUntil(() => !!$("main [data-linked-entries]"), 4000, "the page");
    expect($("main [data-provider-medications]")).toBeNull();
  });
});
