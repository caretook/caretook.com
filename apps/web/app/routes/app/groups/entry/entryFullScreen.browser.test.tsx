import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { at, fx, hoursAgo, TEST_GROUP } from "../../../../../test/fixtures";
import * as entryRoute from "./route";

// B-765: a live note opens full screen. The same editor (its ProseMirror
// element, Yjs document and cursor) moves into a modal <dialog> over the
// page and back; Escape or the button returns, focus on the button.

const GROUP = TEST_GROUP.id;
const entryPath = (id: string) => `/app/groups/${GROUP}/entries/${id}`;
const ROUTE = { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute };

const EDITOR = () => document.querySelector<HTMLElement>(".ProseMirror");
const FULL = () => document.querySelector<HTMLDialogElement>("dialog[data-note-full-screen]");
const OPEN = () => document.querySelector<HTMLButtonElement>('button[aria-label="Open full screen"]');
const EXIT = () =>
  document.querySelector<HTMLButtonElement>('dialog[open] button[aria-label="Exit full screen"]');
const TOOLBAR = () => document.querySelector<HTMLElement>('[role=toolbar][aria-label="Formatting"]');
/** The editor frame's bar (the toolbar and the full-screen button; full screen, the title and avatars too). */
const BAR = () => document.querySelector<HTMLElement>("[data-note-bar]");
const BAR_TITLE = () => BAR()?.querySelector("h2");
const BAR_AVATARS = () => [...(BAR()?.querySelectorAll("[data-person]") ?? [])];
const editorFocused = () => !!document.activeElement?.classList.contains("ProseMirror");

const SAM = fx.person({ name: "Sam Okafor", role: "caretaker" });
const note = () => fx.note({ title: "Night shift", text: "Slept well", occurredAt: hoursAgo(3) });

describe("full screen", () => {
  test("the button opens the same editor full screen; typing there shows on return; Escape closes it, focus on the button", async () => {
    const entry = note();
    const device = await renderWithDevice({ route: ROUTE, url: entryPath(entry.id), fixtures: [SAM, entry] });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Slept well"), "the note's text");
    const inline = EDITOR();
    // The cursor at the end of the text, then out to the button.
    (await found(EDITOR)).focus();
    await userEvent.keyboard("{End}");

    await userEvent.click(await found(OPEN));
    await waitUntil(() => !!FULL()?.open, "the full-screen dialog");
    const dialog = await found(FULL);
    expect(dialog.getAttribute("aria-label")).toBe("Night shift");
    expect(dialog.contains(EDITOR())).toBe(true);
    // The same ProseMirror element, so the same editor and Yjs document.
    expect(EDITOR()).toBe(inline);
    expect(EDITOR()?.textContent).toBe("Slept well");
    expect(!!TOOLBAR() && dialog.contains(TOOLBAR())).toBe(true);
    expect(!!EXIT()).toBe(true);
    // The cursor is back where it was.
    await waitUntil(() => editorFocused(), "the editor's focus");

    await userEvent.keyboard(" through the night");
    await expect.poll(() => EDITOR()?.textContent).toBe("Slept well through the night");

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !FULL()?.open, "the dialog closed");
    await waitUntil(() => document.activeElement === OPEN(), "focus on the button");
    expect(dialog.contains(EDITOR())).toBe(false);
    expect(EDITOR()?.textContent).toBe("Slept well through the night");
    // Written to the local database as usual.
    await expect
      .poll(async () => (await device.query("SELECT id FROM note_update")).length)
      .toBeGreaterThan(0);

    // The button inside closes it too.
    await userEvent.click(await found(OPEN));
    await userEvent.click(await found(EXIT));
    await waitUntil(() => !FULL()?.open, "the dialog closed by its button");
    await waitUntil(() => document.activeElement === OPEN(), "focus on the button again");
    expect(EDITOR()?.textContent).toBe("Slept well through the night");
  });

  test("a viewer, who can't edit, opens it full screen to read", async () => {
    const entry = note();
    await renderWithDevice({
      route: ROUTE,
      url: entryPath(entry.id),
      role: "viewer",
      fixtures: [SAM, entry],
    });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Slept well"), "the note's text");
    expect(!!TOOLBAR()).toBe(false);

    await userEvent.click(await found(OPEN));
    await waitUntil(() => !!FULL()?.open, "the full-screen dialog");
    expect(FULL()?.contains(EDITOR())).toBe(true);
    expect(EDITOR()?.textContent).toBe("Slept well");
    expect(EDITOR()?.getAttribute("contenteditable")).toBe("false");
    expect(!!TOOLBAR()).toBe(false);
    // B-962: still the title and Exit in the bar.
    expect(BAR_TITLE()?.textContent).toBe("Night shift");
    expect(!!EXIT() && BAR()?.contains(EXIT())).toBe(true);

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !FULL()?.open, "the dialog closed");
    await waitUntil(() => document.activeElement === OPEN(), "focus on the button");
  });

  // B-962: full screen fills the screen; the title and avatars move into the note's bar.
  test("full screen: the bar holds the title, the avatars and Exit, with no heading row; on the page the bar has no title", async () => {
    const entry = note();
    const device = await renderWithDevice({ route: ROUTE, url: entryPath(entry.id), fixtures: [SAM, entry] });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Slept well"), "the note's text");
    // On the page: the toolbar and the button, no title (the page has its heading).
    expect(!!BAR() && !!TOOLBAR() && BAR()?.contains(TOOLBAR())).toBe(true);
    expect(BAR_TITLE()).toBeNull();
    // Sam is writing, from their device.
    await device.sync(
      fx.document({ ownerId: entry.id, text: "Slept well", editors: JSON.stringify({ [SAM.id]: at() }) }),
    );
    await device.settle();

    await userEvent.click(await found(OPEN));
    await waitUntil(() => !!FULL()?.open, "the full-screen dialog");
    const dialog = await found(FULL);
    expect(dialog.getAttribute("aria-label")).toBe("Night shift");
    const bar = await found(BAR);
    expect(dialog.contains(bar)).toBe(true);
    expect(BAR_TITLE()?.textContent).toBe("Night shift");
    await waitUntil(() => BAR_AVATARS().length === 1, "Sam's avatar in the bar");
    expect(BAR_AVATARS()[0]?.textContent).toBe("SO");
    expect(!!EXIT() && bar.contains(EXIT())).toBe(true);
    expect(!!TOOLBAR() && bar.contains(TOOLBAR())).toBe(true);
    // No separate heading row: the bar's is the dialog's only heading, and the frame is the dialog's only content.
    expect(dialog.querySelectorAll("h1, h2, h3").length).toBe(1);
    // Edge to edge: the bar spans the dialog's width.
    expect(bar.getBoundingClientRect().width).toBe(dialog.getBoundingClientRect().width);
  });

  test.each([
    { width: 420, ownRow: true, screen: "a phone: the toolbar on its own row below the title" },
    { width: 1024, ownRow: false, screen: "a wide screen: the toolbar in the title's row" },
  ])("full screen on $screen", async ({ width, ownRow }) => {
    const top = (el: Element | null | undefined) => el?.getBoundingClientRect().top ?? NaN;
    const entry = note();
    await renderWithDevice({ route: ROUTE, url: entryPath(entry.id), fixtures: [SAM, entry], width });
    await waitUntil(() => !!EDITOR()?.textContent?.includes("Slept well"), "the note's text");
    await userEvent.click(await found(OPEN));
    await waitUntil(() => !!FULL()?.open, "the full-screen dialog");
    await found(TOOLBAR);
    expect(top(TOOLBAR()) > top(BAR_TITLE()) + 8).toBe(ownRow);
    // Exit stays in the title's row.
    expect(Math.abs(top(EXIT()) - top(BAR_TITLE()))).toBeLessThan(24);
  });
});
