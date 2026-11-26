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
import { SPECIALTY_SUGGESTIONS } from "~/lib/providers/specialties";
import { renderWithDevice } from "../../../../../test/device";
import { fx } from "../../../../../test/fixtures";
import { requiredLabels, saysOptional } from "../../../../../test/required";
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
// with two phones and a practice saved and queued whole, opening its page with Back to the list,
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

/** The form's tabs (Essentials, More); a tab's name also carries its markers, so match the start. */
const formTab = (name: "Essentials" | "More") =>
  page
    .getByRole("dialog")
    .getByRole("tablist", { name: "Provider sections" })
    .getByRole("tab", { name, exact: false });
const showTab = async (name: "Essentials" | "More") => {
  await userEvent.click(formTab(name));
  await expect.element(formTab(name)).toHaveAttribute("aria-selected", "true");
};

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

  const sheetButton = (name: string) => page.getByRole("dialog").getByRole("button", { name, exact: true });

  test("the add sheet's footer keeps its names: Add provider, and Cancel and Escape close onto the list, adding nothing", async () => {
    const device = await open({ role: "caretaker" });
    await openAdd();
    await expect.element(sheetButton("Add provider")).toHaveAttribute("type", "submit");
    await userEvent.click(sheetButton("Cancel"));
    await expect.poll(() => !FORM() && device.location()).toBe(PROVIDERS_URL);

    await openAdd();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => !SHEET() && device.location()).toBe(PROVIDERS_URL);
    expect(listNames("Current providers").length).toBe(6);
    expect(await device.queued()).toEqual([]);
  });

  test("the edit sheet's footer keeps its names: Delete provider, Cancel and Save", async () => {
    await open({ url: `${PROVIDERS_URL}/${PATEL.id}/edit` });
    await expect.element(sheetButton("Save")).toHaveAttribute("type", "submit");
    await expect.element(sheetButton("Cancel")).toBeVisible();
    await expect.element(sheetButton("Delete provider")).toBeVisible();
  });

  test("validation on the fields: name required, email and website shape, at most six phones (Add disabled at six; a seventh forced in is refused); focus on the first", async () => {
    const device = await open();
    await openAdd();
    await showTab("More");
    await fill("email", "not-an-email");
    await fill("website", "not a site");
    await showTab("Essentials");
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

  test("a clinician with two phones and a practice: saving opens the new provider's page, written and queued whole; Back goes to the directory, where it is, not the form", async () => {
    // From Dr. Patel's page to the directory, so Back has somewhere to go.
    const device = await open({ url: providerUrl(PATEL.id) });
    await userEvent.click(page.getByRole("link", { name: "Providers" }).first());
    await expect.poll(() => device.location()).toBe(PROVIDERS_URL);
    await waitUntil(() => listNames("Current providers").length > 0);
    await openAdd();

    await fill("name", "Dr. Nadia Brooks");
    await fill("specialty", "Neurology");
    await userEvent.selectOptions(await found(() => field<HTMLSelectElement>("phoneLabel")), "Office");
    await fill("phoneNumber", "(555) 010-7700");
    await addPhone();
    await userEvent.selectOptions(
      await found(() => field<HTMLSelectElement>("phoneLabel", 1)),
      "After hours",
    );
    await fill("phoneNumber", "(555) 010-7701", 1);
    await userEvent.selectOptions(await found(() => field<HTMLSelectElement>("practiceId")), WESTSIDE.id);
    await showTab("More");
    await fill("email", "brooks@neuro.example");
    await fill("website", "neuro.example");
    await fill("address", "9 Elm Lane\nSpringfield");
    await userEvent.click(submit());

    // The row is local at once, so its page opens offline.
    await expect.poll(() => storedNamed(device, "Dr. Nadia Brooks")).toBeDefined();
    const row = (await storedNamed(device, "Dr. Nadia Brooks"))!;
    await expect.poll(() => !SHEET() && device.location()).toBe(providerUrl(row.id));
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Dr. Nadia Brooks" }))
      .toBeInTheDocument();
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

    // The page replaced the sheet's entry: Back is the directory, with no form.
    back();
    await expect.poll(() => device.location()).toBe(PROVIDERS_URL);
    await expect.poll(() => listNames("Current providers")).toContain("Dr. Nadia Brooks");
    expect(FORM()).toBeNull();
  });

  test("a phone's label is a select: Nurse line saves as is; Custom shows a focused text box whose text saves; the row fits at phone width", async () => {
    const device = await open({ role: "caretaker" });
    await openAdd();
    const select = await found(() => field<HTMLSelectElement>("phoneLabel"));
    expect(select.tagName).toBe("SELECT");
    expect([...select.options].map((o) => o.text)).toEqual([
      "No label",
      "Office",
      "Mobile",
      "Front desk",
      "Nurse line",
      "After hours",
      "Refills",
      "Fax",
      "Custom",
    ]);
    expect(select.value).toBe("");

    await fill("name", "Dr. Lena Ortiz");
    await userEvent.selectOptions(select, "Nurse line");
    await fill("phoneNumber", "(555) 010-7800");
    await addPhone();
    await userEvent.selectOptions(await found(() => field<HTMLSelectElement>("phoneLabel", 1)), "Custom");
    // Custom names the text box, not the select, so the row still posts one label.
    const custom = await found(() => field<HTMLInputElement>("phoneLabel", 1));
    expect(custom.tagName).toBe("INPUT");
    expect(custom.maxLength).toBe(40);
    await expect.poll(() => document.activeElement).toBe(custom);
    await userEvent.type(custom, "Billing");
    await fill("phoneNumber", "(555) 010-7801", 1);

    // At the test device's phone width (420), each row stays inside the form.
    const formRight = FORM()!.getBoundingClientRect().right;
    for (const row of FORM()!.querySelectorAll("[data-phone-row]"))
      expect(row.getBoundingClientRect().right).toBeLessThanOrEqual(formRight);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);

    await userEvent.click(submit());
    await expect.poll(() => storedNamed(device, "Dr. Lena Ortiz")).toBeDefined();
    const row = (await storedNamed(device, "Dr. Lena Ortiz"))!;
    await expect.poll(() => !SHEET() && device.location()).toBe(providerUrl(row.id));
    expect(JSON.parse(row.phones)).toEqual([
      { label: "Nurse line", number: "(555) 010-7800" },
      { label: "Billing", number: "(555) 010-7801" },
    ]);
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

describe("required fields (B-801)", () => {
  test("the add sheet marks exactly the type and the name, for a clinician and a pharmacy, and no label says optional", async () => {
    await open({ url: `${PROVIDERS_URL}/new` });
    await waitUntil(() => !!FORM());
    expect(requiredLabels(FORM())).toEqual(["Type", "Name"]);
    expect(saysOptional(FORM())).toBe(false);
    await expect.poll(() => field("name")?.getAttribute("aria-required")).toBe("true");
    await expect.poll(() => field("email")?.hasAttribute("aria-required")).toBe(false);

    await userEvent.click(
      await found(() => FORM()?.querySelector<HTMLInputElement>('[name="type"][value="pharmacy"]')),
    );
    await expect.poll(() => field("practiceId")).toBeNull();
    expect(requiredLabels(FORM())).toEqual(["Type", "Name"]);
    expect(saysOptional(FORM())).toBe(false);
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

    await showTab("More");
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

  test("a stored label that isn't a choice opens Custom with its text, a choice selects it, a blank one stays blank; saving keeps all three", async () => {
    const phones = [
      { label: "Billing", number: "(555) 010-7800" },
      { label: "Fax", number: "(555) 010-7801" },
      { label: "", number: "(555) 010-7802" },
    ];
    const ORTIZ = fx.provider({ name: "Dr. Lena Ortiz", phones });
    const device = await open({ url: `${PROVIDERS_URL}/${ORTIZ.id}/edit`, fixtures: [directory(), ORTIZ] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    const selects = () => [...FORM()!.querySelectorAll<HTMLSelectElement>("[data-phone-label] select")];
    expect(selects().map((s) => s.value)).toEqual(["(custom)", "Fax", ""]);
    expect(selects()[0]?.selectedOptions[0]?.text).toBe("Custom");
    const labels = () => [...FORM()!.querySelectorAll<HTMLInputElement>('[name="phoneLabel"]')];
    expect(labels().map((l) => [l.tagName, l.value])).toEqual([
      ["INPUT", "Billing"],
      ["SELECT", "Fax"],
      ["SELECT", ""],
    ]);
    // Only a pick moves focus; opening the sheet onto Custom doesn't.
    expect(document.activeElement).not.toBe(labels()[0]);

    await fill("specialty", "Billing office");
    await userEvent.click(submit());
    await expect.poll(async () => (await stored(device, ORTIZ.id))?.specialty).toBe("Billing office");
    const saved = await stored(device, ORTIZ.id);
    expect(JSON.parse(saved?.phones ?? "null")).toEqual(phones);
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

describe("the form's two tabs, Essentials and More (B-694)", () => {
  const tabName = (name: "Essentials" | "More") => formTab(name).element().getAttribute("aria-label") ?? name;
  const KIM = fx.provider({
    name: "Dr. Mina Kim",
    specialty: "Dermatology",
    phones: [{ label: "Office", number: "(555) 010-8800" }],
    email: "kim@skin.example",
  });

  test("a new provider saves from Essentials alone, which holds type, name, specialty, practice and phones", async () => {
    const device = await open({ role: "caretaker" });
    await openAdd();
    await expect.element(formTab("Essentials")).toHaveAttribute("aria-selected", "true");
    const essentials = FORM()!.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!;
    for (const name of ["type", "name", "specialty", "practiceId", "phoneNumber"])
      expect(essentials.querySelector(`[name="${name}"]`), name).not.toBeNull();
    for (const name of ["email", "address", "website", "isPrimary", "past"])
      expect(essentials.querySelector(`[name="${name}"]`), name).toBeNull();
    expect(tabName("More")).toBe("More");

    await fill("name", "Dr. Omar Haddad");
    await userEvent.click(submit());
    await expect.poll(() => storedNamed(device, "Dr. Omar Haddad")).toBeDefined();
    expect(await storedNamed(device, "Dr. Omar Haddad")).toMatchObject({ type: "clinician", email: null });
  });

  test("a value typed on More survives switching back to Essentials, Save shows on both, and it is saved", async () => {
    const device = await open({ role: "caretaker" });
    await openAdd();
    await fill("name", "Dr. Omar Haddad");
    await showTab("More");
    await expect.element(submit()).toBeVisible();
    await fill("email", "haddad@clinic.example");
    await userEvent.click(await found(() => field("isPrimary")));
    await showTab("Essentials");
    await expect.element(submit()).toBeVisible();
    expect(field("email")?.value).toBe("haddad@clinic.example");
    await showTab("More");
    await expect
      .element(page.getByRole("dialog").getByRole("textbox", { name: "Email" }))
      .toHaveValue("haddad@clinic.example");
    await showTab("Essentials");

    await userEvent.click(submit());
    await expect.poll(() => storedNamed(device, "Dr. Omar Haddad")).toBeDefined();
    expect(await storedNamed(device, "Dr. Omar Haddad")).toMatchObject({
      email: "haddad@clinic.example",
      is_primary: 1,
    });
  });

  test("editing a provider with an email opens on Essentials with More marked filled in", async () => {
    await open({ url: `${PROVIDERS_URL}/${KIM.id}/edit`, fixtures: [directory(), KIM] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    await expect.element(formTab("Essentials")).toHaveAttribute("aria-selected", "true");
    expect(tabName("More")).toBe("More, filled in");
    expect(tabName("Essentials")).toBe("Essentials");
  });

  test("an invalid email saved from Essentials switches to More, marks it and focuses the email; nothing is written", async () => {
    const device = await open({ url: `${PROVIDERS_URL}/${KIM.id}/edit`, fixtures: [directory(), KIM] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    await showTab("More");
    await fill("email", "not-an-email");
    await showTab("Essentials");
    await userEvent.click(submit());

    await expect.element(formTab("More")).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => (document.activeElement as HTMLInputElement | null)?.name).toBe("email");
    expect(fieldErrors()).toEqual({ email: "Enter an email address" });
    await expect.poll(() => tabName("More")).toBe("More, filled in, has an error");
    expect(SHEET()).not.toBeNull();
    expect((await stored(device, KIM.id))?.email).toBe("kim@skin.example");
    expect(await device.queued()).toEqual([]);
  });

  test("a change made only on More makes the discard prompt ask, from Essentials too", async () => {
    const device = await open({ url: `${PROVIDERS_URL}/${KIM.id}/edit`, fixtures: [directory(), KIM] });
    await waitUntil(() => !!FORM(), "the edit sheet");
    await showTab("More");
    await userEvent.click(await found(() => field("past")));
    await showTab("Essentials");
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("heading", { name: "Discard changes?" })).toBeVisible();
    expect(device.location()).toBe(`${PROVIDERS_URL}/${KIM.id}/edit`);
  });
});

describe("specialty suggestions (B-923)", () => {
  /** The datalist the specialty input names, and its options' values. */
  const suggestions = () => {
    const id = field("specialty")?.getAttribute("list");
    const list = id ? document.getElementById(id) : null;
    if (!(list instanceof HTMLDataListElement)) return null;
    return [...list.options].map((o) => o.value);
  };
  const pickType = async (type: string) =>
    userEvent.click(
      await found(() => FORM()?.querySelector<HTMLInputElement>(`[name="type"][value="${type}"]`)),
    );

  test("the specialty input is linked to a datalist of its type's suggestions, which follow the type", async () => {
    await open({ role: "caretaker" });
    await openAdd();
    await expect.poll(suggestions).toEqual([...SPECIALTY_SUGGESTIONS.clinician]);
    for (const type of ["pharmacy", "practice", "other", "clinician"] as const) {
      await pickType(type);
      await expect.poll(suggestions).toEqual([...SPECIALTY_SUGGESTIONS[type]]);
    }
  });

  test("a value not in the list saves as typed", async () => {
    const device = await open({ role: "caretaker" });
    await openAdd();
    await fill("name", "Dr. Iris Fenwick");
    await fill("specialty", "Sleep medicine (pediatric)");
    expect(suggestions()).not.toContain("Sleep medicine (pediatric)");
    await userEvent.click(submit());
    await expect
      .poll(async () => (await storedNamed(device, "Dr. Iris Fenwick"))?.specialty)
      .toBe("Sleep medicine (pediatric)");
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
