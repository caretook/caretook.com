import type { ReactNode } from "react";
import type { NoteBlock, NoteInline, NoteMark } from "~/lib/live-notes/noteRichText";

import { Highlight } from "~/components/ui";
import type { HighlightRange } from "@caretook/data/domain";

type Marks = (text: string) => HighlightRange[] | undefined;

const HEADING_CLASS = "font-semibold";
const HEADING_SIZE = ["text-lg", "text-lg", "text-base", "text-base", "text-base", "text-base"];

/**
 * A live note's or event's text with its formatting (headings, lists,
 * quotes, bold and the other marks, mentions as chips), read-only, styled
 * like the editor (`.live-notes`). Without loading the editor: the blocks come
 * from the document's Yjs tree (`noteRichText`). Search matches are marked
 * within each run of text, so a match across a formatting change isn't.
 */
export function NoteRichText({
  blocks,
  marks,
  className = "",
}: {
  blocks: readonly NoteBlock[];
  marks: Marks;
  className?: string;
}) {
  return (
    <div className={`live-notes ${className}`} data-rich-text>
      <Blocks blocks={blocks} marks={marks} />
    </div>
  );
}

function Blocks({ blocks, marks }: { blocks: readonly NoteBlock[]; marks: Marks }) {
  return blocks.map((block, i) => <Block key={i} block={block} marks={marks} />);
}

function Block({ block, marks }: { block: NoteBlock; marks: Marks }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p>
          <Inlines content={block.content} marks={marks} />
        </p>
      );
    case "codeBlock":
      return (
        <pre className="whitespace-pre-wrap">
          <code>
            <Inlines content={block.content} marks={marks} />
          </code>
        </pre>
      );
    case "heading": {
      const Tag = `h${block.level}` as "h1";
      return (
        <Tag className={`${HEADING_CLASS} ${HEADING_SIZE[block.level - 1] ?? "text-base"}`}>
          <Inlines content={block.content} marks={marks} />
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul>
          <Blocks blocks={block.children} marks={marks} />
        </ul>
      );
    case "orderedList":
      return (
        <ol start={block.start === 1 ? undefined : block.start}>
          <Blocks blocks={block.children} marks={marks} />
        </ol>
      );
    case "listItem":
      return (
        <li>
          <Blocks blocks={block.children} marks={marks} />
        </li>
      );
    case "blockquote":
      return (
        <blockquote>
          <Blocks blocks={block.children} marks={marks} />
        </blockquote>
      );
    case "rule":
      return <hr className="border-base-300" />;
  }
}

function Inlines({ content, marks }: { content: readonly NoteInline[]; marks: Marks }) {
  return content.map((inline, i) => {
    if (inline.kind === "break") return <br key={i} />;
    if (inline.kind === "mention") {
      // As the editor's chip (without its link: the card's tap opens the entry).
      return (
        <span key={i} data-mention={inline.id ?? ""} className="bg-primary/10 rounded px-1 font-medium">
          <Highlight text={inline.label} ranges={marks(inline.label)} />
        </span>
      );
    }
    return (
      <Marked key={i} marks={inline.marks}>
        <Highlight text={inline.text} ranges={marks(inline.text)} />
      </Marked>
    );
  });
}

function Marked({ marks, children }: { marks: readonly NoteMark[]; children: ReactNode }) {
  return marks.reduce<ReactNode>((inner, mark) => {
    switch (mark) {
      case "bold":
        return <strong>{inner}</strong>;
      case "italic":
        return <em>{inner}</em>;
      case "strike":
        return <s>{inner}</s>;
      case "underline":
        return <u>{inner}</u>;
      case "code":
        return <code>{inner}</code>;
    }
  }, children);
}
