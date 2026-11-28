import { describe, expect, test } from "vitest";
import * as Y from "yjs";
import { at, fx } from "../../../../../test/fixtures";
import { waitUntil } from "../../../../../test/found";
import { openTimeline, rowWith, rows, setView, view } from "./timelineWorld";
import { encodeNoteDoc, MENTION_NODE, NOTE_FRAGMENT } from "@caretook/data/domain";

// A live note's formatting in the Full (cards) view (B-850): headings, lists,
// bold and mentions as the editor shows them, read-only; Condensed (rows)
// keeps its plain two-line clamp.

const minutesAgo = (m: number) => at(new Date(Date.now() - m * 60_000));
const PROVIDER_ID = "5b3f6c1e-8d2a-4e7b-9c40-1a2b3c4d5e61";

/** A document as the editor stores it: a heading, a paragraph with bold and a mention, and a bulleted list. */
const formattedDoc = () => {
  const doc = new Y.Doc();
  const root = doc.getXmlFragment(NOTE_FRAGMENT);
  const heading = new Y.XmlElement("heading");
  const intro = new Y.XmlElement("paragraph");
  const list = new Y.XmlElement("bulletList");
  root.push([heading, intro, list]);
  heading.setAttribute("level", 2 as never); // a number, as the editor stores it
  const headingText = new Y.XmlText();
  heading.push([headingText]);
  headingText.insert(0, "Morning check");
  const introText = new Y.XmlText();
  const mention = new Y.XmlElement(MENTION_NODE);
  intro.push([introText, mention]);
  introText.insert(0, "Slept ");
  introText.insert(6, "well", { bold: {} });
  introText.insert(10, ", called ", { bold: null });
  mention.setAttribute("id", PROVIDER_ID);
  mention.setAttribute("label", "Dr. Lark");
  mention.setAttribute("mentionSuggestionChar", "@");
  for (const line of ["Ate breakfast", "Took a short walk"]) {
    const item = new Y.XmlElement("listItem");
    const p = new Y.XmlElement("paragraph");
    const t = new Y.XmlText();
    list.push([item]);
    item.push([p]);
    p.push([t]);
    t.insert(0, line);
  }
  return doc;
};

const TEXT = "Morning check\nSlept well, called @Dr. Lark\n• Ate breakfast\n• Took a short walk";
const NOTE = fx.note({ occurredAt: minutesAgo(5) });
const fixtures = [
  NOTE,
  fx.document({ ownerId: NOTE.id, text: TEXT, snapshot: encodeNoteDoc(formattedDoc()) }),
];

const noteItem = () => rowWith("Morning check");

describe("a live note's text on the timeline", () => {
  test("Full view: headings, lists and bold as elements, a mention as a chip, nothing editable", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => rows().length === 1, "the note");
    await setView("Full");
    await waitUntil(() => view() === "cards" && !!noteItem()?.querySelector("[data-rich-text]"), "rich text");
    const rich = noteItem()!.querySelector<HTMLElement>("[data-rich-text]")!;

    expect(rich.querySelector("h2")?.textContent).toBe("Morning check");
    expect(rich.querySelector("strong")?.textContent).toBe("well");
    expect([...rich.querySelectorAll("ul > li")].map((li) => li.textContent)).toEqual([
      "Ate breakfast",
      "Took a short walk",
    ]);
    expect(rich.querySelector(`[data-mention="${PROVIDER_ID}"]`)?.textContent).toBe("Dr. Lark");
    // Read-only: no editor, nothing editable, no "@" or "•" from the plain text.
    expect(rich.closest("[contenteditable]")).toBeNull();
    expect(rich.querySelector("[contenteditable], input, textarea")).toBeNull();
    expect(rich.textContent).not.toContain("•");
    expect(rich.textContent).not.toContain("@");
  });

  test("Condensed view: the same note keeps its plain two-line clamp", async () => {
    await openTimeline({ fixtures });
    await waitUntil(() => view() === "rows" && rows().length === 1, "the note's row");
    const item = noteItem()!;
    expect(item.querySelector("[data-rich-text], h2, strong, ul")).toBeNull();
    const text = [...item.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Morning check"));
    expect(text?.className).toContain("line-clamp-2");
    expect(text?.textContent).toBe(TEXT);
  });
});
