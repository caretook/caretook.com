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

const paragraph = (parent: Y.XmlFragment | Y.XmlElement, line: string) => {
  const p = new Y.XmlElement("paragraph");
  parent.push([p]);
  if (line) {
    const t = new Y.XmlText();
    p.push([t]);
    t.insert(0, line);
  }
};

/**
 * A document holding plain text, the inverse of `noteText`: one paragraph
 * per line, and runs of "• " lines as a bulleted list. Empty text gives an
 * empty document. For seeds, and anything else that starts from text.
 */
export const noteDocFromText = (text: string) => {
  const doc = new Y.Doc();
  const lines = text.trim() ? text.trim().split("\n") : [];
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
        paragraph(item, line.slice(BULLET.length));
      } else {
        list = null;
        paragraph(fragment, line);
      }
    }
  });
  return doc;
};

/**
 * The document as plain text: one line per paragraph or heading, "• " for
 * list items. For previews, search and AI. Formatting is dropped.
 */
export const noteText = (doc: Y.Doc) =>
  blockLines(doc.getXmlFragment(NOTE_FRAGMENT))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
