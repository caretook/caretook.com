import * as Y from "yjs";

// Yjs helpers shared by the server (compaction, plain text) and devices
// (the editor, previews). Client-safe: yjs runs anywhere.
//
// A live document is a Y.Doc whose content is the Tiptap editor's
// ProseMirror tree, in the XML fragment named NOTE_FRAGMENT (Tiptap's
// Collaboration extension uses "default" unless told otherwise).
//
// Binary Yjs updates travel and sit in Postgres/SQLite as base64 text:
// PowerSync syncs text, not bytes.

export const NOTE_FRAGMENT = "default";

/**
 * The editor's mention node (Tiptap's Mention): an inline atom whose `id` is
 * a provider's id and `label` its name when it was typed. Plain text reads
 * it as `@<label>`.
 */
export const MENTION_NODE = "mention";

/** Bytes → base64. Chunked, so large snapshots don't overflow the call stack. */
export const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

/** base64 → bytes. Throws on text that isn't base64. */
export const fromBase64 = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Whether `base64` is a Yjs update that applies cleanly to an empty document. */
export const isYjsUpdate = (base64: string) => {
  try {
    const bytes = fromBase64(base64);
    if (!bytes.length) return false;
    Y.applyUpdate(new Y.Doc(), bytes);
    return true;
  } catch {
    return false;
  }
};

/** A Y.Doc built from a snapshot plus any updates (all base64). Order doesn't matter. */
export const buildNoteDoc = (snapshot: string | null | undefined, updates: readonly string[] = []) => {
  const doc = new Y.Doc();
  for (const update of [snapshot, ...updates]) {
    if (update) Y.applyUpdate(doc, fromBase64(update));
  }
  return doc;
};

/** The document's whole state as one update, for a compacted snapshot. Deleted content is dropped. */
export const encodeNoteDoc = (doc: Y.Doc) => toBase64(Y.encodeStateAsUpdate(doc));

// Tiptap's text blocks. Each becomes one line of plain text; everything
// else (lists, quotes) is a container whose blocks are walked in order.
const TEXT_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

const inlineText = (node: Y.XmlElement | Y.XmlText): string => {
  if (node instanceof Y.XmlText) {
    return (node.toDelta() as { insert?: unknown }[])
      .map((op) => (typeof op.insert === "string" ? op.insert : ""))
      .join("");
  }
  if (node.nodeName === "hardBreak") return "\n";
  // A mention (an inline atom): its name as typed, so a search for it finds the note.
  if (node.nodeName === MENTION_NODE) return `@${String(node.getAttribute("label") ?? "")}`;
  return node
    .toArray()
    .map((child) => (child instanceof Y.XmlElement || child instanceof Y.XmlText ? inlineText(child) : ""))
    .join("");
};

const blockLines = (node: Y.XmlFragment | Y.XmlElement, prefix = ""): string[] => {
  const lines: string[] = [];
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlText) {
      lines.push(prefix + inlineText(child));
    } else if (child instanceof Y.XmlElement) {
      if (TEXT_BLOCKS.has(child.nodeName)) lines.push(prefix + inlineText(child));
      else if (child.nodeName === "listItem") {
        // "• " on the item's first line, indented continuation lines.
        const [first = "", ...rest] = blockLines(child);
        lines.push(`${prefix}• ${first}`, ...rest.map((l) => `${prefix}  ${l}`));
      } else lines.push(...blockLines(child, prefix));
    }
  }
  return lines;
};

const BULLET = "• ";

/** A provider mentioned in text put into a document: its id and the name it shows. */
export type NoteMention = { id: string; label: string };

/**
 * `line` split where it says `@<label>` for one of `mentions` (longest label
 * first): text runs and the mentions found there, in order.
 */
const mentionRuns = (line: string, mentions: readonly NoteMention[]) => {
  const runs: (string | NoteMention)[] = [];
  const byLength = [...mentions].filter((m) => m.label).sort((a, b) => b.label.length - a.label.length);
  let rest = line;
  while (rest) {
    let found: { at: number; mention: NoteMention } | null = null;
    for (const mention of byLength) {
      const at = rest.indexOf(`@${mention.label}`);
      if (at >= 0 && (!found || at < found.at)) found = { at, mention };
    }
    if (!found) {
      runs.push(rest);
      break;
    }
    if (found.at) runs.push(rest.slice(0, found.at));
    runs.push(found.mention);
    rest = rest.slice(found.at + found.mention.label.length + 1);
  }
  return runs;
};

const paragraph = (
  parent: Y.XmlFragment | Y.XmlElement,
  line: string,
  mentions: readonly NoteMention[] = [],
) => {
  const p = new Y.XmlElement("paragraph");
  parent.push([p]);
  for (const run of mentionRuns(line, mentions)) {
    if (typeof run === "string") {
      const t = new Y.XmlText();
      p.push([t]);
      t.insert(0, run);
    } else {
      // As the editor's Mention stores it.
      const mention = new Y.XmlElement(MENTION_NODE);
      p.push([mention]);
      mention.setAttribute("id", run.id);
      mention.setAttribute("label", run.label);
      mention.setAttribute("mentionSuggestionChar", "@");
    }
  }
};

/**
 * A document holding plain text, the inverse of `noteText`: one paragraph
 * per line, and runs of "• " lines as a bulleted list. Empty text gives an
 * empty document. For seeds, and anything else that starts from text.
 *
 * Each of `mentions` (a provider: its id and name) becomes a mention node
 * where the text says `@<label>`; one the text doesn't name is added at the
 * end of the last line (or as the only line). So `noteText` reads it back as
 * "@Name". With no mentions the output is as before.
 */
export const noteDocFromText = (text: string, mentions: readonly NoteMention[] = []) => {
  const doc = new Y.Doc();
  const named = mentions.filter((m, i) => m.label && mentions.findIndex((o) => o.id === m.id) === i);
  const lines = text.trim() ? text.trim().split("\n") : [];
  const missing = named.filter((m) => !lines.some((line) => line.includes(`@${m.label}`)));
  if (missing.length) {
    const tail = missing.map((m) => `@${m.label}`).join(" ");
    if (lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]!.trimEnd()} ${tail}`;
    else lines.push(tail);
  }
  doc.transact(() => {
    const fragment = doc.getXmlFragment(NOTE_FRAGMENT);
    let list: Y.XmlElement | null = null;
    for (const line of lines) {
      if (line.startsWith(BULLET)) {
        if (!list) {
          list = new Y.XmlElement("bulletList");
          fragment.push([list]);
        }
        const item = new Y.XmlElement("listItem");
        list.push([item]);
        paragraph(item, line.slice(BULLET.length), named);
      } else {
        list = null;
        paragraph(fragment, line, named);
      }
    }
  });
  return doc;
};

/**
 * The document as plain text: one line per paragraph or heading, "• " for
 * list items, `@<label>` for a mention. For previews, search and AI. Formatting is dropped.
 */
export const noteText = (doc: Y.Doc) =>
  blockLines(doc.getXmlFragment(NOTE_FRAGMENT))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * One line of a section put into a document from outside the editor: a
 * heading (level 2), a subheading (level 3), a bullet (runs of them make one
 * list), or a paragraph (the default).
 */
export type NoteSectionLine = { text: string; style?: "heading" | "subheading" | "bullet" };

const HEADING_LEVEL = { heading: 2, subheading: 3 } as const;

/**
 * Put `lines` into the document's top level from `at` on (the start, or the
 * end), as one Yjs transaction. Returns the update it made.
 */
const putSection = (doc: Y.Doc, lines: readonly NoteSectionLine[], at: "start" | "end") => {
  const before = Y.encodeStateVector(doc);
  doc.transact(() => {
    const fragment = doc.getXmlFragment(NOTE_FRAGMENT);
    let index = at === "start" ? 0 : fragment.length;
    let list: Y.XmlElement | null = null;
    for (const line of lines) {
      if (line.style === "bullet") {
        if (!list) {
          list = new Y.XmlElement("bulletList");
          fragment.insert(index++, [list]);
        }
        const item = new Y.XmlElement("listItem");
        list.push([item]);
        paragraph(item, line.text);
        continue;
      }
      list = null;
      const level =
        line.style === "heading" || line.style === "subheading" ? HEADING_LEVEL[line.style] : null;
      const block = new Y.XmlElement(level ? "heading" : "paragraph");
      fragment.insert(index++, [block]);
      // Tiptap's heading level is a number, as the editor stores it.
      if (level) (block as unknown as Y.XmlElement<{ level: number }>).setAttribute("level", level);
      if (line.text) {
        const t = new Y.XmlText();
        block.push([t]);
        t.insert(0, line.text);
      }
    }
  });
  return Y.encodeStateAsUpdate(doc, before);
};

/**
 * Put `lines` at the very start of the document, as one Yjs transaction,
 * the way the editor would if someone typed them there. Nothing already in
 * the document is changed or moved, so text others type at the same time
 * (here or on another device) is kept when the updates merge. Returns the
 * update it made, to store as a `note_update`.
 */
export const prependNoteSection = (doc: Y.Doc, lines: readonly NoteSectionLine[]) =>
  putSection(doc, lines, "start");

/**
 * Put `lines` at the very end of the document (after its last block), as
 * one Yjs transaction: a connected assistant adding to a note (connectors-2).
 * As with `prependNoteSection`, nothing already there changes, and bullets
 * start a list of their own. Returns the update it made, to store as a
 * `note_update`.
 */
export const appendNoteSection = (doc: Y.Doc, lines: readonly NoteSectionLine[]) =>
  putSection(doc, lines, "end");
