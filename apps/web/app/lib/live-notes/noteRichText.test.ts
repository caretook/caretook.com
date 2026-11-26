import { MENTION_NODE, NOTE_FRAGMENT, noteDocFromText } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { noteRichText } from "./noteRichText";

const text = (parent: Y.XmlElement, value: string, attributes?: Record<string, object>) => {
  const t = new Y.XmlText();
  parent.push([t]);
  t.insert(0, value, attributes);
  return t;
};

describe("noteRichText", () => {
  it("reads headings, marks, mentions, breaks and nested lists as the editor stores them", () => {
    const doc = new Y.Doc();
    const root = doc.getXmlFragment(NOTE_FRAGMENT);
    const heading = new Y.XmlElement("heading");
    const p = new Y.XmlElement("paragraph");
    const ol = new Y.XmlElement("orderedList");
    const rule = new Y.XmlElement("horizontalRule");
    root.push([heading, p, ol, rule]);
    heading.setAttribute("level", 3 as never);
    text(heading, "Plan");
    const run = text(p, "Calm ");
    // An overlapping mark's hashed name (y-tiptap) and a mark the editor doesn't have.
    run.insert(5, "day", { bold: {}, "italic--abcd1234": {}, comment: {} });
    const br = new Y.XmlElement("hardBreak");
    const mention = new Y.XmlElement(MENTION_NODE);
    p.push([br, mention]);
    mention.setAttribute("id", "p1");
    mention.setAttribute("label", "Dr. Lark");
    ol.setAttribute("start", 3 as never);
    const item = new Y.XmlElement("listItem");
    ol.push([item]);
    const itemP = new Y.XmlElement("paragraph");
    const inner = new Y.XmlElement("bulletList");
    item.push([itemP, inner]);
    text(itemP, "Walk");
    const innerItem = new Y.XmlElement("listItem");
    inner.push([innerItem]);
    const innerP = new Y.XmlElement("paragraph");
    innerItem.push([innerP]);
    text(innerP, "Slowly");

    expect(noteRichText(doc)).toEqual([
      { kind: "heading", level: 3, content: [{ kind: "text", text: "Plan", marks: [] }] },
      {
        kind: "paragraph",
        content: [
          { kind: "text", text: "Calm ", marks: [] },
          { kind: "text", text: "day", marks: ["bold", "italic"] },
          { kind: "break" },
          { kind: "mention", id: "p1", label: "Dr. Lark" },
        ],
      },
      {
        kind: "orderedList",
        start: 3,
        children: [
          {
            kind: "listItem",
            children: [
              { kind: "paragraph", content: [{ kind: "text", text: "Walk", marks: [] }] },
              {
                kind: "bulletList",
                children: [
                  {
                    kind: "listItem",
                    children: [{ kind: "paragraph", content: [{ kind: "text", text: "Slowly", marks: [] }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { kind: "rule" },
    ]);
  });

  it("reads a document made from plain text, and an empty one", () => {
    expect(noteRichText(noteDocFromText("Hi\n• one"))).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Hi", marks: [] }] },
      {
        kind: "bulletList",
        children: [
          {
            kind: "listItem",
            children: [{ kind: "paragraph", content: [{ kind: "text", text: "one", marks: [] }] }],
          },
        ],
      },
    ]);
    expect(noteRichText(new Y.Doc())).toEqual([]);
  });

  it("walks into a node it doesn't know, and defaults a bad heading level", () => {
    const doc = new Y.Doc();
    const root = doc.getXmlFragment(NOTE_FRAGMENT);
    const box = new Y.XmlElement("callout");
    const heading = new Y.XmlElement("heading");
    root.push([box, heading]);
    const p = new Y.XmlElement("paragraph");
    box.push([p]);
    text(p, "Inside");
    text(heading, "Title");
    expect(noteRichText(doc)).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Inside", marks: [] }] },
      { kind: "heading", level: 2, content: [{ kind: "text", text: "Title", marks: [] }] },
    ]);
  });
});
