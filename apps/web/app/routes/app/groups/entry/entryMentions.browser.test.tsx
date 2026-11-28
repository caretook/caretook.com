import { entryProviderId } from "@caretook/data/schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import * as Y from "yjs";
import { renderWithDevice } from "../../../../../test/device";
import { fx, hoursAgo } from "../../../../../test/fixtures";
import {
  ALVAREZ,
  chips,
  CURRENT_NAMES,
  directory,
  entryUrl,
  GROUP,
  NOTES,
  PATEL,
  PROVIDER_ROUTES,
  LINDQVIST,
  secondGroup,
  providerUrl,
  WESTSIDE,
} from "../providers/providerWorld";
import { found, waitUntil } from "../../../../../test/found";
import { encodeNoteDoc, MENTION_NODE, NOTE_FRAGMENT } from "@caretook/data/domain";

// Mentions on the entry page, on the test device: typing `@` opens a popup
// of the group's providers that narrows as you type; arrows and Enter (or a
// tap) put a chip in the text, which links the provider to the entry as
// the With row does (a draft is saved first). A provider already linked
// stays one link; deleting the mention keeps the link. Writers' last row
// adds the typed name as a clinician and links it. Viewers get chips that
// open the provider's page, and no popup. Chips follow renames, and grey
// once a provider is deleted (or unknown here). The options' matching and
// order are mentionOptions.test.ts's; a mention reaching another device is
// live-notes's.

const NEW_NOTE = `/app/groups/${GROUP}/entries/new?kind=note`;
const VISIT = fx.event({ title: "Heart check", occurredAt: hoursAgo(5) });

const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: PROVIDER_ROUTES, url, fixtures: [directory(), VISIT], ...options });
type Device = Awaited<ReturnType<typeof open>>;

const POPUP = () => document.querySelector<HTMLElement>("[data-mention-popup]");
const rows = () =>
  [...document.querySelectorAll<HTMLElement>('[data-mention-popup] [role="option"]')].map(
    (o) => o.firstElementChild!.textContent,
  );
/** The providers offered (the add row left out). */
const shown = () =>
  [
    ...document.querySelectorAll<HTMLElement>('[data-mention-popup] [role="option"]:not([data-mention-add])'),
  ].map((o) => o.firstElementChild!.textContent);
const highlighted = () =>
  document.querySelector<HTMLElement>('[data-mention-popup] [role="option"][aria-selected="true"]')
    ?.firstElementChild?.textContent ?? null;
const mentionChips = () =>
  [...document.querySelectorAll<HTMLElement>(".ProseMirror [data-mention]")].map((m) => ({
    id: m.dataset.mention!,
    text: m.textContent.trim(),
    href: m.querySelector("a")?.getAttribute("href") ?? null,
  }));
const addRow = () =>
  document.querySelector<HTMLElement>('[data-mention-popup] [role="option"][data-mention-add]');
const linkedIds = async (device: Device, entryId: string) =>
  (
    await device.query<{ provider_id: string }>(
      "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ? ORDER BY provider_id",
      [entryId],
    )
  ).map((r) => r.provider_id);

/** The read `linkProvider` makes last: whether the pair is already linked. */
const IS_LINKED = "SELECT id FROM timeline_entry_provider WHERE id = ?";
/** The read it makes first: the entry to link. */
const LINKABLE = "SELECT id, group_id, kind FROM timeline_entry WHERE id = ? AND deleted_at IS NULL";

/**
 * The device's one-off reads from here on, so a test can wait for a
 * mention's link to finish (a pair already linked writes nothing a live
 * query would show).
 */
const watchReads = (device: Device) => {
  const getAll = vi.spyOn(device.db.powersync, "getAll");
  return {
    /** Resolves once the link has made its last read and that read has answered. */
    linkDone: async () => {
      await waitUntil(() => getAll.mock.calls.some(([sql]) => sql === IS_LINKED), "the link's last read");
      await Promise.allSettled(getAll.mock.results.map((r) => r.value as Promise<unknown>));
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** Put the caret at the end of the text and type. */
const typeInNotes = async (text: string) => {
  await waitUntil(() => !!NOTES(), "the editor");
  await userEvent.click(await found(NOTES));
  await waitUntil(() => document.activeElement === NOTES(), "the editor focused");
  await userEvent.keyboard(text);
};

/** A document holding "Saw " and a mention of `provider` (by the name it was typed with). */
const withMention = (entryId: string, provider: { id: string }, label: string) => {
  const doc = new Y.Doc();
  const p = new Y.XmlElement("paragraph");
  doc.getXmlFragment(NOTE_FRAGMENT).insert(0, [p]);
  const before = new Y.XmlText();
  const mention = new Y.XmlElement(MENTION_NODE);
  p.insert(0, [before, mention]);
  before.insert(0, "Saw ");
  mention.setAttribute("id", provider.id);
  mention.setAttribute("label", label);
  mention.setAttribute("mentionSuggestionChar", "@");
  return fx.document({ ownerId: entryId, text: `Saw @${label}`, snapshot: encodeNoteDoc(doc) });
};

describe("mentions on the entry page", () => {
  test("@ opens the popup with the group's providers in display order; typing narrows it; Escape closes it", async () => {
    await open(entryUrl(VISIT.id));
    await typeInNotes("Called @");
    await waitUntil(() => shown().length > 0, "the popup");
    expect(shown()).toEqual([...CURRENT_NAMES, "Dr. Alan Whitford"]);
    expect(
      document
        .querySelector<HTMLElement>('[data-mention-popup] [role="listbox"]')
        ?.getAttribute("aria-label"),
    ).toBe("Providers to mention");
    expect(highlighted()).toBe("Cornerstone Pharmacy");
    await expect
      .poll(() => NOTES()?.getAttribute("aria-activedescendant"))
      .toBe(
        document.querySelector<HTMLElement>('[data-mention-popup] [role="option"][aria-selected="true"]')!.id,
      );

    await userEvent.keyboard("card");
    await waitUntil(() => shown().length === 1, "the popup narrowed");
    expect(shown()).toEqual(["Dr. Samuel Patel"]);
    await userEvent.keyboard("zz");
    await waitUntil(() => !!POPUP()?.querySelector('[role="status"]'), "no match");
    await expect
      .poll(() => POPUP()?.querySelector('[role="status"]')?.textContent)
      .toBe("No providers match");
    // A writer's only option is then adding the typed name.
    expect(rows()).toEqual(['Add "cardzz" as a provider']);

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !POPUP(), "the popup closed");
    expect(document.activeElement).toBe(NOTES());
    expect(NOTES()?.hasAttribute("aria-activedescendant")).toBe(false);
  });

  test("Enter picks: a chip with the provider's name, linked to the entry; the With row gains it", async () => {
    const device = await open(entryUrl(VISIT.id));
    await typeInNotes("Saw @patel");
    await waitUntil(() => shown().length === 1, "the match");
    await userEvent.keyboard("{Enter}");
    await waitUntil(() => mentionChips().length === 1, "the chip");
    expect(mentionChips()).toEqual([{ id: PATEL.id, text: "Dr. Samuel Patel", href: providerUrl(PATEL.id) }]);
    expect(POPUP()).toBeNull();
    await waitUntil(() => chips().length === 1, "the With chip");
    expect(chips()[0]).toMatchObject({ id: PATEL.id, text: "Dr. Samuel Patel" });
    expect(await linkedIds(device, VISIT.id)).toEqual([PATEL.id]);
    // The text goes on after the chip.
    await userEvent.keyboard("today");
    await expect.poll(() => NOTES()!.textContent).toBe("Saw Dr. Samuel Patel today");
  });

  test("arrows move the highlight (wrapping), and a tap picks too", async () => {
    const device = await open(entryUrl(VISIT.id));
    await typeInNotes("@westside");
    await waitUntil(() => shown().length === 2, "two matches");
    expect(shown()).toEqual(["Dr. Elena Alvarez", "Westside Family Medicine"]);
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toBe("Westside Family Medicine");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toBe('Add "westside" as a provider');
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(highlighted).toBe("Dr. Elena Alvarez");
    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(highlighted).toBe('Add "westside" as a provider');

    const option = [...document.querySelectorAll<HTMLElement>('[data-mention-popup] [role="option"]')].find(
      (o) => o.firstElementChild?.textContent === "Dr. Elena Alvarez",
    )!;
    await userEvent.click(option);
    await waitUntil(() => mentionChips().length === 1, "the chip");
    expect(mentionChips()[0]?.id).toBe(ALVAREZ.id);
    await expect.poll(() => linkedIds(device, VISIT.id)).toEqual([ALVAREZ.id]);
  });

  test("a first-line mention in a new note saves the draft, then links it (the editor stays)", async () => {
    const device = await open(NEW_NOTE);
    await waitUntil(() => !!NOTES(), "the draft");
    const editor = NOTES();
    await typeInNotes("@alv");
    await waitUntil(() => shown().length === 1, "the match");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => device.location()).toMatch(/\/entries\/[0-9a-f-]{36}$/);
    const id = device.location().split("/").at(-1)!;
    await waitUntil(() => chips().length === 1, "the With chip");
    expect(NOTES()).toBe(editor);
    expect(mentionChips().map((m) => m.id)).toEqual([ALVAREZ.id]);
    const [entry] = await device.query<{ kind: string }>("SELECT kind FROM timeline_entry WHERE id = ?", [
      id,
    ]);
    expect(entry?.kind).toBe("note");
    expect(await linkedIds(device, id)).toEqual([ALVAREZ.id]);
  });

  test("mentioning a provider already linked makes no second link (nothing more to upload)", async () => {
    const device = await open(entryUrl(VISIT.id), {
      fixtures: [directory(), VISIT, fx.link(VISIT.id, PATEL.id)],
    });
    await waitUntil(() => chips().length === 1, "the With chip");
    await typeInNotes("@patel");
    await waitUntil(() => shown().length === 1, "the match (linked ones stay in)");
    const reads = watchReads(device);
    await userEvent.keyboard("{Enter}");
    await waitUntil(() => mentionChips().length === 1, "the chip");
    // The link runs on after the pick: wait for it, so it can't outlive the test's database.
    await reads.linkDone();
    await device.settle();
    expect(await linkedIds(device, VISIT.id)).toEqual([PATEL.id]);
    const link = entryProviderId(VISIT.id, PATEL.id);
    expect((await device.queued()).filter((w) => w.id === link)).toEqual([]);
    expect(chips().length).toBe(1);
  });

  test("leaving while the link is in flight: the database closing under it leaves no unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    try {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const device = await open(entryUrl(VISIT.id));
      // Hold the link at its first read until the screen is gone and its database closed (a sign-out mid-link).
      const { powersync } = device.db;
      const getAll = powersync.getAll.bind(powersync);
      let reached = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      vi.spyOn(powersync, "getAll").mockImplementation((async (sql: string, params?: unknown[]) => {
        if (sql === LINKABLE) {
          reached = true;
          await held;
        }
        return getAll(sql, params);
      }) as typeof getAll);

      await typeInNotes("@patel");
      await waitUntil(() => shown().length === 1, "the match");
      await userEvent.keyboard("{Enter}");
      await waitUntil(() => reached, "the link started");
      await device.screen.unmount();
      await powersync.close();
      release();

      const failedLink = () =>
        logged.mock.calls.some(([message]) => message === "Couldn't link the provider");
      await waitUntil(() => failedLink() || unhandled.length > 0, "the link to fail");
      // A rejection left unhandled is reported in a later task: give it a frame.
      await new Promise(requestAnimationFrame);
      expect(unhandled).toEqual([]);
      expect(failedLink()).toBe(true);
    } finally {
      window.removeEventListener("unhandledrejection", onUnhandled);
    }
  });

  test("deleting the mention from the text keeps the link", async () => {
    const device = await open(entryUrl(VISIT.id));
    await typeInNotes("@cardio");
    await waitUntil(() => shown().length === 1, "the match");
    await userEvent.keyboard("{Enter}");
    await waitUntil(() => chips().length === 1, "the With chip");
    // The space after it, then the chip itself (Backspace turns it back into its "@"), then the "@".
    await userEvent.keyboard("{Backspace}{Backspace}");
    await waitUntil(() => mentionChips().length === 0, "the chip gone");
    if (POPUP()) await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Backspace}");
    await expect.poll(() => NOTES()!.textContent).toBe("");
    await device.settle();
    expect(await linkedIds(device, VISIT.id)).toEqual([PATEL.id]);
    expect(chips().map((c) => c.id)).toEqual([PATEL.id]);
  });

  test("a viewer sees mentions as links to the provider's page, with the current name, and gets no popup", async () => {
    const SEEN = fx.event({ title: "Checkup", occurredAt: hoursAgo(4) });
    const device = await open(entryUrl(SEEN.id), {
      role: "viewer",
      fixtures: [directory(), SEEN, withMention(SEEN.id, WESTSIDE, "Westside Clinic")],
    });
    await waitUntil(() => mentionChips().length === 1, "the chip");
    // Typed as "Westside Clinic": the chip shows the provider's name now
    // (once the directory has answered, so poll rather than read once).
    await expect
      .poll(mentionChips)
      .toEqual([{ id: WESTSIDE.id, text: "Westside Family Medicine", href: providerUrl(WESTSIDE.id) }]);
    await expect.poll(() => NOTES()?.getAttribute("contenteditable")).toBe("false");
    await userEvent.click(await found(NOTES));
    await userEvent.keyboard("@");
    await device.settle();
    expect(POPUP()).toBeNull();

    await userEvent.click(
      await found(() => document.querySelector<HTMLElement>(".ProseMirror [data-mention] a")),
    );
    await expect.poll(() => device.location()).toBe(providerUrl(WESTSIDE.id));
  });

  test("the add row: last, for a name nobody has; Enter adds a clinician, links it and puts in its chip", async () => {
    const device = await open(entryUrl(VISIT.id));
    await typeInNotes("Saw @Dr. Sam");
    // Spaces are part of the name; a partial match stays above the add row.
    await waitUntil(() => rows().length === 2, "the match and the add row");
    expect(rows()).toEqual(["Dr. Samuel Patel", 'Add "Dr. Sam" as a provider']);
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}Chen");
    await waitUntil(() => rows().length === 1, "only the add row");
    expect(rows()).toEqual(['Add "Dr. Chen" as a provider']);
    expect(highlighted()).toBe('Add "Dr. Chen" as a provider');
    expect(addRow()).not.toBeNull();
    await userEvent.keyboard("{Enter}");

    await waitUntil(() => mentionChips().length === 1, "the chip");
    const [made] = await device.query<{ id: string; type: string; group_id: string }>(
      "SELECT id, type, group_id FROM provider WHERE name = ?",
      ["Dr. Chen"],
    );
    expect(made).toMatchObject({ type: "clinician", group_id: GROUP });
    await expect
      .poll(mentionChips)
      .toEqual([{ id: made!.id, text: "Dr. Chen", href: providerUrl(made!.id) }]);
    await waitUntil(() => chips().length === 1, "the With chip");
    expect(chips()[0]).toMatchObject({ id: made!.id, text: "Dr. Chen" });
    expect(await linkedIds(device, VISIT.id)).toEqual([made!.id]);
    // One transaction: the provider uploads before its link.
    const queued = (await device.queued()).map((w) => w.type);
    expect(queued.indexOf("provider")).toBeGreaterThanOrEqual(0);
    expect(queued.indexOf("provider")).toBeLessThan(queued.indexOf("timeline_entry_provider"));
    expect(POPUP()).toBeNull();
  });

  test("no add row for a name already in the group (case ignored); the popup closes once the text reads on", async () => {
    await open(entryUrl(VISIT.id));
    await typeInNotes("@maria reyes");
    await waitUntil(() => shown().length === 1, "the match");
    expect(shown()).toEqual(["Maria Reyes"]);
    expect(addRow()).toBeNull();
    // "Mom" matches nobody: two words could be a new name, a third is just text.
    await userEvent.keyboard("{Escape} and @Mom");
    await waitUntil(() => rows().length === 1, "the add row");
    expect(rows()).toEqual(['Add "Mom" as a provider']);
    await userEvent.keyboard(" said");
    await waitUntil(() => rows()[0] === 'Add "Mom said" as a provider', "two words");
    await userEvent.keyboard(" to");
    await waitUntil(() => !POPUP(), "the popup closed");
  });

  test("a renamed provider's chip shows the new name as it syncs in", async () => {
    const device = await open(entryUrl(VISIT.id), {
      fixtures: [directory(), VISIT, withMention(VISIT.id, PATEL, "Dr. Samuel Patel")],
    });
    await waitUntil(() => mentionChips().length === 1, "the chip");
    expect(mentionChips()[0]?.text).toBe("Dr. Samuel Patel");
    await device.sync({ ...PATEL, row: { ...PATEL.row, name: "Dr. Sam Patel-Okoro" } });
    await expect.poll(() => mentionChips()[0]?.text).toBe("Dr. Sam Patel-Okoro");
    expect(mentionChips()[0]?.href).toBe(providerUrl(PATEL.id));
  });

  test("a provider deleted (as it syncs in) greys its chip: the name as text, not a link", async () => {
    const device = await open(entryUrl(VISIT.id), {
      fixtures: [directory(), VISIT, withMention(VISIT.id, PATEL, "Dr. Samuel Patel")],
    });
    await waitUntil(() => mentionChips()[0]?.href === providerUrl(PATEL.id), "the linked chip");
    await device.sync({ ...PATEL, row: { ...PATEL.row, deleted_at: hoursAgo(1) } });
    await expect.poll(() => mentionChips()[0]?.href).toBeNull();
    expect(mentionChips()).toEqual([{ id: PATEL.id, text: "Dr. Samuel Patel", href: null }]);
    expect(document.querySelector<HTMLElement>(".ProseMirror [data-mention] span")?.className).toContain(
      "text-faint",
    );
  });

  test("a provider this device doesn't have: the name it was typed with, greyed, not a link", async () => {
    const STRANGER = { id: "0b6f3c1e-9d2a-4e7b-8c15-3a4d5e6f7a80" };
    await open(entryUrl(VISIT.id), {
      fixtures: [directory(), VISIT, withMention(VISIT.id, STRANGER, "Dr. Nobody Here")],
    });
    await waitUntil(() => mentionChips().length === 1, "the chip");
    expect(mentionChips()).toEqual([{ id: STRANGER.id, text: "Dr. Nobody Here", href: null }]);
  });
});

describe("other groups' providers in the popup", () => {
  const headings = () =>
    [...document.querySelectorAll<HTMLElement>("[data-mention-popup] [data-mention-heading]")].map(
      (h) => h.textContent,
    );
  /** The rows under "From <group>": the group's `role="group"`, named by its heading. */
  const fromRows = () =>
    [...document.querySelectorAll<HTMLElement>('[data-mention-popup] [role="group"]')].map((g) => ({
      name: document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent ?? null,
      rows: [...g.querySelectorAll('[role="option"]')].map((o) => o.firstElementChild?.textContent),
    }));
  const copyOf = async (device: Device) =>
    (
      await device.query<{ id: string }>("SELECT id FROM provider WHERE group_id = ? AND name = ?", [
        GROUP,
        LINDQVIST.row.name,
      ])
    )[0];

  test("on an entry: none until something is typed; then “From Lou Lindqvist” before the add row; Enter copies the provider here, links the copy and puts in its chip", async () => {
    const device = await open(entryUrl(VISIT.id), { fixtures: [directory(), VISIT, secondGroup()] });
    await typeInNotes("Saw @");
    await waitUntil(() => shown().length > 0, "the popup");
    expect(headings()).toEqual([]);

    await userEvent.keyboard("lind");
    await waitUntil(() => headings().length === 1, "the other group's section");
    expect(fromRows()).toEqual([{ name: "From Lou Lindqvist", rows: ["Dr. Grace Lindqvist"] }]);
    expect(rows()).toEqual(["Dr. Grace Lindqvist", 'Add "lind" as a provider']);
    await expect.poll(() => POPUP()?.querySelector('[role="status"]')).toBeNull();
    expect(highlighted()).toBe("Dr. Grace Lindqvist");
    await userEvent.keyboard("{Enter}");

    await waitUntil(() => mentionChips().length === 1, "the chip");
    const copy = await copyOf(device);
    expect(copy && copy.id).not.toBe(LINDQVIST.id);
    await expect
      .poll(mentionChips)
      .toEqual([{ id: copy!.id, text: "Dr. Grace Lindqvist", href: providerUrl(copy!.id) }]);
    await waitUntil(() => chips().length === 1, "the With chip");
    expect(chips()[0]).toMatchObject({ id: copy!.id, text: "Dr. Grace Lindqvist" });
    expect(await linkedIds(device, VISIT.id)).toEqual([copy!.id]);
    expect(POPUP()).toBeNull();
  });

  test("on another document (a provider's notes): the pick copies the provider here and mentions the copy, linking nothing", async () => {
    const device = await open(providerUrl(PATEL.id), { fixtures: [directory(), VISIT, secondGroup()] });
    await typeInNotes("Ask @audio");
    await waitUntil(() => headings().length === 1, "the other group's section");
    await userEvent.click(
      await found(() =>
        [...document.querySelectorAll<HTMLElement>('[data-mention-popup] [role="option"]')].find(
          (o) => o.firstElementChild?.textContent === "Dr. Grace Lindqvist",
        ),
      ),
    );
    await waitUntil(() => mentionChips().length === 1, "the chip");
    const copy = await copyOf(device);
    // The chip links once the page's live list has the copy.
    await expect
      .poll(mentionChips)
      .toEqual([{ id: copy!.id, text: "Dr. Grace Lindqvist", href: providerUrl(copy!.id) }]);
    expect(
      await device.query("SELECT id FROM timeline_entry_provider WHERE provider_id = ?", [copy?.id]),
    ).toEqual([]);
  });
});
