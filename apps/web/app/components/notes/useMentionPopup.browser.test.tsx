import type { Fixture } from "../../../test/fixtures";
import type { MentionAddResult } from "./useMentionPopup";

import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import * as Y from "yjs";
import { renderWithDevice } from "../../../test/device";
import { at, newId, TEST_GROUP, TEST_USER } from "../../../test/fixtures";
import { waitUntil } from "../../../test/found";
import { getByCss } from "../../../test/locators";
import { useGroup } from "~/lib/app-shell/group";
import { useMentionProviders } from "~/lib/providers/mentionProviders.sync";
import { getSync } from "~/lib/sync";
import { directory, PATEL } from "../../routes/app/groups/providers/providerWorld";
import { LiveNotesEditor } from "./LiveNotesEditor";
import { fromBase64, NOTE_FRAGMENT, toBase64 } from "@caretook/data/domain";

// A slow add from the `@` popup (the add row, or a "From <group>" copy,
// which share the path): the mention lands on the `@` that started it,
// wherever edits since have moved it, and nowhere else. Edits in between,
// a second popup and another device's typing leave it alone; if its `@`
// text is gone, nothing is inserted. The popup's own behaviour is
// entry/entryMentions.browser.test.tsx's.

const DOC = newId();
const MADE = "3f6a2c8e-41b7-4d95-9e0a-7c5b1d2e8f64";
/** The editor. */
const NOTES = () => getByCss(".ProseMirror");
/** The editor's text, or null before it's there. */
const notesText = () => NOTES().query()?.textContent ?? null;
const popupRows = () =>
  getByCss('[data-mention-popup] [role="option"]')
    .elements()
    .map((o) => o.firstElementChild?.textContent ?? "");
const mentions = () =>
  getByCss(".ProseMirror [data-mention]")
    .elements()
    .map((m) => (m as HTMLElement).dataset.mention);

function Notes({ onAdd }: { onAdd: (name: string) => Promise<MentionAddResult> }) {
  const { id, canWrite } = useGroup();
  const [db] = useState(getSync);
  const providers = useMentionProviders(id);
  return (
    <LiveNotesEditor
      label="Notes"
      db={db}
      documentId={DOC}
      groupId={id}
      canWrite={canWrite}
      initial={{ snapshot: null, updates: [] }}
      providers={providers}
      onAdd={onAdd}
    />
  );
}

/** An add that waits for the test: `finish()` writes it. */
const slowAdd = () => {
  let finish = () => {};
  const onAdd = vi.fn(() => new Promise<MentionAddResult>((r) => (finish = () => r({ ok: true, id: MADE }))));
  return { onAdd, finish: () => finish() };
};

const open = (onAdd: (name: string) => Promise<MentionAddResult>) =>
  renderWithDevice({
    element: <Notes onAdd={onAdd} />,
    url: `/app/groups/${TEST_GROUP.id}`,
    fixtures: [directory()],
  });

/** Type "Saw @Dr. Chen" and take the add row (the add then waits). */
const startAdd = async (onAdd: ReturnType<typeof slowAdd>["onAdd"]) => {
  await userEvent.click(NOTES());
  await userEvent.keyboard("Saw @Dr. Chen");
  await waitUntil(() => popupRows().length === 1, "the add row");
  expect(popupRows()).toEqual(['Add "Dr. Chen" as a provider']);
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => onAdd.mock.calls).toEqual([["Dr. Chen"]]);
};

/** Another device's typing at the start of the first line, built on what this one has written. */
const typedElsewhere = async (device: Awaited<ReturnType<typeof open>>, words: string): Promise<Fixture> => {
  const doc = new Y.Doc();
  for (const { data } of await device.query<{ data: string }>(
    "SELECT data FROM note_update WHERE document_id = ?",
    [DOC],
  ))
    Y.applyUpdate(doc, fromBase64(data));
  const before = Y.encodeStateVector(doc);
  const line = doc.getXmlFragment(NOTE_FRAGMENT).get(0) as Y.XmlElement;
  (line.get(0) as Y.XmlText).insert(0, words);
  const id = newId();
  return {
    table: "note_update",
    id,
    row: {
      id,
      group_id: TEST_GROUP.id,
      document_id: DOC,
      data: toBase64(Y.encodeStateAsUpdate(doc, before)),
      created_at: at(),
      created_by: TEST_USER.id,
    },
  };
};

describe("a slow add from the @ popup", () => {
  test("typing elsewhere and a second popup meanwhile: the mention lands at the first @ only, and the second popup goes on", async () => {
    const { onAdd, finish } = slowAdd();
    await open(onAdd);
    await startAdd(onAdd);

    // Meanwhile: to the start of the line, some text, and a second `@`.
    await userEvent.keyboard("{Home}Monday, @pat");
    await waitUntil(() => popupRows().includes("Dr. Samuel Patel"), "the second popup");
    finish();

    await waitUntil(() => mentions().length === 1, "the mention");
    expect(mentions()).toEqual([MADE]);
    await expect.poll(notesText).toBe("Monday, @patSaw Dr. Chen ");
    // The second popup is untouched, and the caret is still in it.
    expect(popupRows()).toContain("Dr. Samuel Patel");
    await userEvent.keyboard("el{Enter}");
    await waitUntil(() => mentions().length === 2, "the second mention");
    expect(mentions()).toEqual([PATEL.id, MADE]);
    await expect.poll(notesText).toBe("Monday, Dr. Samuel Patel Saw Dr. Chen ");
  });

  test("another device's typing before the @ meanwhile: the mention still lands on it", async () => {
    const { onAdd, finish } = slowAdd();
    const device = await open(onAdd);
    await startAdd(onAdd);
    await userEvent.keyboard("{Escape}");
    await expect
      .poll(
        async () => (await device.query("SELECT id FROM note_update WHERE document_id = ?", [DOC])).length,
      )
      .toBeGreaterThan(0);
    await device.sync([await typedElsewhere(device, "Tuesday: ")]);
    await device.settle();
    await expect.poll(notesText).toBe("Tuesday: Saw @Dr. Chen");
    finish();

    await waitUntil(() => mentions().length === 1, "the mention");
    expect(mentions()).toEqual([MADE]);
    await expect.poll(notesText).toBe("Tuesday: Saw Dr. Chen ");
  });

  test("the @ text changed meanwhile: nothing is inserted (the provider was still added)", async () => {
    const { onAdd, finish } = slowAdd();
    const device = await open(onAdd);
    await startAdd(onAdd);
    await userEvent.keyboard("{Escape}{Backspace}{Backspace}{Backspace}{Backspace}Lee{Escape}");
    await expect.poll(notesText).toBe("Saw @Dr. Lee");
    finish();
    expect(await onAdd.mock.results[0]?.value).toEqual({ ok: true, id: MADE });
    // The add's answer has been handled (its await came first); whatever it would write has rendered.
    await device.settle();
    expect(mentions()).toEqual([]);
    expect(notesText()).toBe("Saw @Dr. Lee");
  });
});
