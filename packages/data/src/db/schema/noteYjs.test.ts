import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  buildNoteDoc,
  encodeNoteDoc,
  fromBase64,
  isYjsUpdate,
  NOTE_FRAGMENT,
  noteDocFromText,
  noteText,
  toBase64,
} from "./noteYjs";

describe("noteDocFromText", () => {
  const roundTrip = (text: string) => noteText(buildNoteDoc(encodeNoteDoc(noteDocFromText(text))));

  it("round trips plain text through a stored document", () => {
    expect(roundTrip("Ate most of lunch.\nGood spirits.")).toBe("Ate most of lunch.\nGood spirits.");
  });

  it("turns • lines into a bulleted list", () => {
    const text = "Questions for Dr. Lee:\n• Lower the dose?\n• Recheck when?\nThat's all.";
    expect(roundTrip(text)).toBe(text);
    const fragment = noteDocFromText(text).getXmlFragment(NOTE_FRAGMENT);
    expect(fragment.toArray().map((n) => (n as Y.XmlElement).nodeName)).toEqual([
      "paragraph",
      "bulletList",
      "paragraph",
    ]);
  });

  it("keeps a blank line between paragraphs", () => {
    expect(roundTrip("First\n\nSecond")).toBe("First\n\nSecond");
  });

  it("gives an empty document for empty text", () => {
    for (const text of ["", "  \n "]) {
      const doc = noteDocFromText(text);
      expect(doc.getXmlFragment(NOTE_FRAGMENT).length).toBe(0);
      expect(noteText(doc)).toBe("");
    }
  });
});

/** A Tiptap-shaped document: paragraphs, a heading, a bullet list. */
const sampleDoc = () => {
  const doc = new Y.Doc();
  const root = doc.getXmlFragment(NOTE_FRAGMENT);
  const block = (name: string, text: string, attrs: Record<string, string> = {}) => {
    const el = new Y.XmlElement(name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const t = new Y.XmlText();
    el.insert(0, [t]);
    t.insert(0, text);
    return el;
  };
  const item = (text: string) => {
    const li = new Y.XmlElement("listItem");
    li.insert(0, [block("paragraph", text)]);
    return li;
  };
  const list = new Y.XmlElement("bulletList");
  root.insert(0, [
    block("heading", "Dr. Lee visit", { level: "2" }),
    block("paragraph", "BP looks better."),
    list,
  ]);
  list.insert(0, [item("Lower lisinopril"), item("Recheck in 2 weeks")]);
  // Bold text is a formatting attribute: it shouldn't show up in plain text.
  const bold = root.get(1) as Y.XmlElement;
  (bold.get(0) as Y.XmlText).format(0, 2, { bold: true });
  return doc;
};

describe("base64", () => {
  it("round-trips bytes, including big ones", () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("isYjsUpdate", () => {
  it("accepts a real update and refuses junk", () => {
    expect(isYjsUpdate(encodeNoteDoc(sampleDoc()))).toBe(true);
    expect(isYjsUpdate("not base64!")).toBe(false);
    expect(isYjsUpdate(toBase64(new Uint8Array([255, 255, 255, 255, 1])))).toBe(false);
    expect(isYjsUpdate("")).toBe(false);
  });
});

describe("noteText", () => {
  it("turns blocks into lines and list items into bullets", () => {
    expect(noteText(sampleDoc())).toBe(
      "Dr. Lee visit\nBP looks better.\n• Lower lisinopril\n• Recheck in 2 weeks",
    );
  });

  it("is empty for an empty document", () => {
    expect(noteText(new Y.Doc())).toBe("");
  });
});

describe("buildNoteDoc", () => {
  it("merges two people's concurrent edits, in any order", () => {
    const base = sampleDoc();
    const snapshot = encodeNoteDoc(base);

    const a = buildNoteDoc(snapshot);
    const b = buildNoteDoc(snapshot);
    const edit = (doc: Y.Doc, text: string) => {
      const p = new Y.XmlElement("paragraph");
      const t = new Y.XmlText();
      p.insert(0, [t]);
      t.insert(0, text);
      const root = doc.getXmlFragment(NOTE_FRAGMENT);
      root.insert(root.length, [p]);
    };
    const updates: string[] = [];
    a.on("update", (u: Uint8Array) => updates.push(toBase64(u)));
    b.on("update", (u: Uint8Array) => updates.push(toBase64(u)));
    edit(a, "From A");
    edit(b, "From B");

    const forward = noteText(buildNoteDoc(snapshot, updates));
    const backward = noteText(buildNoteDoc(snapshot, [...updates].reverse()));
    expect(forward).toBe(backward);
    expect(forward).toContain("From A");
    expect(forward).toContain("From B");
    // A replayed update changes nothing.
    expect(noteText(buildNoteDoc(snapshot, [...updates, ...updates]))).toBe(forward);
  });
});
