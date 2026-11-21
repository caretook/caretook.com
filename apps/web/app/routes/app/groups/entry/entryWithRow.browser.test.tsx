import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found } from "../../../../../test/found";
import { entryProviderId } from "@caretook/data/schema";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo } from "../../../../../test/fixtures";
import {
  $,
  $$,
  ADD_LINK,
  ALVAREZ,
  chips,
  CORNERSTONE,
  directory,
  ENTRY_TITLE,
  entryUrl,
  GROUP,
  MARIA,
  MERCY,
  NOTES,
  option,
  PATEL,
  pause,
  pick,
  PICKER,
  PROVIDER_ROUTES,
  SECOND_GROUP,
  secondGroup,
  providerUrl,
  suggested,
  suggestion,
  SUGGESTIONS,
  waitUntil,
  WESTSIDE,
  WITH,
} from "../providers/providerWorld";

// The entry page's With row and provider suggestions on the test device
// (providers.mjs's With row and suggestion steps): linking on a draft saves
// it and keeps the editor, chips that open the provider and remove the
// link, the picker (linked ones left out, Escape, a new name added as a
// clinician and linked in one write), the same link from another device
// making one chip, a deleted provider's greyed chip, a viewer's chips, and
// suggestions (a named clinician first, a title used before, recent links;
// one row at 420, wrapping at 1280). The device is offline throughout, so
// it's all the offline With row too. The ranking is
// providerSuggestions.test.ts's and the picker's options withProviders.test.ts's;
// links reaching another device are roundtrip.mjs's sync matrix (6b).

const NEW_NOTE = `/app/groups/${GROUP}/entries/new?kind=note`;
const NEW_EVENT = `/app/groups/${GROUP}/entries/new?kind=event`;
const VISIT = fx.event({ title: "Heart check", occurredAt: hoursAgo(5) });

const open = (url: string, options: Partial<Parameters<typeof renderWithDevice>[0]> = {}) =>
  renderWithDevice({ route: PROVIDER_ROUTES, url, fixtures: [directory(), VISIT], ...options });

type Device = Awaited<ReturnType<typeof open>>;
const linkedIds = async (device: Device, entryId: string) =>
  (
    await device.query<{ provider_id: string }>(
      "SELECT provider_id FROM timeline_entry_provider WHERE entry_id = ? ORDER BY provider_id",
      [entryId],
    )
  ).map((r) => r.provider_id);
const ON_ENTRY = /\/entries\/[0-9a-f-]{36}$/;
const idOf = (path: string) => path.split("/").at(-1)!;

describe("the With row", () => {
  test("on a new note's draft: Add, no chips; linking saves the note and keeps the editor (the same element); focus goes back to Add", async () => {
    const device = await open(NEW_NOTE);
    await waitUntil(() => !!NOTES() && !!ADD_LINK(), 4000, "the draft's With row");
    expect(ADD_LINK()!.textContent.trim()).toBe("Add a provider");
    expect(chips()).toEqual([]);
    const editor = NOTES();

    await pick("patel", "Dr. Samuel Patel");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await waitUntil(() => chips().length === 1, 4000, "the chip");
    expect(NOTES()).toBe(editor);
    expect(
      (await device.query<{ kind: string }>("SELECT kind FROM timeline_entry WHERE id = ?", [id]))[0]?.kind,
    ).toBe("note");
    expect(await linkedIds(device, id)).toEqual([PATEL.id]);
    await expect.poll(() => document.activeElement === ADD_LINK()).toBe(true);
  });

  test("two providers on an event: each chip opens the provider's page and has an ×; removing one deletes its link", async () => {
    const device = await open(entryUrl(VISIT.id));
    await pick("cardio", "Dr. Samuel Patel");
    await waitUntil(() => chips().length === 1);
    await pick("cornerstone", "Cornerstone Pharmacy");
    await waitUntil(() => chips().length === 2, 4000, "two chips");
    expect(await linkedIds(device, VISIT.id)).toEqual([CORNERSTONE.id, PATEL.id].sort());
    for (const chip of chips()) {
      expect(chip.href).toBe(providerUrl(chip.id));
      expect(chip.remove && !chip.muted).toBe(true);
    }
    expect(ADD_LINK()!.textContent.trim()).toBe("Add");

    await userEvent.click(
      await found(() => WITH()?.querySelector('button[aria-label="Remove Cornerstone Pharmacy"]')),
    );
    await waitUntil(() => chips().length === 1, 4000, "one chip left");
    expect(chips()[0]!.text).toBe("Dr. Samuel Patel");
    expect(await linkedIds(device, VISIT.id)).toEqual([PATEL.id]);
    // Linked then unlinked before uploading: the queue holds the PUT and the DELETE, in order.
    const cornerstoneLink = entryProviderId(VISIT.id, CORNERSTONE.id);
    expect((await device.queued()).filter((w) => w.id === cornerstoneLink).map((w) => w.op)).toEqual([
      "PUT",
      "DELETE",
    ]);
  });

  test("the picker leaves out linked providers; Escape closes it, focus back on Add", async () => {
    await open(entryUrl(VISIT.id), { fixtures: [directory(), VISIT, fx.link(VISIT.id, PATEL.id)] });
    await waitUntil(() => chips().length === 1);
    await userEvent.click(await found(ADD_LINK));
    await waitUntil(() => document.activeElement === PICKER(), 4000, "the picker");
    await userEvent.keyboard("patel");
    await pause(300);
    expect(option("Dr. Samuel Patel")).toBeUndefined();
    await userEvent.keyboard("{Escape}");
    if (PICKER()) await userEvent.keyboard("{Escape}");
    await waitUntil(() => !PICKER() && document.activeElement === ADD_LINK(), 4000, "Add focused");
  });

  test("a new name: added as a clinician and linked in one write (the provider queued before its link), staying on the entry", async () => {
    const device = await open(entryUrl(VISIT.id));
    await pick("Dr. Rosa Lin", 'Add "Dr. Rosa Lin" as a provider');
    await waitUntil(() => chips().some((c) => c.text === "Dr. Rosa Lin"), 4000, "the new chip");
    const [made] = await device.query<{ id: string; type: string }>(
      "SELECT id, type FROM provider WHERE name = 'Dr. Rosa Lin'",
    );
    expect(made?.type).toBe("clinician");
    expect(await linkedIds(device, VISIT.id)).toEqual([made!.id]);
    expect(device.location()).toBe(entryUrl(VISIT.id));
    const order = (await device.queued())
      .filter((w) => w.type === "provider" || w.type === "timeline_entry_provider")
      .map((w) => [w.op, w.type, w.id]);
    expect(order).toEqual([
      ["PUT", "provider", made!.id],
      ["PUT", "timeline_entry_provider", entryProviderId(VISIT.id, made!.id)],
    ]);
  });

  test("the same provider linked here and on another device is one link and one chip (its id comes from the pair)", async () => {
    const device = await open(entryUrl(VISIT.id));
    await pick("westside", "Westside Family Medicine");
    await waitUntil(() => chips().length === 1);
    await device.sync(fx.link(VISIT.id, WESTSIDE.id, { createdBy: "another-member" }));
    await device.settle();
    expect(chips().map((c) => c.text)).toEqual(["Westside Family Medicine"]);
    expect(await linkedIds(device, VISIT.id)).toEqual([WESTSIDE.id]);
  });

  test("a provider deleted on another device: its chip is greyed “(removed)” and not a link; the entry is otherwise unchanged", async () => {
    const device = await open(entryUrl(VISIT.id), {
      fixtures: [directory(), VISIT, fx.link(VISIT.id, PATEL.id), fx.link(VISIT.id, MARIA.id)],
    });
    await waitUntil(() => chips().length === 2);
    const title = $("main h1, main header input")?.outerHTML;
    // The same row, deleted (soft) elsewhere.
    await device.sync({ ...MARIA, row: { ...MARIA.row, deleted_at: at() } });
    await device.settle();
    const gone = chips().find((c) => c.id === MARIA.id)!;
    expect(gone).toMatchObject({ text: "Maria Reyes (removed)", href: null, muted: true });
    expect(chips().length).toBe(2);
    expect($("main h1, main header input")?.outerHTML).toBe(title);
    expect(NOTES()).not.toBeNull();
  });

  test("a viewer sees the chips as links, with no Add or ×; with none linked, no With row", async () => {
    const device = await open(entryUrl(VISIT.id), {
      role: "viewer",
      fixtures: [directory(), VISIT, fx.link(VISIT.id, PATEL.id), fx.link(VISIT.id, CORNERSTONE.id)],
    });
    await waitUntil(() => chips().length === 2, 4000, "the chips");
    expect(chips().every((c) => !c.remove && !!c.href)).toBe(true);
    expect(ADD_LINK()).toBeNull();
    await device.screen.unmount();

    const OTHER = fx.event({ title: "Walk", occurredAt: hoursAgo(3) });
    await open(entryUrl(OTHER.id), { role: "viewer", fixtures: [directory(), OTHER] });
    await waitUntil(() => !!NOTES());
    expect(WITH()?.textContent ?? "").toBe("");
  });
});

describe("suggestions", () => {
  /** A new draft of `kind` with `title` typed (not saved). */
  const draft = async (kind: "note" | "event", title: string, options = {}) => {
    const device = await open(kind === "note" ? NEW_NOTE : NEW_EVENT, options);
    await waitUntil(() => !!NOTES() && !!ENTRY_TITLE(), 4000, "the draft");
    if (title) {
      await userEvent.click(await found(ENTRY_TITLE));
      await userEvent.keyboard(title);
    }
    return device;
  };
  const layout = () => {
    const ul = SUGGESTIONS()!.querySelector("ul")!;
    const items = [...ul.children];
    const style = getComputedStyle(ul);
    const chip = items[0]!.getBoundingClientRect().height;
    return {
      chips: items.length,
      rows: new Set(items.map((li) => Math.round(li.getBoundingClientRect().top))).size,
      wrap: style.flexWrap,
      overflowX: style.overflowX,
      fitsOneRow: SUGGESTIONS()!.getBoundingClientRect().height < chip * 1.6,
      clipped: ul.scrollWidth > ul.clientWidth + 1,
    };
  };

  test("a title naming a clinician suggests them first; at 420 the chips stay on one scrolling row, at 1280 every one shows, wrapping (B-72)", async () => {
    // Recent links to five others, so there are more chips than fit a phone's row.
    const CALL = fx.note({ occurredAt: hoursAgo(2), text: "Checked in" });
    const recent = [WESTSIDE, CORNERSTONE, MARIA, ALVAREZ, MERCY].map((p) =>
      fx.link(CALL.id, p.id, { createdAt: hoursAgo(2) }),
    );
    await draft("event", "Dr. Patel follow-up", { fixtures: [directory(), VISIT, CALL, recent] });
    await waitUntil(() => suggested()[0] === "Dr. Samuel Patel", 4000, "Dr. Patel first");
    expect(suggested().length).toBe(5);
    const phone = layout();
    expect(phone).toMatchObject({ rows: 1, wrap: "nowrap", overflowX: "auto", fitsOneRow: true });

    await page.viewport(1280, 900);
    await waitUntil(() => layout().wrap === "wrap", 4000, "wrapping at 1280");
    expect(layout()).toMatchObject({ chips: phone.chips, overflowX: "visible", clipped: false });
  });

  test("one tap after the title saves the event with its title and links the clinician; the suggestions go once linked", async () => {
    const device = await draft("event", "Dr. Patel follow-up");
    await waitUntil(() => !!suggestion("Dr. Samuel Patel"), 4000, "the suggestion");
    await userEvent.click(suggestion("Dr. Samuel Patel")!);
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    const id = idOf(device.location());
    await waitUntil(() => chips().length === 1, 4000, "the chip");
    expect(await linkedIds(device, id)).toEqual([PATEL.id]);
    expect(
      (await device.query<{ title: string }>("SELECT title FROM timeline_entry WHERE id = ?", [id]))[0]
        ?.title,
    ).toBe("Dr. Patel follow-up");
    expect(SUGGESTIONS()).toBeNull();
  });

  test("a title used before suggests the providers linked to it, first", async () => {
    await draft("event", "Pharmacy pickup");
    const firstTwo = () => suggested().slice(0, 2).sort();
    await waitUntil(
      () => JSON.stringify(firstTwo()) === JSON.stringify(["Cornerstone Pharmacy", "Dr. Samuel Patel"]),
      4000,
      "the pickup's providers first",
    );
  });

  test("with nothing to match, recently linked providers are suggested (at most 5)", async () => {
    const CALL = fx.note({ occurredAt: hoursAgo(2), text: "Checked in" });
    await draft("note", "", {
      fixtures: [directory(), VISIT, CALL, fx.link(CALL.id, MARIA.id, { createdAt: hoursAgo(2) })],
    });
    await waitUntil(() => suggested().includes("Maria Reyes"), 4000, "a recent link");
    expect(suggested().length).toBeLessThanOrEqual(5);
  });
});

describe("other groups' providers in the picker", () => {
  /** Another group's practice and its clinician, and a provider that's here too (fictional). */
  const HARBOR = fx.provider({
    groupId: SECOND_GROUP.id,
    type: "practice",
    name: "Harbor Clinic",
    phones: [{ label: "Front desk", number: "(555) 010-1100" }],
  });
  const OKAFOR = fx.provider({
    groupId: SECOND_GROUP.id,
    name: "Dr. Nia Okafor",
    specialty: "Geriatrics",
    practiceId: HARBOR.id,
  });
  const PATEL_THERE = fx.provider({
    groupId: SECOND_GROUP.id,
    name: "Dr. Samuel Patel",
    specialty: "Cardiology",
  });
  const OTHERS = [secondGroup(), HARBOR, OKAFOR, PATEL_THERE];

  /** The picker's "From <group>" sections: each heading and the names under it. */
  const sections = () =>
    $$('[role="listbox"] [role="group"]').map((g) => ({
      heading: document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent ?? null,
      names: [...g.querySelectorAll('[role="option"]')].map((o) => o.firstElementChild?.textContent),
    }));

  test("a “From <group>” section once something is typed (after this group's, minus ones already here); a pick copies it with its practice and links the copy, whose chip opens this group's page", async () => {
    const device = await open(entryUrl(VISIT.id), { fixtures: [directory(), VISIT, ...OTHERS] });
    await userEvent.click(await found(ADD_LINK));
    await waitUntil(() => document.activeElement === PICKER(), 4000, "the picker");
    await waitUntil(() => !!option("Dr. Samuel Patel"), 4000, "this group's providers");
    expect(sections()).toEqual([]);

    await userEvent.keyboard("dr");
    await waitUntil(() => sections().length === 1, 4000, "the other group's section");
    expect(sections()).toEqual([
      { heading: "From Lou Lindqvist", names: ["Dr. Grace Lindqvist", "Dr. Nia Okafor"] },
    ]);
    // This group's matches come first; the other group's Dr. Patel is already here.
    const names = $$('[role="option"]').map((o) => o.firstElementChild?.textContent);
    expect(names.indexOf("Dr. Samuel Patel")).toBeLessThan(names.indexOf("Dr. Grace Lindqvist"));
    expect(names.filter((n) => n === "Dr. Samuel Patel")).toHaveLength(1);

    await userEvent.click(option("Dr. Nia Okafor")!);
    await waitUntil(() => chips().length === 1, 4000, "the chip");
    const copied = await device.query<{ id: string; name: string; practice_id: string | null }>(
      "SELECT id, name, practice_id FROM provider WHERE group_id = ? AND name IN ('Dr. Nia Okafor', 'Harbor Clinic') ORDER BY name",
      [GROUP],
    );
    const [copy, practice] = copied;
    expect(copied.map((p) => p.name)).toEqual(["Dr. Nia Okafor", "Harbor Clinic"]);
    expect([copy!.id, practice!.id]).not.toContain(OKAFOR.id);
    expect(copy!.practice_id).toBe(practice!.id);
    expect(await linkedIds(device, VISIT.id)).toEqual([copy!.id]);
    // One write: the practice, the clinician, then the link.
    const order = (await device.queued())
      .filter((w) => w.type === "provider" || w.type === "timeline_entry_provider")
      .map((w) => w.id);
    expect(order).toEqual([practice!.id, copy!.id, entryProviderId(VISIT.id, copy!.id)]);

    expect(chips()[0]).toMatchObject({ id: copy!.id, text: "Dr. Nia Okafor", href: providerUrl(copy!.id) });
    await userEvent.click(WITH()!.querySelector(`li[data-chip="${copy!.id}"] a`)!);
    await expect.poll(() => device.location()).toBe(providerUrl(copy!.id));
  });
});
