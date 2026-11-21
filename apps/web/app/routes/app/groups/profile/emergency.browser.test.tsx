import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as settingsLayout from "~/routes/app/groups/settings/layout/route";
import * as members from "~/routes/app/groups/settings/members/route";
import { TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import { $, emergencyNames, NORA_ID, openProfile, RITA, rowsFor, SAM, sheetUrl } from "./profileWorld";

// The emergency list (profiles.mjs's slice 5 steps): the card for each role,
// the owner's sheet (members who share a phone, outside contacts, moves by
// keyboard, the primary contact, one save of three calls), a member who
// stopped sharing their phone, and the Members page's badges. The order
// rules are unit-tested (lib/profiles/emergencyList.test.ts); what the server
// enforces, including dropping a member who stops sharing a phone, is in
// packages/data/src/services/profiles.int.test.ts and
// packages/api/src/profiles.int.test.ts.

const ME = TEST_USER.name;
const SEEDED = [`${ME}*`, SAM.name, "Nora Example"];

const card = () => $("main [data-section=emergency]");
const form = () => $("[role=dialog] [data-emergency-form]");
const status = () => form()?.querySelector("[data-emergency-status]")?.textContent?.trim() ?? "";
const draft = () =>
  [...(form()?.querySelectorAll<HTMLElement>("li[data-draft-entry]") ?? [])].map((li) =>
    li.dataset.kind === "member"
      ? li.querySelector("p")?.textContent?.trim()
      : li.querySelector("legend")?.textContent?.trim(),
  );
const button = (label: string) => form()!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const focusedName = () =>
  document.activeElement?.getAttribute("aria-label") ??
  (document.activeElement as HTMLElement | null)?.dataset.outsideField ??
  "";

describe("the card", () => {
  test("an owner: the list in order, the primary contact marked, a call each, Edit, and no note", async () => {
    await openProfile();
    await expect.poll(emergencyNames).toEqual(SEEDED);
    const calls = [...card()!.querySelectorAll("li[data-emergency-entry]")].map(
      (li) => li.querySelector('a[data-action="call"]')?.getAttribute("href") ?? null,
    );
    expect(calls).toEqual(["tel:5550107001", "tel:5550107002", "tel:5550107044"]);
    await expect
      .poll(() => card()?.querySelector('[data-badge="primary"]')?.textContent?.trim())
      .toBe("Primary contact");
    await expect
      .poll(() => card()?.querySelector('a[data-edit-sheet="emergency"]')?.getAttribute("href"))
      .toBe(sheetUrl("emergency"));
    await expect.poll(() => card()?.querySelector("[data-emergency-dropped]")).toBeNull();
  });

  test("a caretaker: the list in order, with no Edit", async () => {
    await openProfile({ role: "caretaker" });
    await expect.poll(emergencyNames).toEqual(SEEDED);
    await expect.poll(() => card()?.querySelector("[data-edit-sheet]")).toBeNull();
  });

  test.each(["owner", "caretaker"] as const)(
    "a member who stopped sharing their phone leaves the list (%s); only managers get a note saying why",
    async (role) => {
      const device = await openProfile({ role });
      await expect.poll(emergencyNames).toEqual(SEEDED);
      // What the server's sharing change syncs down: Sam's share and place gone, the list renumbered.
      const sam = device.server.members.find((m) => m.userId === SAM.id)!;
      Object.assign(sam, { phone: null, rank: null, droppedAt: "2026-11-20 08:00:00" });
      device.server.details.outsideContacts[0]!.emergencyRank = 2;
      await device.unsync([{ table: "member_contact_share", id: sam.membershipId }]);
      await device.sync(rowsFor(device.server, role));
      await device.settle();
      expect(emergencyNames()).toEqual([`${ME}*`, "Nora Example"]);
      const notes = [...card()!.querySelectorAll("[data-emergency-dropped]")].map((n) =>
        n.textContent?.trim(),
      );
      expect(notes).toEqual(
        role === "owner"
          ? [`${SAM.name} stopped sharing a phone number with the group, so they're no longer on the list.`]
          : [],
      );
    },
  );
});

describe("the owner's sheet", () => {
  test("lists everyone sharing a phone in order, and names the member without one instead of offering them", async () => {
    const device = await openProfile();
    await userEvent.click(page.getByRole("link", { name: "Edit emergency contacts" }));
    await expect.poll(device.location).toBe(sheetUrl("emergency"));
    await expect.poll(draft).toEqual([ME, SAM.name, "Nora Example"]);
    await expect.poll(() => form()?.querySelector("[data-add-member]")).toBeNull();
    await expect
      .poll(() => form()?.querySelector("[data-without-phone]")?.textContent?.trim())
      .toBe(`${RITA.name} doesn't share a phone number with the group, so they can't be added.`);
  });

  test("builds the list: a member removed and added back, moved up by keyboard, an outside contact refused then added, a new primary; one save", async () => {
    const device = await openProfile({ url: sheetUrl("emergency") });
    await expect.poll(draft).toEqual([ME, SAM.name, "Nora Example"]);

    // Remove Sam, then add them back from the menu: both announced.
    await userEvent.click(button(`Remove ${SAM.name} from the list`));
    await expect.poll(status).toBe(`${SAM.name} removed from the list.`);
    const offered = [...form()!.querySelectorAll("[data-add-member-choice] option")].map(
      (o) => o.textContent,
    );
    expect(offered).toEqual([SAM.name]);
    await userEvent.click(form()!.querySelector<HTMLButtonElement>("[data-add-member]")!);
    await expect.poll(status).toBe(`${SAM.name} added, 3 of 3.`);
    expect(draft()).toEqual([ME, "Nora Example", SAM.name]);

    // Move up by keyboard, twice: announced, focus kept; at the top it moves to Move down.
    button(`Move ${SAM.name} up`).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe(`${SAM.name} moved to 2 of 3.`);
    expect(draft()).toEqual([ME, SAM.name, "Nora Example"]);
    expect(focusedName()).toBe(`Move ${SAM.name} up`);
    await userEvent.keyboard("{Enter}");
    await expect.poll(status).toBe(`${SAM.name} moved to 1 of 3.`);
    expect(draft()).toEqual([SAM.name, ME, "Nora Example"]);
    await expect.poll(focusedName).toBe(`Move ${SAM.name} down`);
    expect(button(`Move ${SAM.name} up`).disabled).toBe(true);

    // An outside contact: focus on its name; with no phone it's refused on that field, nothing sent.
    await userEvent.click(form()!.querySelector<HTMLButtonElement>("[data-add-outside]")!);
    await expect.poll(focusedName).toBe("name");
    const row = () => form()!.querySelector("li[data-draft-entry]:last-child")!;
    const outside = (f: string) => row().querySelector<HTMLInputElement>(`[data-outside-field="${f}"]`)!;
    await userEvent.fill(outside("name"), "Theo Example");
    await userEvent.fill(outside("relationship"), "Across the street");
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(() => outside("phone").getAttribute("aria-invalid")).toBe("true");
    expect(focusedName()).toBe("phone");
    expect(device.calls.calls).toEqual([]);
    await userEvent.fill(outside("phone"), "(555) 010-7099");

    // Sam as the primary contact, then one save: three calls in order.
    await userEvent.click(page.getByRole("radio", { name: SAM.name }));
    await userEvent.click(page.getByRole("button", { name: "Save" }));
    await expect.poll(device.location).toBe(`/app/groups/${TEST_GROUP.id}/profile`);
    await expect.poll(() => $("[role=dialog]")).toBeNull();
    await device.settle();
    expect(emergencyNames()).toEqual([`${SAM.name}*`, ME, "Nora Example", "Theo Example"]);
    expect(
      card()!
        .querySelectorAll("li[data-emergency-entry]")[3]!
        .querySelector('a[data-action="call"]')
        ?.getAttribute("href"),
    ).toBe("tel:5550107099");
    expect(device.calls.calls.map((c) => c.path)).toEqual([
      "careGroup.updateOutsideContacts",
      "careGroup.setEmergencyContacts",
      "careGroup.setPrimaryContact",
    ]);
    const [order] = device.calls.of("careGroup.setEmergencyContacts") as { contacts: unknown[] }[];
    expect(order!.contacts.slice(0, 3)).toEqual([
      { kind: "member", userId: SAM.id },
      { kind: "member", userId: TEST_USER.id },
      { kind: "outside", id: NORA_ID },
    ]);
    expect(device.calls.of("careGroup.setPrimaryContact")).toEqual([
      { groupId: TEST_GROUP.id, userId: SAM.id },
    ]);
  });
});

describe("the Members page", () => {
  test("a viewer sees the primary and emergency contacts badged", async () => {
    const base = "/app/groups/:groupId/settings";
    await openProfile({
      role: "viewer",
      url: `/app/groups/${TEST_GROUP.id}/settings/members`,
      routes: [
        { path: base, module: settingsLayout, children: [{ path: `${base}/members`, module: members }] },
      ],
    });
    const badges = (userId: string) =>
      [...document.querySelectorAll(`main li[data-member="${userId}"] [data-badge]`)]
        .map((b) => b.textContent?.trim())
        .join("+");
    await expect.poll(() => badges(TEST_USER.id)).toBe("Primary contact+Emergency contact");
    expect(badges(SAM.id)).toBe("Emergency contact");
    expect(badges(RITA.id)).toBe("");
  });
});
