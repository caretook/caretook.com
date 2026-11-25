import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { found, waitUntil } from "../../../../../test/found";
import { renderWithDevice } from "../../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../../test/fixtures";
import * as entryRoute from "./route";

// A new event's or note's first save shows a toast, "Event saved" or "Note
// saved" (B-693), through the shared queue, so it outlives the URL replace
// from /entries/new to /entries/:id. Once: later changes show none, and a
// failed first save shows none (its error stays inline). It never takes the
// editor's focus.

const GROUP = TEST_GROUP.id;
const NEW = (kind: "event" | "note") => `/app/groups/${GROUP}/entries/new?kind=${kind}`;
const ON_ENTRY = /\/entries\/[0-9a-f-]{36}$/;
const ROUTE = { path: "/app/groups/:groupId/entries/:entryId", module: entryRoute };

const TITLE = () => document.querySelector<HTMLInputElement>("main header input");
const EDITOR = () => document.querySelector<HTMLElement>(".ProseMirror");
const editorFocused = () => !!document.activeElement?.classList.contains("ProseMirror");
const toasts = () => [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')];

describe("a new entry's first save", () => {
  test('a new event\'s first save shows "Event saved" once; a second change shows no toast', async () => {
    const device = await renderWithDevice({ route: ROUTE, url: NEW("event") });
    (await found(TITLE)).focus();
    await userEvent.keyboard("Dentist");
    (await found(TITLE)).blur();
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    await expect.element(page.getByRole("alertdialog", { name: "Event saved" })).toBeInTheDocument();
    expect(toasts()).toHaveLength(1);

    // A second change (the text) autosaves with no toast.
    await userEvent.click(await found(EDITOR));
    await userEvent.keyboard("Bring the insurance card");
    await device.settle();
    await expect.poll(async () => (await device.query("SELECT id FROM note_document")).length).toBe(1);
    (await found(TITLE)).focus();
    await userEvent.keyboard(" checkup");
    (await found(TITLE)).blur();
    await expect
      .poll(async () => (await device.query<{ title: string }>("SELECT title FROM timeline_entry"))[0]?.title)
      .toBe("Dentist checkup");
    await device.settle();
    expect(toasts()).toHaveLength(1);
    expect(document.body.textContent.match(/Event saved/g)).toHaveLength(1);
  });

  test('a new note\'s first typed text shows "Note saved" and the editor keeps focus', async () => {
    const device = await renderWithDevice({ route: ROUTE, url: NEW("note") });
    await waitUntil(editorFocused, "the editor's focus");
    await userEvent.keyboard("Slept well");
    await expect.poll(() => device.location()).toMatch(ON_ENTRY);
    await expect.element(page.getByRole("alertdialog", { name: "Note saved" })).toBeInTheDocument();
    expect(editorFocused()).toBe(true);
    // Typing goes on into the note.
    await userEvent.keyboard(" all night");
    await expect.poll(() => EDITOR()?.textContent).toContain("Slept well all night");
    expect(editorFocused()).toBe(true);
    expect(toasts()).toHaveLength(1);
  });

  test("a failed first save shows no toast; its error stays inline", async () => {
    // A group with no care recipient yet: an entry can't be saved.
    const device = await renderWithDevice({
      route: ROUTE,
      url: NEW("event"),
      bareDevice: true,
      fixtures: [fx.group(), fx.member({ userId: TEST_USER.id, role: "owner" })],
    });
    (await found(TITLE)).focus();
    await userEvent.keyboard("Dentist");
    (await found(TITLE)).blur();
    await waitUntil(
      () => document.body.textContent.includes("This care group has no care recipient yet"),
      "the inline error",
    );
    await device.settle();
    expect(device.location()).toBe(NEW("event"));
    expect(toasts()).toEqual([]);
    expect(document.body.textContent).not.toMatch(/Event saved/);
  });
});
