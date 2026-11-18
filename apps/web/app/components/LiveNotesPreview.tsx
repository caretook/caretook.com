import { FileText } from "lucide-react";
import { Link } from "react-router";

export type LiveNotes = { preview: string; url: string };

/**
 * An entry's live document on the timeline: the first lines of its text and
 * a link to open it. The text is rebuilt on the device, so it includes edits
 * that haven't synced yet.
 */
export function LiveNotesPreview({ notes, entryLabel }: { notes: LiveNotes; entryLabel: string }) {
  return (
    <div className="border-base-300 mt-1 flex items-start gap-2 border-l-2 pl-2">
      <FileText className="text-base-content/60 mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-base-content/80 line-clamp-2 break-words whitespace-pre-wrap">
          {notes.preview || (
            <span className="text-base-content/60 italic">Live notes, nothing written yet</span>
          )}
        </p>
        <Link
          to={notes.url}
          className="link link-hover font-medium"
          aria-label={`Open live notes for ${entryLabel}`}
        >
          Open live notes
        </Link>
      </div>
    </div>
  );
}
