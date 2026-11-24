import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, hoursAgo, TEST_GROUP } from "../../../../../test/fixtures";
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

    await userEvent.keyboard("{Escape}");
    await waitUntil(() => !FULL()?.open, "the dialog closed");
    await waitUntil(() => document.activeElement === OPEN(), "focus on the button");
  });
});
