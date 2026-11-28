import { Link2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Field, IconButton, useShowModal } from "~/components/ui";

/**
 * Copies an absolute link to `path` (an `appUrls` path): `copy` writes it to
 * the clipboard, and `feedback` says "Link copied" (a polite status, placed
 * under the nearest positioned box) or, where the clipboard fails (no
 * permission, an insecure page), opens a dialog with the link to copy by
 * hand. Copying never navigates, so the timeline's scroll is untouched.
 * `CopyLinkButton` (day headers) and an entry's ⋯ Copy link use it.
 */
export function useCopyLink(path: string) {
  const [outcome, setOutcome] = useState<"copied" | "failed" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useShowModal(dialogRef, outcome === "failed");

  // "Link copied" fades after a moment.
  useEffect(() => {
    if (outcome !== "copied") return;
    const t = setTimeout(() => setOutcome(null), 2500);
    return () => clearTimeout(t);
  }, [outcome]);

  // Native apps link to the web, not `capacitor://localhost`. Read on the
  // client only (in a handler or after one), never while rendering on the server.
  const url = () => new URL(path, import.meta.env.VITE_API_ORIGIN || window.location.origin).href;

  const copy = () => {
    // Called straight from the tap: browsers allow the clipboard only within one.
    // `clipboard` is missing on an insecure page, whatever the types say.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard) return setOutcome("failed");
    clipboard.writeText(url()).then(
      () => setOutcome("copied"),
      () => setOutcome("failed"),
    );
  };

  const feedback = (
    <>
      <div role="status" className="pointer-events-none absolute top-full right-0 mt-1">
        {outcome === "copied" && <Badge className="whitespace-nowrap shadow">Link copied</Badge>}
      </div>
      {/* Empty until it fails, so a row's text stays its own. */}
      <dialog ref={dialogRef} className="modal" aria-labelledby={titleId} onClose={() => setOutcome(null)}>
        {outcome === "failed" && (
          <div className="modal-box">
            <h2 id={titleId} className="text-lg font-semibold">
              Couldn't copy the link
            </h2>
            <p className="mt-2">Copy it here:</p>
            <Field label="The link" labelHidden>
              {(control) => (
                <input
                  {...control}
                  readOnly
                  value={url()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input mt-2 w-full"
                  data-copy-link-url=""
                />
              )}
            </Field>
            <div className="modal-action">
              <Button onClick={() => setOutcome(null)}>Done</Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );

  return { copy, feedback };
}

/**
 * A small link button that copies an absolute link to `path` and says so
 * (`useCopyLink`): a day header's. It sits above a row's stretched open
 * target (`relative z-10`).
 */
export function CopyLinkButton({
  path,
  label,
  className = "",
}: {
  /** The page to link to, as `appUrls` builds it. */
  path: string;
  /** The button's accessible name: "Copy link to Today". */
  label: string;
  className?: string;
}) {
  const { copy, feedback } = useCopyLink(path);
  return (
    <div className={`relative z-10 shrink-0 ${className}`} data-copy-link="">
      <IconButton label={label} icon={Link2} onPress={copy} />
      {feedback}
    </div>
  );
}
