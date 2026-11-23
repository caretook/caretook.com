import type { Route } from "./+types/route";
import type { DeviceRoute } from "../../../../../test/device";

import { useLayoutEffect } from "react";
import { useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import {
  createAndLinkProvider,
  createProvider,
  linkProvider,
  removeProvider,
  updateProvider,
} from "~/lib/providers/providers.sync";
import { renderWithDevice } from "../../../../../test/device";
import { fx } from "../../../../../test/fixtures";
import {
  ADD_PROVIDER,
  CONFIRM,
  confirmButton,
  CORNERSTONE,
  directory,
  field,
  fieldErrors,
  fill,
  FORM,
  formButton,
  GROUP,
  listNames,
  PATEL,
  PICKUP,
  PROVIDER_ROUTES,
  PROVIDERS_URL,
  providerUrl,
  SHEET,
  submit,
  WESTSIDE,
} from "./providerWorld";
import * as providers from "./route";

// The directory's add and edit sheets on the test device (providers.mjs's
// sheet, practice-delete and device steps): Add over the list, validation on
// the fields (at most six phones, a seventh forced in refused), a clinician
// with two phones and a practice saved and queued whole, Back after a save,
// edit by deep link, primary and past, delete after a confirm, a practice
// that providers name refusing to go, and the device module's own refusals
// (a viewer's writes, a symptom link, a bad practice). The device is offline
// throughout, so every save here is an offline write; uploading it and
// another device receiving it are roundtrip.mjs's sync matrix (6b); the
// server's rules are provider.int.test.ts's and syncProviders.int.test.ts's.

/** Back (history −1), as the browser's button does. */
let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}
function ProvidersWithBack(props: Route.ComponentProps) {
  const List = providers.default;
  return (
    <>
      <BackProbe />
      <List {...props} />
    </>
  );
}
const ROUTES: DeviceRoute[] = [
  { ...PROVIDER_ROUTES[0]!, module: { ...providers, default: ProvidersWithBack } },
  ...PROVIDER_ROUTES.slice(1),
];

const open = (options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url: PROVIDERS_URL, fixtures: directory(), ...options });

type StoredProvider = {
  id: string;
  type: string;
  name: string;
  specialty: string | null;
  practice_id: string | null;
  phones: string;
  email: string | null;
  address: string | null;
  website: string | null;
  status: string;
  is_primary: number;
  deleted_at: string | null;
};
const storedNamed = async (device: Awaited<ReturnType<typeof open>>, name: string) =>
  (await device.query<StoredProvider>("SELECT * FROM provider WHERE name = ?", [name]))[0];
const stored = async (device: Awaited<ReturnType<typeof open>>, id: string) =>
  (await device.query<StoredProvider>("SELECT * FROM provider WHERE id = ?", [id]))[0];

const addPhone = async () => userEvent.click(await found(() => formButton("Add a phone number")));
const openAdd = async () => {
  await userEvent.click(await found(ADD_PROVIDER));
  await waitUntil(() => !!FORM(), "the add sheet");
};

describe("adding a provider", () => {
  test("Add provider opens the sheet over the list (…/providers/new), as a clinician", async () => {
    const device = await open({ role: "caretaker" });
    await openAdd();
    expect(device.location()).toBe(`${PROVIDERS_URL}/new`);
    expect(document.querySelector<HTMLElement>("[role=dialog] :is(h2, h3)")?.textContent).toBe(
      "Add a provider",
    );
    await expect
      .poll(() => FORM()?.querySelector<HTMLInputElement>('[name="type"]:checked')?.value)
      .toBe("clinician");
    expect(listNames("Current providers").length).toBe(6);
  });

  test("the footer keeps its names: Cancel and Add provider here, Delete provider, Cancel and Save on an edit; Cancel closes onto the list", async () => {
    const button = (name: string) => page.getByRole("dialog").getByRole("button", { name, exact: true });
    const device = await open({ role: "caretaker" });
    await openAdd();
    await expect.element(button("Add provider")).toHaveAttribute("type", "submit");
    await userEvent.click(button("Cancel"));
    await expect.poll(() => !FORM() && device.location()).toBe(PROVIDERS_URL);

    await open({ url: `${PROVIDERS_URL}/${PATEL.id}/edit` });
    await expect.element(button("Save")).toHaveAttribute("type", "submit");
    await expect.element(button("Cancel")).toBeVisible();
    await expect.element(button("Delete provider")).toBeVisible();
  });

  test("validation on the fields: name required, email and website shape, at most six phones (Add disabled at six; a seventh forced in is refused); focus on the first", async () => {
    const device = await open();
    await openAdd();
    await fill("email", "not-an-email");
    await fill("website", "not a site");
    for (let i = 0; i < 5; i++) await addPhone();
    await expect.poll(() => FORM()?.querySelectorAll('[name="phoneNumber"]').length).toBe(6);
    expect(formButton("Add a phone number")?.disabled).toBe(true);

    // A seventh row, as an old or tampered form would send it.
    const li = document.createElement("li");
    li.innerHTML = '<input name="phoneLabel" value="x"><input name="phoneNumber" value="555 0199">';
    FORM()!.querySelector("[data-phones]")!.append(li);
    for (const [i, input] of [
      ...FORM()!.querySelectorAll<HTMLInputElement>('[name="phoneNumber"]'),
    ].entries())
      input.value = `555 01${10 + i}`;

    await userEvent.click(submit());
    await waitUntil(() => !!FORM()?.querySelector('[aria-invalid="true"]'), "the errors");
    expect(fieldErrors()).toMatchObject({
      name: "Enter a name",
      email: "Enter an email address",
      website: "Enter a web address, like clinic.example",
      phones: "At most 6 phone numbers",
    });
    expect(SHEET()).not.toBeNull();
    await expect.poll(() => (document.activeElement as HTMLInputElement | null)?.name).toBe("name");
    expect(await storedNamed(device, "")).toBeUndefined();
    expect(await device.queued()).toEqual([]);
  });

  test("a clinician with two phones and a practice: saving closes the sheet onto the list, where it is at once, written and queued whole; Back doesn't reopen the sheet", async () => {
    // From Dr. Patel's page to the directory, so Back has somewhere to go.
    const device = await open({ url: providerUrl(PATEL.id) });
    await userEvent.click(page.getByRole("link", { name: "Providers" }).first());
    await expect.poll(() => device.location()).toBe(PROVIDERS_URL);
    await waitUntil(() => listNames("Current providers").length > 0);
    await openAdd();

    await fill("name", "Dr. Nadia Brooks");
    await fill("specialty", "Neurology");
    await fill("email", "brooks@neuro.example");
    await fill("website", "neuro.example");
    await fill("address", "9 Elm Lane\nSpringfield");
    await fill("phoneLabel", "Office");
    await fill("phoneNumber", "(555) 010-7700");
    await addPhone();
    await fill("phoneLabel", "After hours", 1);
    await fill("phoneNumber", "(555) 010-7701", 1);
    await userEvent.selectOptions(await found(() => field<HTMLSelectElement>("practiceId")), WESTSIDE.id);
    await userEvent.click(submit());

    await expect.poll(() => !SHEET() && device.location()).toBe(PROVIDERS_URL);
    await expect.poll(() => listNames("Current providers")).toContain("Dr. Nadia Brooks");
    const row = (await storedNamed(device, "Dr. Nadia Brooks"))!;
    expect(row).toMatchObject({
      type: "clinician",
      specialty: "Neurology",
      practice_id: WESTSIDE.id,
      email: "brooks@neuro.example",
      website: "neuro.example",
      address: "9 Elm Lane\nSpringfield",
      status: "current",
      is_primary: 0,
    });
    expect(JSON.parse(row.phones)).toEqual([
      { label: "Office", number: "(555) 010-7700" },
      { label: "After hours", number: "(555) 010-7701" },
    ]);
    expect(await device.queued()).toEqual([
      expect.objectContaining({ op: "PUT", type: "provider", id: row.id }),
    ]);

    back();
    await expect.poll(() => device.location()).toBe(providerUrl(PATEL.id));
    expect(FORM()).toBeNull();
  });

  test("?type=pharmacy starts the form as a pharmacy, with no practice field", async () => {
    await open({ url: `${PROVIDERS_URL}/new?type=pharmacy` });
    await waitUntil(() => !!FORM());
    await expect
      .poll(() => FORM()?.querySelector<HTMLInputElement>('[name="type"]:checked')?.value)
      .toBe("pharmacy");
    expect(field("practiceId")).toBeNull();
  });
});

describe("editing a provider", () => {
  const BROOKS = fx.provider({
    name: "Dr. Nadia Brooks",
    specialty: "Neurology",
    practiceId: WESTSIDE.id,
    phones: [
      { label: "Office", number: "(555) 010-7700" },
      { label: "After hours", number: "(555) 010-7701" },
    ],
    address: "9 Elm Lane\nSpringfield",
  });

  test("a deep link to …/:id/edit opens the sheet filled in; primary and past save together: it moves under Past providers", async () => {
    const device = await open({ url: `${PROVIDERS_URL}/${BROOKS.id}/edit`, fixtures: [directory(), BROOKS] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(document.querySelector<HTMLElement>("[role=dialog] :is(h2, h3)")?.textContent).toBe(
      "Edit Dr. Nadia Brooks",
    );
    expect(field("name")?.value).toBe("Dr. Nadia Brooks");
    expect(
      [...(FORM()?.querySelectorAll<HTMLInputElement>('[name="phoneNumber"]') ?? [])].map((i) => i.value),
    ).toEqual(["(555) 010-7700", "(555) 010-7701"]);
    expect(field<HTMLSelectElement>("practiceId")?.value).toBe(WESTSIDE.id);
    expect(field<HTMLTextAreaElement>("address")?.value).toBe("9 Elm Lane\nSpringfield");

    await userEvent.click(await found(() => field("isPrimary")));
    await userEvent.click(await found(() => field("past")));
    await userEvent.click(submit());
    // A deep link closes onto the list.
    await expect.poll(() => !SHEET() && device.location()).toBe(PROVIDERS_URL);
    await expect.poll(async () => (await stored(device, BROOKS.id))?.status).toBe("past");
    expect((await stored(device, BROOKS.id))?.is_primary).toBe(1);
    await device.settle();
    expect(listNames("Current providers")).not.toContain("Dr. Nadia Brooks");
    await expect.poll(() => listNames("Past providers")).toContain("Dr. Nadia Brooks");
  });

  test("Delete asks first: Escape and Cancel close only the confirm; Delete closes the sheet and soft-deletes it; its edit URL is then the list", async () => {
    const device = await open({ url: `${PROVIDERS_URL}/${BROOKS.id}/edit`, fixtures: [directory(), BROOKS] });
    await waitUntil(() => !!FORM());
    await userEvent.click(await found(() => formButton("Delete provider")));
    await waitUntil(() => !!CONFIRM()?.open, "the confirm");
    await expect.poll(() => CONFIRM()?.querySelector("h2")?.textContent).toBe("Delete Dr. Nadia Brooks?");
    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !CONFIRM()?.open, "the confirm to close");
    expect(FORM()).not.toBeNull();

    await userEvent.click(await found(() => formButton("Delete provider")));
    await waitUntil(() => !!CONFIRM()?.open);
    await userEvent.click(await found(() => confirmButton("Cancel")));
    await waitUntil(() => !CONFIRM()?.open);
    expect(FORM()).not.toBeNull();
    expect((await stored(device, BROOKS.id))?.deleted_at).toBeNull();

    await userEvent.click(await found(() => formButton("Delete provider")));
    await waitUntil(() => !!CONFIRM()?.open);
    await userEvent.click(await found(() => confirmButton("Delete")));
    await expect.poll(() => !SHEET() && device.location()).toBe(PROVIDERS_URL);
    await expect.poll(async () => (await stored(device, BROOKS.id))?.deleted_at).not.toBeNull();
    await device.settle();
    expect(listNames("Current providers")).not.toContain("Dr. Nadia Brooks");
    expect(await device.queued()).toEqual([
      expect.objectContaining({ op: "PATCH", type: "provider", id: BROOKS.id }),
    ]);
    await device.screen.unmount();

    const again = await open({ url: `${PROVIDERS_URL}/${BROOKS.id}/edit`, fixtures: [] });
    await expect.poll(() => again.location()).toBe(PROVIDERS_URL);
    expect(FORM()).toBeNull();
  });

  test("a practice a live clinician names: the device refuses to delete it, and the confirm says why with Delete disabled; once the clinician moves, it deletes", async () => {
    const PRACTICE = fx.provider({ type: "practice", name: "Lakeview Clinic", specialty: null });
    const LINKED = fx.provider({ name: "Dr. Ivo Lang", practiceId: PRACTICE.id });
    const device = await open({
      url: `${PROVIDERS_URL}/${PRACTICE.id}/edit`,
      fixtures: [directory(), PRACTICE, LINKED],
    });
    const refused = await removeProvider(device.db, PRACTICE.id);
    expect(refused).toMatchObject({ ok: false });
    expect(!refused.ok && refused.error).toMatch(/Move them to another practice, or delete them, first/);

    await waitUntil(() => !!FORM());
    await userEvent.click(await found(() => formButton("Delete provider")));
    await waitUntil(() => !!CONFIRM()?.open);
    await expect
      .poll(() => CONFIRM()?.querySelector("p")?.textContent)
      .toMatch(/^1 provider is linked to this practice\./);
    expect(confirmButton("Delete")?.disabled).toBe(true);
    await userEvent.click(await found(() => confirmButton("Cancel")));
    await waitUntil(() => !CONFIRM()?.open);
    expect((await stored(device, PRACTICE.id))?.deleted_at).toBeNull();

    expect((await updateProvider(device.db, LINKED.id, { practiceId: null })).ok).toBe(true);
    await device.settle();
    await userEvent.click(await found(() => formButton("Delete provider")));
    await waitUntil(() => !!CONFIRM()?.open);
    await expect.poll(() => CONFIRM()?.querySelector("p")).toBeNull();
    expect(confirmButton("Delete")?.disabled).toBe(false);
    await userEvent.click(await found(() => confirmButton("Delete")));
    await expect.poll(async () => (await stored(device, PRACTICE.id))?.deleted_at).not.toBeNull();
  });
});

describe("the device module's refusals", () => {
  test("local writes refuse a symptom link and a practice with a practice of its own; linking a pair twice writes one row", async () => {
    const SYMPTOM = fx.symptom({ name: "Dizziness" });
    const device = await open({ fixtures: [directory(), SYMPTOM] });
    expect((await linkProvider(device.db, SYMPTOM.id, CORNERSTONE.id)).ok).toBe(false);
    const bad = await createProvider(device.db, GROUP, {
      type: "practice",
      name: "Second clinic",
      practiceId: CORNERSTONE.id,
    });
    expect(bad.ok).toBe(false);

    expect((await linkProvider(device.db, PICKUP.id, WESTSIDE.id)).ok).toBe(true);
    expect((await linkProvider(device.db, PICKUP.id, WESTSIDE.id)).ok).toBe(true);
    const links = await device.query(
      "SELECT id FROM timeline_entry_provider WHERE entry_id = ? AND provider_id = ?",
      [PICKUP.id, WESTSIDE.id],
    );
    expect(links.length).toBe(1);
    expect((await device.queued()).length).toBe(1);
  });

  test("a viewer's device refuses to add, edit, delete, link or create-and-link, and queues nothing", async () => {
    const device = await open({ role: "viewer" });
    expect((await createProvider(device.db, GROUP, { type: "other", name: "Neighbor" })).ok).toBe(false);
    expect((await updateProvider(device.db, PATEL.id, { specialty: "Heart" })).ok).toBe(false);
    expect((await removeProvider(device.db, PATEL.id)).ok).toBe(false);
    expect((await linkProvider(device.db, PICKUP.id, WESTSIDE.id)).ok).toBe(false);
    expect(
      (await createAndLinkProvider(device.db, PICKUP.id, { type: "clinician", name: "Dr. New" })).ok,
    ).toBe(false);
    expect(await device.queued()).toEqual([]);
  });
});
