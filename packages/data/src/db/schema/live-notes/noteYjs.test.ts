import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  buildNoteDoc,
  encodeNoteDoc,
  fromBase64,
  isYjsUpdate,
  MENTION_NODE,
  NOTE_FRAGMENT,
  noteDocFromText,
  noteText,
  prependNoteSection,
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

  it("reads a mention as @ and its label, where it sits in the line", () => {
    // As Tiptap's Collaboration stores it: text, the mention atom, text.
    const doc = new Y.Doc();
    const p = new Y.XmlElement("paragraph");
    doc.getXmlFragment(NOTE_FRAGMENT).insert(0, [p]);
    const before = new Y.XmlText();
    const mention = new Y.XmlElement(MENTION_NODE);
    const after = new Y.XmlText();
    p.insert(0, [before, mention, after]);
    before.insert(0, "Called ");
    mention.setAttribute("id", "4b7e7a52-6f1c-4a3e-9b51-2f0d1c8e9a10");
    mention.setAttribute("label", "Dr. Samuel Patel");
    mention.setAttribute("mentionSuggestionChar", "@");
    after.insert(0, " about the dose.");
    expect(noteText(doc)).toBe("Called @Dr. Samuel Patel about the dose.");
    // And the same after a round trip through a stored snapshot.
    expect(noteText(buildNoteDoc(encodeNoteDoc(doc)))).toBe("Called @Dr. Samuel Patel about the dose.");
  });

  it("reads a mention without a label as a bare @", () => {
    const doc = new Y.Doc();
    const p = new Y.XmlElement("paragraph");
    doc.getXmlFragment(NOTE_FRAGMENT).insert(0, [p]);
    p.insert(0, [new Y.XmlElement(MENTION_NODE)]);
    expect(noteText(doc)).toBe("@");
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

describe("prependNoteSection", () => {
  const SECTION = [
    { text: "Since your last visit · Oct 12 – Nov 19", style: "heading" as const },
    { text: "Symptoms", style: "subheading" as const },
    { text: "Dizziness: 3 times, worst 6/10", style: "bullet" as const },
    { text: "Headache: once", style: "bullet" as const },
    { text: "Nothing else to note." },
  ];

  it("puts the lines at the start, as headings, one list and paragraphs", () => {
    const doc = noteDocFromText("Questions:\n• Lower the dose?");
    prependNoteSection(doc, SECTION);
    expect(noteText(doc)).toBe(
      [
        "Since your last visit · Oct 12 – Nov 19",
        "Symptoms",
        "• Dizziness: 3 times, worst 6/10",
        "• Headache: once",
        "Nothing else to note.",
        "Questions:",
        "• Lower the dose?",
      ].join("\n"),
    );
    const nodes = doc.getXmlFragment(NOTE_FRAGMENT).toArray() as Y.XmlElement[];
    expect(nodes.map((n) => n.nodeName)).toEqual([
      "heading",
      "heading",
      "bulletList",
      "paragraph",
      "paragraph",
      "bulletList",
    ]);
    expect(nodes[0]!.getAttribute("level")).toBe(2);
    expect(nodes[1]!.getAttribute("level")).toBe(3);
  });

  it("makes one update that rebuilds the same document elsewhere", () => {
    const snapshot = encodeNoteDoc(noteDocFromText("Typed earlier"));
    const doc = buildNoteDoc(snapshot);
    let count = 0;
    doc.on("update", () => count++);
    const update = prependNoteSection(doc, SECTION);
    expect(count).toBe(1);
    expect(noteText(buildNoteDoc(snapshot, [toBase64(update)]))).toBe(noteText(doc));
  });

  it("a rerun goes above the earlier section, leaving it as it was", () => {
    const doc = noteDocFromText("");
    prependNoteSection(doc, [{ text: "First", style: "heading" }, { text: "Old line" }]);
    prependNoteSection(doc, [{ text: "Second", style: "heading" }, { text: "New line" }]);
    expect(noteText(doc)).toBe("Second\nNew line\nFirst\nOld line");
  });

  it("converges with someone typing at the same time, keeping both", () => {
    const snapshot = encodeNoteDoc(noteDocFromText("Ask about the cough"));
    const a = buildNoteDoc(snapshot);
    const b = buildNoteDoc(snapshot);
    const fromA = prependNoteSection(a, SECTION);
    // B types at the start of the existing paragraph, and adds a line at the very top.
    const fromB: Uint8Array[] = [];
    b.on("update", (u: Uint8Array) => fromB.push(u));
    const root = b.getXmlFragment(NOTE_FRAGMENT);
    const first = (root.get(0) as Y.XmlElement).get(0) as Y.XmlText;
    first.insert(0, "Please ");
    const p = new Y.XmlElement("paragraph");
    root.insert(0, [p]);
    const t = new Y.XmlText();
    p.insert(0, [t]);
    t.insert(0, "Bring the pill box");

    Y.applyUpdate(a, Y.mergeUpdates(fromB));
    Y.applyUpdate(b, fromA);
    const text = noteText(a);
    expect(noteText(b)).toBe(text);
    expect(text).toContain("Please Ask about the cough");
    expect(text).toContain("Bring the pill box");
    for (const line of SECTION) expect(text).toContain(line.text);
    // The section stays in one piece, in order.
    const lines = text.split("\n");
    const start = lines.indexOf(SECTION[0]!.text);
    expect(lines.slice(start, start + SECTION.length).map((l) => l.replace(/^• /, ""))).toEqual(
      SECTION.map((l) => l.text),
    );
  });
});
