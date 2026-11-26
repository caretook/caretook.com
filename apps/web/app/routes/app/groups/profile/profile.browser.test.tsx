import type { GroupRole } from "../../../../../test/fixtures";

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { MemoryRouter } from "react-router";
import { TimeZoneLine } from "./BasicsForm";
import { recipientDetails, fx, TEST_GROUP } from "../../../../../test/fixtures";
import { found } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import {
  basicsLines,
  DETAILS,
  errorOf,
  JUNE,
  juneAge,
  openProfile,
  PRINT_URL,
  PROFILE_URL,
  sections,
  sheetUrl,
  TIMELINE_URL,
} from "./profileWorld";

// The recipient's profile (profiles.mjs's screen steps): the ways in, the
// page for each role, offline, and the Basics, Contact and Insurance sheets.
// The server is profileWorld's stand-in (saves sync back); what the server
// decides is in packages/{data,api}/src/profiles.int.test.ts, the form rules
// in basicsFormData.test.ts and detailsFormData.test.ts, and a demotion
// losing the details row for real is app-shell.mjs's step 4.

const WRITER_SECTIONS = ["basics", "allergies", "conditions", "note", "contact", "insurance", "emergency"];
const NEEDS_CONNECTION = "Needs a connection to edit.";

const h1 = () => document.querySelector("main [data-profile-header] h1")?.textContent?.trim();
const editLink = (sel: string) => document.querySelector<HTMLAnchorElement>(`main a${sel}`);
const editDisabled = (sel: string) => document.querySelector<HTMLButtonElement>(`main button${sel}:disabled`);
const sheet = () => document.querySelector("[role=dialog]");
const field = (name: string) => getByCss(`[role=dialog] [name="${name}"]`);
const submit = () => getByCss('[role=dialog] button[type="submit"]');
const detailsRows = (device: { query: <T>(sql: string) => Promise<T[]> }) =>
  device.query<{ n: number }>("SELECT count(*) AS n FROM care_recipient_details").then((r) => r[0]!.n);

/** The writers' cards as the page shows them. */
const contactLinks = () =>
  [...document.querySelectorAll<HTMLAnchorElement>("main [data-recipient-contact] a[data-action]")].map(
    (a) => `${a.dataset.action}=${a.getAttribute("href")}`,
  );
const plans = () =>
  [...document.querySelectorAll<HTMLElement>("main [data-section=insurance] li[data-plan]")].map((li) => ({
    rank: li.dataset.plan,
    title: li.querySelector("[data-plan-title]")?.textContent?.trim(),
    memberId: li.querySelector("[data-member-id]")?.textContent?.trim(),
    group: li.querySelector("[data-group-number]")?.textContent?.trim() ?? null,
    call: li.querySelector('a[data-action="call"]')?.getAttribute("href") ?? null,
    callName: li.querySelector('a[data-action="call"] .sr-only')?.textContent?.trim() ?? null,
  }));

describe("the ways in", () => {
  test.each([420, 1280])(
    "at %i, the group menu's profile item opens the profile; the timeline has no profile link (timeline-ux-2)",
    async (width) => {
      const device = await openProfile({ url: TIMELINE_URL, frame: true, width });
      await expect.element(page.getByRole("heading", { level: 1, name: "Timeline" })).toBeVisible();
      expect(page.getByRole("main").getByRole("link", { name: "Grandma June's profile" }).query()).toBeNull();
      await userEvent.click(page.getByRole("button", { name: /switch care group$/ }));
      await userEvent.click(page.getByRole("menuitem", { name: "Grandma June's profile" }));
      await expect.poll(device.location).toBe(PROFILE_URL);
      await expect.poll(h1).toBe("Grandma June");
    },
  );
});

describe("the page by role", () => {
  test("an owner: the name, full name, birthday and age, Basics, the note, the writers' cards, Print and Edit", async () => {
    await openProfile();
    await expect.poll(h1).toBe("Grandma June");
    await expect.element(getByCss("main [data-full-name]")).toHaveTextContent(JUNE.name);
    await expect
      .element(getByCss("main [data-birthday]"))
      .toHaveTextContent(`Born June 2, 1940 · ${juneAge()}`);
    expect(basicsLines()).toMatchObject({
      codeStatus: "DNR",
      primaryLanguage: "English",
      pronouns: "she/her",
    });
    expect(basicsLines().bloodType).toMatch(/^A\+/);
    await expect.element(getByCss("main [data-note]")).toHaveTextContent(JUNE.notes);
    expect(sections()).toEqual(WRITER_SECTIONS);
    expect(editLink("[data-edit-basics]")?.getAttribute("href")).toBe(sheetUrl("basics"));
    expect(editLink("[data-print-link]")?.getAttribute("href")).toBe(PRINT_URL);
    for (const id of ["contact", "insurance", "emergency"])
      expect(editLink(`[data-edit-sheet="${id}"]`)?.getAttribute("href")).toBe(sheetUrl(id as "contact"));
    await expect.element(getByCss("main [data-viewer-more]")).not.toBeInTheDocument();
  });

  test("an owner's Contact calls, texts, emails and maps, and Insurance shows each plan by rank with a call", async () => {
    await openProfile();
    await expect
      .poll(contactLinks)
      .toEqual([
        "call=tel:5550107100",
        "text=sms:5550107100",
        "email=mailto:june.moreno@example.com",
        "map=https://www.google.com/maps/search/?api=1&query=22%20Birch%20Road%2C%20Springfield%2C%20OR%2097477",
      ]);
    const [first, second] = plans();
    expect(plans()).toHaveLength(2);
    expect(first).toMatchObject({
      rank: "primary",
      memberId: "1EG4-TE5-MK99",
      group: null,
      call: "tel:5550107300",
    });
    expect(first?.title).toMatch(/Medicare · Part A and B$/);
    expect(first?.callName).toMatch(/^Call Medicare/);
    expect(second).toMatchObject({
      rank: "secondary",
      memberId: "EMH-100200-01",
      group: "GRP-77001",
      call: "tel:5550107310",
    });
  });

  test("a caretaker: the same page, with Edit, Print and the writers' cards", async () => {
    await openProfile({ role: "caretaker" });
    await expect.poll(h1).toBe("Grandma June");
    expect(sections()).toEqual(WRITER_SECTIONS);
    expect(editLink("[data-edit-basics]")).not.toBeNull();
    expect(editLink("[data-print-link]")).not.toBeNull();
    await expect.element(getByCss("main [data-viewer-more]")).not.toBeInTheDocument();
  });

  test("a viewer: the basics and note, no Edit or Print, no writers' cards, the caretakers line, and no details row", async () => {
    const device = await openProfile({ role: "viewer" });
    await expect.poll(h1).toBe("Grandma June");
    expect(sections()).toEqual(["basics", "allergies", "conditions", "note"]);
    expect(basicsLines().codeStatus).toBe("DNR");
    await expect.element(getByCss("main [data-note]")).toHaveTextContent(JUNE.notes);
    await expect.element(getByCss("main [data-edit-basics]")).not.toBeInTheDocument();
    await expect.element(getByCss("main [data-print-link]")).not.toBeInTheDocument();
    await expect
      .element(getByCss("main [data-viewer-more]"))
      .toHaveTextContent("More details are visible to caretakers.");
    expect(await detailsRows(device)).toBe(0);
  });

  const guarded: [GroupRole, string][] = [
    ["viewer", sheetUrl("basics")],
    ["viewer", sheetUrl("contact")],
    ["viewer", sheetUrl("insurance")],
    ["viewer", sheetUrl("emergency")],
    ["viewer", PRINT_URL],
    ["caretaker", sheetUrl("emergency")],
  ];
  test.each(guarded)("a %s opening %s lands on the profile", async (role, url) => {
    const device = await openProfile({ role, url });
    await expect.poll(device.location).toBe(PROFILE_URL);
    await expect.poll(h1).toBe("Grandma June");
    expect(sheet()).toBeNull();
    await expect.element(getByCss("main [data-emergency-sheet]")).not.toBeInTheDocument();
  });

  test("a change from another device shows without a reload", async () => {
    const device = await openProfile({ role: "viewer" });
    await expect.poll(h1).toBe("Grandma June");
    await device.sync(fx.recipient({ ...JUNE, preferredName: "Nana June", notes: "Now uses a walker." }));
    await device.settle();
    expect(h1()).toBe("Nana June");
    await expect.element(getByCss("main [data-note]")).toHaveTextContent("Now uses a walker.");
  });

  test("a writer demoted to viewer loses the writers' cards without a reload, and gets them back", async () => {
    const device = await openProfile({ role: "caretaker" });
    await expect.poll(sections).toEqual(WRITER_SECTIONS);
    const me = await device.query<{ id: string }>("SELECT id FROM care_group_member WHERE user_id = ?", [
      device.user.id,
    ]);
    const membership = (role: GroupRole) =>
      fx.member({
        id: me[0]!.id,
        userId: device.user.id,
        role,
        relationship: "Grandson",
        emergencyRank: 1,
        isPrimaryContact: 1,
      });
    // The role arrives, then the stream takes the details row away.
    await device.sync(membership("viewer"));
    await device.unsync([recipientDetails()]);
    await device.settle();
    expect(sections()).toEqual(["basics", "allergies", "conditions", "note"]);
    await expect.element(getByCss("main [data-viewer-more]")).toBeInTheDocument();
    await expect.element(getByCss("main [data-edit-basics]")).not.toBeInTheDocument();

    await device.sync([membership("caretaker"), recipientDetails(DETAILS)]);
    await device.settle();
    expect(sections()).toEqual(WRITER_SECTIONS);
    expect(plans()).toHaveLength(2);
  });
});

describe("offline", () => {
  test("the page reads from the device; every Edit is disabled and says it needs a connection; Print stays; online again they're links", async () => {
    const device = await openProfile({ connected: false });
    await expect.poll(h1).toBe("Grandma June");
    expect(sections()).toEqual(WRITER_SECTIONS);
    expect(plans()).toHaveLength(2);
    expect(contactLinks().length).toBeGreaterThan(0);
    for (const sel of [
      "[data-edit-basics]",
      ...["contact", "insurance", "emergency"].map((s) => `[data-edit-sheet="${s}"]`),
    ]) {
      const button = await found(() => editDisabled(sel), { message: sel });
      expect(editLink(sel), sel).toBeNull();
      expect(
        document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent?.trim(),
      ).toBe(NEEDS_CONNECTION);
    }
    await expect
      .element(getByCss("main [data-profile-header] [data-needs-connection]"))
      .toHaveTextContent(NEEDS_CONNECTION);
    expect(editLink("[data-print-link]")).not.toBeNull();

    device.connect(true);
    await expect.poll(() => !!editLink("[data-edit-basics]")).toBe(true);
    for (const s of ["contact", "insurance", "emergency"])
      expect(editLink(`[data-edit-sheet="${s}"]`), s).not.toBeNull();
    await expect.element(getByCss("main [data-needs-connection]")).not.toBeInTheDocument();
  });

  test("a sheet opened offline says it needs a connection, and Save is disabled", async () => {
    await openProfile({ connected: false, url: sheetUrl("basics") });
    await expect.element(field("name")).toBeInTheDocument();
    await expect
      .element(getByCss("[role=dialog] [data-needs-connection]"))
      .toHaveTextContent(NEEDS_CONNECTION);
    await expect.element(submit()).toBeDisabled();
  });
});

describe("the Basics sheet", () => {
  test("opens from Edit, starting from the saved profile, every field labelled, the preferred name described", async () => {
    const device = await openProfile();
    await userEvent.click(page.getByRole("link", { name: "Edit profile" }));
    await expect.poll(device.location).toBe(sheetUrl("basics"));
    await expect.element(page.getByRole("dialog", { name: "Edit profile" })).toBeVisible();
    await expect.element(field("name")).toHaveValue(JUNE.name);
    await expect.element(field("preferredName")).toHaveValue(JUNE.preferredName);
    await expect.element(field("dateOfBirth")).toHaveValue(JUNE.dateOfBirth);
    await expect.element(getByCss('[role=dialog] [name="codeStatus"][value="dnr"]')).toBeChecked();
    await expect.element(field("bloodType")).toHaveValue("A+");
    await expect.element(field("primaryLanguage")).toHaveValue("English");
    await expect.element(field("pronouns")).toHaveValue("she/her");
    await expect.element(field("notes")).toHaveValue(JUNE.notes);
    const help = ((await field("preferredName").findElement()).getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .join("|");
    expect(help).toMatch(/^What everyone calls them/);
    const unlabelled = [
      ...document.querySelectorAll<HTMLElement>(
        "[role=dialog] input:not([type=radio]), [role=dialog] select, [role=dialog] textarea",
      ),
    ].filter((el) => !document.querySelector(`label[for="${el.id}"]`));
    expect(unlabelled).toEqual([]);
  });

  test("a time zone line links to group settings' Details for a writer; a viewer sees the zone without the link", async () => {
    await openProfile({ role: "caretaker", url: sheetUrl("basics") });
    await expect.element(field("name")).toBeInTheDocument();
    await expect
      .element(getByCss("[role=dialog] [data-time-zone-line] a"))
      .toHaveAttribute("href", `/app/groups/${TEST_GROUP.id}/settings/details`);
    await expect
      .element(getByCss("[role=dialog] [data-time-zone-line]"))
      .toMatchTextContent(/^Time zone: America\/Los Angeles/);

    const view = await render(
      <MemoryRouter>
        <TimeZoneLine groupId={TEST_GROUP.id} groupRole="viewer" timeZone="America/Los_Angeles" />
      </MemoryRouter>,
    );
    const line = view.container.querySelector("[data-time-zone-line]");
    expect(line?.textContent).toBe("Time zone: America/Los Angeles");
    expect(line?.querySelector("a")).toBeNull();
  });

  test("an empty name is refused on its field, which takes focus, and nothing is sent", async () => {
    const device = await openProfile({ url: sheetUrl("basics") });
    await expect.element(field("name")).toBeInTheDocument();
    await userEvent.fill(page.getByRole("textbox", { name: "Name", exact: true }), "  ");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => errorOf(field("name").query())).toBe("Enter a name.");
    await expect.element(field("name")).toHaveAttribute("aria-invalid", "true");
    await expect.element(field("name")).toHaveFocus();
    expect(device.calls.of("careGroup.updateRecipient")).toEqual([]);
  });

  test("a save sends one updateRecipient, closes the sheet, and the page shows the change", async () => {
    const device = await openProfile();
    await userEvent.click(page.getByRole("link", { name: "Edit profile" }));
    await expect.element(field("name")).toBeInTheDocument();
    await userEvent.fill(page.getByRole("textbox", { name: "Preferred name" }), "Nana June");
    await userEvent.click(page.getByRole("radio", { name: "Full code" }));
    await userEvent.selectOptions(page.getByRole("combobox", { name: "Blood type" }), "A-");
    await userEvent.fill(page.getByRole("textbox", { name: "Primary language" }), "Spanish");
    await userEvent.fill(page.getByRole("textbox", { name: "Pronouns" }), "they/them");
    await userEvent.fill(page.getByRole("textbox", { name: "Note for helpers" }), "Uses a walker indoors.");
    await userEvent.click(page.getByRole("button", { name: "Save" }));

    await expect.poll(device.location).toBe(PROFILE_URL);
    await expect.poll(sheet).toBeNull();
    await device.settle();
    expect(h1()).toBe("Nana June");
    expect(basicsLines()).toMatchObject({
      codeStatus: "Full code",
      primaryLanguage: "Spanish",
      pronouns: "they/them",
    });
    expect(basicsLines().bloodType).toMatch(/^A−/);
    await expect.element(getByCss("main [data-note]")).toHaveTextContent("Uses a walker indoors.");
    expect(device.calls.of("careGroup.updateRecipient")).toEqual([
      {
        groupId: TEST_GROUP.id,
        name: JUNE.name,
        preferredName: "Nana June",
        dateOfBirth: JUNE.dateOfBirth,
        codeStatus: "fullCode",
        bloodType: "A-",
        primaryLanguage: "Spanish",
        pronouns: "they/them",
        notes: "Uses a walker indoors.",
      },
    ]);
  });

  test("a caretaker clearing a basic (from its URL) removes its line, and closing lands on the profile", async () => {
    const device = await openProfile({ role: "caretaker", url: sheetUrl("basics") });
    await expect.element(field("pronouns")).toBeInTheDocument();
    await userEvent.fill(page.getByRole("textbox", { name: "Pronouns" }), "");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(device.location).toBe(PROFILE_URL);
    await expect.element(getByCss("main [data-basic=pronouns]")).not.toBeInTheDocument();
    expect(device.calls.of("careGroup.updateRecipient")).toEqual([
      expect.objectContaining({ pronouns: null, primaryLanguage: "English" }),
    ]);
  });
});

describe("the Contact sheet", () => {
  test("starts from the device's copy; a bad number is refused on its field, focused, with nothing sent", async () => {
    const device = await openProfile({ role: "caretaker" });
    await userEvent.click(page.getByRole("link", { name: "Edit contact" }));
    await expect.poll(device.location).toBe(sheetUrl("contact"));
    await expect.element(page.getByRole("dialog", { name: "Edit contact" })).toBeVisible();
    const numbers = () => [
      ...document.querySelectorAll<HTMLInputElement>('[role=dialog] [name="phoneNumber"]'),
    ];
    expect(numbers().map((n) => n.value)).toEqual(["(555) 010-7100"]);
    // The recipient's labels stay free text (only a provider's are a select).
    expect(document.querySelector('[role=dialog] [name="phoneLabel"]')?.tagName).toBe("INPUT");
    expect(document.querySelector("[role=dialog] [data-phone-label]")).toBeNull();
    await expect.element(field("email")).toHaveValue(DETAILS.email);
    await expect.element(field("address")).toHaveValue(DETAILS.address);

    await userEvent.click(page.getByRole("button", { name: /Add a phone number/ }));
    await expect.poll(() => numbers().length).toBe(2);
    await userEvent.fill(field("phoneLabel").nth(1), "Mobile");
    await userEvent.fill(field("phoneNumber").nth(1), "call her");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => errorOf(field("phoneNumber").nth(1).query())).toMatch(/^Use digits/);
    await expect.element(field("phoneNumber").nth(1)).toHaveFocus();
    expect(device.calls.of("careGroup.updateRecipientDetails")).toEqual([]);
  });

  test("a save of phones, email and address is one call; the sheet closes and the card shows them", async () => {
    const device = await openProfile({ role: "caretaker" });
    await userEvent.click(page.getByRole("link", { name: "Edit contact" }));
    await expect.element(field("email")).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: /Add a phone number/ }));
    await userEvent.fill(field("phoneLabel").nth(1), "Mobile");
    await userEvent.fill(field("phoneNumber").nth(1), "(555) 010-7199");
    await userEvent.fill(field("email"), "june.m@example.com");
    await userEvent.fill(field("address"), "9 Oak Lane\nSpringfield, OR 97477");
    await userEvent.click(page.getByRole("button", { name: "Save" }));

    await expect.poll(device.location).toBe(PROFILE_URL);
    await expect.poll(sheet).toBeNull();
    await device.settle();
    expect(contactLinks()).toEqual(
      expect.arrayContaining([
        "call=tel:5550107199",
        "text=sms:5550107199",
        "email=mailto:june.m@example.com",
      ]),
    );
    await expect
      .element(getByCss("main [data-recipient-contact]"))
      .toMatchTextContent(/9 Oak Lane, Springfield, OR 97477/);
    expect(device.calls.of("careGroup.updateRecipientDetails")).toEqual([
      {
        groupId: TEST_GROUP.id,
        phones: [
          { label: "Home", number: "(555) 010-7100" },
          { label: "Mobile", number: "(555) 010-7199" },
        ],
        email: "june.m@example.com",
        address: "9 Oak Lane\nSpringfield, OR 97477",
      },
    ]);
  });
});

describe("the Insurance sheet", () => {
  const rows = () => [...document.querySelectorAll<HTMLElement>("[role=dialog] li[data-plan-row]")];
  const inRow = (i: number, name: string) =>
    getByCss("[role=dialog] li[data-plan-row]").nth(i).getByCss(`[name$=".${name}"]`);

  test("starts from the device's plans, primary first, every field labelled", async () => {
    const device = await openProfile({ role: "caretaker" });
    await userEvent.click(page.getByRole("link", { name: "Edit insurance" }));
    await expect.poll(device.location).toBe(sheetUrl("insurance"));
    await expect.poll(() => rows().length).toBe(2);
    expect(rows().map((r) => r.querySelector<HTMLInputElement>('[name$=".insurer"]')?.value)).toEqual([
      "Medicare",
      "Example Mutual Health",
    ]);
    expect(rows().map((r) => r.querySelector<HTMLInputElement>('[name$=".rank"]:checked')?.value)).toEqual([
      "primary",
      "secondary",
    ]);
    expect(rows()[0]?.querySelector("legend")?.textContent?.trim()).toBe("Plan 1");
    const unlabelled = [
      ...document.querySelectorAll<HTMLInputElement>(
        "[role=dialog] input:not([type=radio]):not([type=hidden])",
      ),
    ].filter((el) => !document.querySelector(`label[for="${el.id}"]`));
    expect(unlabelled).toEqual([]);
  });

  test("a plan removed and one added (as secondary); without a member ID it's refused on that field; then one save", async () => {
    const device = await openProfile({ role: "caretaker", url: sheetUrl("insurance") });
    await expect.poll(() => rows().length).toBe(2);
    await userEvent.click(page.getByRole("button", { name: "Remove plan 2" }));
    await expect.poll(() => rows().length).toBe(1);
    await userEvent.click(page.getByRole("button", { name: "Add a plan" }));
    await expect.poll(() => rows().length).toBe(2);
    expect(rows()[1]?.querySelector<HTMLInputElement>('[name$=".rank"]:checked')?.value).toBe("secondary");
    await userEvent.fill(inRow(0, "memberId"), "MC-200300");
    await userEvent.fill(inRow(1, "insurer"), "Lakeside Health Plan");
    await userEvent.fill(inRow(1, "groupNumber"), "GRP-1");
    await userEvent.fill(inRow(1, "phone"), "(555) 010-7399");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => errorOf(inRow(1, "memberId").query())).toBe("Enter the member ID");
    await expect.element(inRow(1, "memberId")).toHaveFocus();
    expect(device.calls.of("careGroup.updateRecipientDetails")).toEqual([]);

    await userEvent.fill(inRow(1, "memberId"), "LHP-0042");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(device.location).toBe(PROFILE_URL);
    await expect.poll(sheet).toBeNull();
    await device.settle();
    const shown = plans();
    expect(shown.map((p) => [p.rank, p.memberId])).toEqual([
      ["primary", "MC-200300"],
      ["secondary", "LHP-0042"],
    ]);
    expect(shown[1]).toMatchObject({ group: "GRP-1", call: "tel:5550107399" });
    expect(shown[1]?.title).toMatch(/Lakeside Health Plan$/);
    const sent = device.calls.of("careGroup.updateRecipientDetails") as { insurance: unknown[] }[];
    expect(sent).toHaveLength(1);
    expect(sent[0]?.insurance).toEqual([
      expect.objectContaining({ insurer: "Medicare", memberId: "MC-200300", rank: "primary" }),
      expect.objectContaining({ insurer: "Lakeside Health Plan", memberId: "LHP-0042", rank: "secondary" }),
    ]);
  });
});
