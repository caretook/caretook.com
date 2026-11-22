import type { Route } from "./+types/route";
import type { DeviceRoute } from "../../../../../test/device";

import { useLayoutEffect } from "react";
import { useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { SyncDb } from "~/lib/sync";
import { providersQuery, toProviders } from "~/lib/providers/providers.sync";
import { readRows } from "~/lib/timeline/timeline.sync";
import { found, waitUntil } from "../../../../../test/found";
import { getByCss } from "../../../../../test/locators";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, TEST_USER } from "../../../../../test/fixtures";
import {
  ALVAREZ,
  contactLinks,
  CORNERSTONE,
  directory,
  entryUrl,
  FORM,
  formButton,
  LINDQVIST,
  NOTES,
  PATEL,
  pageHeader,
  PICKUP,
  PICKUP_2,
  PICKUP_LINKS,
  PROVIDER_ROUTES,
  providerUrl,
  SECOND_GROUP,
  secondGroup,
  SHEET,
  WESTSIDE,
} from "../providers/providerWorld";
import * as providerRoute from "./route";

// A provider's page on the test device (providers.mjs's page steps): the
// header's badges and details, every contact action, the shared notes
// (writable for writers, read-only for viewers), a clinician's practice as
// a link, Edit opening the directory's sheet and Cancel coming back, the
// notes' document made on the first keystroke, who else is writing (as
// another device's edits arrive by sync), the linked entries newest first,
// and the 404s (deleted, another group's, a non-member). Two browsers
// typing into one document and merging offline edits is live-notes.mjs's.

/** Back (history −1), as the browser's button does: proves Cancel went back, not forward. */
let back: () => Promise<void> | void = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => navigate(-1);
  }, [navigate]);
  return null;
}
function ProviderWithBack(props: Route.ComponentProps) {
  const Provider = providerRoute.default;
  return (
    <>
      <BackProbe />
      <Provider {...props} />
    </>
  );
}
const ROUTES: DeviceRoute[] = PROVIDER_ROUTES.map((r) =>
  r.module === providerRoute ? { ...r, module: { ...providerRoute, default: ProviderWithBack } } : r,
);

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });

const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: ROUTES, url, fixtures: [directory(), SAM, secondGroup()], ...options });

const notFound = () => page.getByRole("heading", { level: 1, name: "Not found" });
const mainText = () => document.querySelector<HTMLElement>("main")?.innerText ?? "";

describe("the page", () => {
  test("a practice: its Primary badge, type and specialty, every contact action (each number with its label, the address in maps, the website), and its notes, writable", async () => {
    await open(providerUrl(WESTSIDE.id), { role: "caretaker" });
    await waitUntil(() => !!NOTES()?.textContent?.includes("level 2"), "the notes");
    expect(pageHeader()).toMatchObject({
      h1: "Westside Family Medicine",
      badges: ["Primary"],
      details: "Practice · Primary care",
      practice: null,
    });
    expect(contactLinks()).toEqual([
      ["call", "tel:5550102200"],
      ["call", "tel:5550102201"],
      ["call", "tel:5550102210"],
      [
        "map",
        "https://www.google.com/maps/search/?api=1&query=1200%20Westside%20Ave%2C%20Suite%20300%2C%20Springfield%2C%20CA%2090000",
      ],
      ["website", "https://westsidefamily.example/"],
    ]);
    const names = [...document.querySelectorAll<HTMLElement>("main [data-contact-list] a")].map((a) =>
      a.textContent.trim(),
    );
    expect(names[0]).toContain("Call Westside Family Medicine, front desk");
    expect(names[1]).toContain("Fax");
    await expect.poll(() => NOTES()?.getAttribute("contenteditable")).toBe("true");
    expect(
      document.querySelector<HTMLElement>('main [role=toolbar][aria-label="Formatting"]'),
    ).not.toBeNull();
    expect(document.querySelector<HTMLElement>("main header a[data-edit-provider]")).not.toBeNull();
  });

  test("a clinician: both numbers and the email, her practice as a link that opens its page", async () => {
    const device = await open(providerUrl(ALVAREZ.id));
    await waitUntil(
      () => !!document.querySelector<HTMLElement>("main header a[data-practice]"),
      "the practice link",
    );
    const header = pageHeader();
    expect(header.details).toMatch(/^Clinician · Internal medicine · Westside Family Medicine/);
    expect(header.practice).toBe(providerUrl(WESTSIDE.id));
    expect(contactLinks()).toEqual([
      ["call", "tel:5550102200,214"],
      ["call", "tel:5550102299"],
      ["email", "mailto:e.alvarez@westsidefamily.example"],
    ]);
    await expect.poll(() => NOTES()?.textContent).toContain("through the portal");

    await userEvent.click(getByCss("main header a[data-practice]"));
    await expect.poll(() => device.location()).toBe(providerUrl(WESTSIDE.id));
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Westside Family Medicine" }))
      .toBeVisible();
  });

  test("Edit opens the directory's sheet, filled in; Cancel goes back to the page", async () => {
    const device = await open(providerUrl(WESTSIDE.id));
    await userEvent.click(getByCss("main header a[data-edit-provider]"));
    await waitUntil(() => !!FORM(), "the edit sheet");
    expect(device.location()).toBe(`${providerUrl(WESTSIDE.id)}/edit`);
    await expect
      .poll(() => FORM()?.querySelector<HTMLInputElement>('[name="name"]')?.value)
      .toBe("Westside Family Medicine");
    await userEvent.click(await found(() => formButton("Cancel")));
    await expect.poll(() => !SHEET() && device.location()).toBe(providerUrl(WESTSIDE.id));
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Westside Family Medicine" }))
      .toBeVisible();
    // Cancel went back: the page before it is the start.
    // The navigation's promise settles once it's done (at once when there's nothing to go back to).
    await back();
    await device.settle();
    expect(device.location()).toBe(providerUrl(WESTSIDE.id));
  });

  test("the linked entries, newest first; a tap opens the entry", async () => {
    const device = await open(providerUrl(CORNERSTONE.id));
    const links = () =>
      [...document.querySelectorAll<HTMLAnchorElement>("main [data-linked-entries] a[data-entry-id]")].map(
        (a) => a.dataset.entryId,
      );
    await waitUntil(() => links().length === 2, "the linked entries");
    expect(links()).toEqual([PICKUP.id, PICKUP_2.id]);
    await userEvent.click(getByCss(`main [data-linked-entries] a[data-entry-id="${PICKUP.id}"]`));
    await expect.poll(() => device.location()).toBe(entryUrl(PICKUP.id));
  });

  test("with no links: says how to link one", async () => {
    await open(providerUrl(ALVAREZ.id));
    expect(document.querySelector<HTMLElement>("main [data-linked-entries]")?.textContent).toContain(
      "Link this provider from a note or event",
    );
  });
});

describe("the notes", () => {
  test("a provider with no notes opens an empty editor and no document; the first keystroke makes the provider's document (subject provider), queued to upload", async () => {
    const LANG = fx.provider({ name: "Dr. Ivo Lang", specialty: "Neurology" });
    const device = await open(providerUrl(LANG.id), { fixtures: [directory(), LANG] });
    await waitUntil(() => !!NOTES(), "the editor");
    await expect.poll(() => NOTES()?.textContent).toBe("");
    expect(await device.query("SELECT id FROM note_document WHERE id = ?", [LANG.id])).toEqual([]);

    await userEvent.click(await found(NOTES));
    await userEvent.keyboard("Park on level 3");
    await expect
      .poll(() =>
        device.query<{ subject: string; provider_id: string; entry_id: string | null }>(
          "SELECT subject, provider_id, entry_id FROM note_document WHERE id = ?",
          [LANG.id],
        ),
      )
      .toEqual([{ subject: "provider", provider_id: LANG.id, entry_id: null }]);
    await expect
      .poll(async () => (await device.queued()).map((w) => w.type))
      .toEqual(expect.arrayContaining(["note_document", "note_update"]));
  });

  test("others writing (synced from their devices) show as avatars, never yourself", async () => {
    const device = await open(providerUrl(WESTSIDE.id));
    const avatars = () =>
      [...document.querySelectorAll<HTMLElement>('main header [data-region="editors"] [data-person]')].map(
        (el) => el.dataset.person,
      );
    await waitUntil(() => !!NOTES()?.textContent?.includes("level 2"));
    expect(avatars()).toEqual([]);
    await device.sync(
      fx.document({
        ownerId: WESTSIDE.id,
        subject: "provider",
        text: "Park on level 2 of the garage; ask for Rosa at the front desk.",
        editors: JSON.stringify({ [SAM.id]: at(), [TEST_USER.id]: at() }),
      }),
    );
    await device.settle();
    expect(avatars()).toEqual([SAM.id]);
  });

  test("a viewer reads them, read-only: not editable, no toolbar, and no Edit", async () => {
    await open(providerUrl(WESTSIDE.id), { role: "viewer" });
    await waitUntil(() => !!NOTES()?.textContent?.includes("level 2"));
    await expect.poll(() => NOTES()?.getAttribute("contenteditable")).toBe("false");
    await expect.poll(() => NOTES()?.getAttribute("aria-readonly")).toBe("true");
    expect(document.querySelector<HTMLElement>('main [role=toolbar][aria-label="Formatting"]')).toBeNull();
    expect(document.querySelector<HTMLElement>("main header a[data-edit-provider]")).toBeNull();
    expect(mainText()).toContain("You can view these notes.");
  });
});

describe("mentions in the notes", () => {
  const mentionChips = () =>
    [...document.querySelectorAll<HTMLElement>(".ProseMirror [data-mention]")].map((m) => ({
      id: m.dataset.mention!,
      text: m.textContent.trim(),
      href: m.querySelector("a")?.getAttribute("href") ?? null,
    }));
  const shown = () =>
    [...document.querySelectorAll<HTMLElement>('[data-mention-popup] [role="option"]')].map(
      (o) => o.firstElementChild!.textContent,
    );
  const typeInNotes = async (text: string) => {
    await waitUntil(() => !!NOTES()?.textContent?.includes("level 2"), "the notes");
    await userEvent.click(await found(NOTES));
    await waitUntil(() => document.activeElement === NOTES(), "the editor focused");
    await userEvent.keyboard(text);
  };
  const entryLinks = async (device: Awaited<ReturnType<typeof open>>) => ({
    rows: (await device.query("SELECT id FROM timeline_entry_provider")).length,
    queued: (await device.queued()).filter((w) => w.type === "timeline_entry_provider"),
  });

  test("@ picks a provider: a chip linking to their page, and no entry link", async () => {
    const device = await open(providerUrl(WESTSIDE.id), { fixtures: [directory(), SAM] });
    await typeInNotes(" Ask @alva");
    await waitUntil(() => shown().length === 2, "the match and the add row");
    expect(shown()).toEqual(["Dr. Elena Alvarez", 'Add "alva" as a provider']);
    await userEvent.keyboard("{Enter}");
    await waitUntil(() => mentionChips().length === 1, "the chip");
    expect(mentionChips()).toEqual([
      { id: ALVAREZ.id, text: "Dr. Elena Alvarez", href: providerUrl(ALVAREZ.id) },
    ]);
    await expect
      .poll(async () => (await device.queued()).map((w) => w.type))
      .toEqual(expect.arrayContaining(["note_update"]));
    expect(await entryLinks(device)).toEqual({ rows: PICKUP_LINKS.length, queued: [] });
  });

  test("the add row adds a clinician in this group and mentions it, linking nothing", async () => {
    const device = await open(providerUrl(WESTSIDE.id), { fixtures: [directory(), SAM] });
    await typeInNotes(" Front desk: @Rosa Lind");
    await waitUntil(() => shown().includes('Add "Rosa Lind" as a provider'), "the add row");
    expect(shown()).toEqual(['Add "Rosa Lind" as a provider']);
    await userEvent.keyboard("{Enter}");
    await waitUntil(() => mentionChips().length === 1, "the chip");
    const [made] = await device.query<{ id: string; type: string; group_id: string }>(
      "SELECT id, type, group_id FROM provider WHERE name = ?",
      ["Rosa Lind"],
    );
    expect(made).toMatchObject({ type: "clinician", group_id: WESTSIDE.row.group_id });
    await expect
      .poll(mentionChips)
      .toEqual([{ id: made!.id, text: "Rosa Lind", href: providerUrl(made!.id) }]);
    expect((await device.queued()).some((w) => w.type === "provider" && w.id === made!.id)).toBe(true);
    expect(await entryLinks(device)).toEqual({ rows: PICKUP_LINKS.length, queued: [] });
  });
});

describe("Copy to another group", () => {
  const COPY = () => document.querySelector<HTMLButtonElement>("main header [data-copy-provider]");
  const STATUS = () =>
    document.querySelector<HTMLElement>("main [data-copy-status]")?.textContent?.trim() ?? "";
  const DIALOG = () => document.querySelector<HTMLDialogElement>("dialog.modal[open]");
  const dialogButton = (name: string) =>
    [...(DIALOG()?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === name);
  const secondNames = async (db: SyncDb) =>
    toProviders(await readRows(db, providersQuery(SECOND_GROUP.id)))
      .map((p) => p.name)
      .sort();

  test("a writer who writes in another group sees it; the dialog names the rule and the group, and copying adds the provider there, with its practice", async () => {
    const device = await open(providerUrl(ALVAREZ.id), { role: "caretaker" });
    await waitUntil(() => !!COPY(), "the Copy action");
    await userEvent.click(await found(COPY));
    await waitUntil(() => !!DIALOG(), "the dialog");
    await expect.poll(() => DIALOG()?.textContent).toContain("Copy Dr. Elena Alvarez");
    await expect.poll(() => DIALOG()?.textContent).toContain("Provider notes stay in Grandma June.");
    // One target: it's named and chosen.
    expect(page.getByRole("radio", { name: "Lou Lindqvist" })).toBeTruthy();
    await userEvent.click(await found(() => dialogButton("Copy")));
    await expect.poll(STATUS).toBe("Copied to Lou Lindqvist.");
    await expect.poll(DIALOG).toBeNull();
    await device.settle();
    expect(await secondNames(device.db)).toEqual([
      "Dr. Elena Alvarez",
      "Dr. Grace Lindqvist",
      "Westside Family Medicine",
    ]);
  });

  test("a provider already in the other group says so and copies nothing", async () => {
    const SAME = fx.provider({ groupId: SECOND_GROUP.id, name: "dr. samuel  patel" });
    const device = await open(providerUrl(PATEL.id), {
      role: "caretaker",
      fixtures: [directory(), SAM, secondGroup(), SAME],
    });
    await waitUntil(() => !!COPY(), "the Copy action");
    await userEvent.click(await found(COPY));
    await waitUntil(() => !!DIALOG(), "the dialog");
    await userEvent.click(await found(() => dialogButton("Copy")));
    await expect.poll(STATUS).toBe("Already in Lou Lindqvist. Nothing was copied.");
    await device.settle();
    expect(await secondNames(device.db)).toEqual(["dr. samuel  patel", "Dr. Grace Lindqvist"].sort());
  });

  test("Cancel copies nothing", async () => {
    const device = await open(providerUrl(PATEL.id), { role: "caretaker" });
    await waitUntil(() => !!COPY(), "the Copy action");
    await userEvent.click(await found(COPY));
    await waitUntil(() => !!DIALOG(), "the dialog");
    await userEvent.click(await found(() => dialogButton("Cancel")));
    await waitUntil(() => !DIALOG(), "the dialog closing");
    expect(STATUS()).toBe("");
    expect(await secondNames(device.db)).toEqual(["Dr. Grace Lindqvist"]);
  });

  test("hidden for a viewer here, with no other group, and when every other group is a viewer role", async () => {
    let device = await open(providerUrl(PATEL.id), { role: "viewer" });
    await waitUntil(() => !!NOTES(), "the page");
    expect(COPY()).toBeNull();
    await device.screen.unmount();

    device = await open(providerUrl(PATEL.id), { role: "caretaker", fixtures: [directory(), SAM] });
    await waitUntil(() => !!NOTES(), "the page");
    await device.settle();
    expect(COPY()).toBeNull();
    await device.screen.unmount();

    device = await open(providerUrl(PATEL.id), {
      role: "caretaker",
      fixtures: [directory(), SAM, secondGroup("viewer")],
    });
    await waitUntil(() => !!NOTES(), "the page");
    await device.settle();
    expect(COPY()).toBeNull();
  });
});

describe("Not found", () => {
  test("a deleted provider's URL is the 404, naming no one", async () => {
    const GONE = fx.provider({ name: "Dr. Gone Away", deletedAt: at() });
    await open(providerUrl(GONE.id), { fixtures: [directory(), GONE] });
    await expect.element(notFound()).toBeVisible();
    expect(mainText()).not.toContain("Gone Away");
  });

  test("another group's provider under this group's URL is the 404 with no names; under its own group it opens", async () => {
    const device = await open(providerUrl(LINDQVIST.id));
    await expect.element(notFound()).toBeVisible();
    expect(/Lindqvist|Audiology/.test(mainText())).toBe(false);
    await device.screen.unmount();

    await open(providerUrl(LINDQVIST.id, SECOND_GROUP.id));
    await expect.element(page.getByRole("heading", { level: 1, name: "Dr. Grace Lindqvist" })).toBeVisible();
  });

  test("a non-member's provider URL is the 404, with no names or notes", async () => {
    await open(providerUrl(WESTSIDE.id), { role: null, fixtures: [directory()] });
    await expect.element(notFound()).toBeVisible();
    expect(/Moreno|Westside|level 2/.test(mainText())).toBe(false);
  });
});
