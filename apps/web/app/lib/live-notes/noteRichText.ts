import { MENTION_NODE, NOTE_FRAGMENT } from "@caretook/data/schema";
import * as Y from "yjs";

// A live document's formatting, read straight from its Yjs tree (the
// editor's ProseMirror nodes, as Tiptap's Collaboration stores them), for
// read-only display without loading the editor (Tiptap stays off the
// timeline's chunk). Pure: callers build the Y.Doc and render the blocks.

/** The inline marks the editor can set (StarterKit's), by their ProseMirror names. */
export type NoteMark = "bold" | "italic" | "strike" | "code" | "underline";
const MARKS = new Set<string>(["bold", "italic", "strike", "code", "underline"]);

export type NoteInline =
  | { kind: "text"; text: string; marks: NoteMark[] }
  /** A provider mention: its id and the name it was typed with. */
  | { kind: "mention"; id: string | null; label: string }
  | { kind: "break" };

export type NoteBlock =
  | { kind: "paragraph" | "codeBlock"; content: NoteInline[] }
  | { kind: "heading"; level: number; content: NoteInline[] }
  | { kind: "bulletList" | "listItem" | "blockquote"; children: NoteBlock[] }
  | { kind: "orderedList"; start: number; children: NoteBlock[] }
  | { kind: "rule" };

// y-tiptap names an overlapping mark `<name>--<hash>`.
const markName = (attr: string) => attr.replace(/--[a-zA-Z0-9+/=]{8}$/, "");

const textRuns = (text: Y.XmlText): NoteInline[] =>
  (text.toDelta() as { insert?: unknown; attributes?: Record<string, unknown> }[]).flatMap((op) => {
    if (typeof op.insert !== "string" || !op.insert) return [];
    const marks = Object.keys(op.attributes ?? {})
      .map(markName)
      .filter((m): m is NoteMark => MARKS.has(m));
    return [{ kind: "text" as const, text: op.insert, marks }];
  });

const inlines = (node: Y.XmlElement | Y.XmlText): NoteInline[] => {
  if (node instanceof Y.XmlText) return textRuns(node);
  if (node.nodeName === "hardBreak") return [{ kind: "break" }];
  if (node.nodeName === MENTION_NODE) {
    const id = node.getAttribute("id");
    return [
      {
        kind: "mention",
        id: typeof id === "string" ? id : null,
        label: String(node.getAttribute("label") ?? ""),
      },
    ];
  }
  return node
    .toArray()
    .flatMap((child) => (child instanceof Y.XmlElement || child instanceof Y.XmlText ? inlines(child) : []));
};

const CONTAINERS = new Set(["bulletList", "listItem", "blockquote", "orderedList"]);

const blocks = (node: Y.XmlFragment | Y.XmlElement): NoteBlock[] =>
  node.toArray().flatMap((child): NoteBlock[] => {
    if (child instanceof Y.XmlText) return [{ kind: "paragraph", content: inlines(child) }];
    if (!(child instanceof Y.XmlElement)) return [];
    const name = child.nodeName;
    if (name === "paragraph" || name === "codeBlock") return [{ kind: name, content: inlines(child) }];
    if (name === "heading") {
      const level = Number(child.getAttribute("level"));
      return [
        {
          kind: "heading",
          level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2,
          content: inlines(child),
        },
      ];
    }
    if (name === "horizontalRule") return [{ kind: "rule" }];
    if (name === "orderedList") {
      const start = Number(child.getAttribute("start") ?? 1);
      return [{ kind: "orderedList", start: Number.isInteger(start) ? start : 1, children: blocks(child) }];
    }
    if (CONTAINERS.has(name)) {
      return [{ kind: name as "bulletList" | "listItem" | "blockquote", children: blocks(child) }];
    }
    // Anything else (a node a newer editor added): its blocks, in order, like `noteText`.
    return blocks(child);
  });

/** The document's blocks, with their inline marks and mentions. Empty for an empty document. */
export const noteRichText = (doc: Y.Doc): NoteBlock[] => blocks(doc.getXmlFragment(NOTE_FRAGMENT));
