import type { ShareOutcome } from "./share";

import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { shareLink, shareUrl } from "./share";

/**
 * Share an entry's link: the device's share sheet where there is one,
 * otherwise copy it and say "Link copied". For every member, viewers
 * included: the link grants no access.
 */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  // "Link copied" fades after a moment; a failure stays so the link can be copied by hand.
  useEffect(() => {
    if (outcome !== "copied") return;
    const t = setTimeout(() => setOutcome(null), 2500);
    return () => clearTimeout(t);
  }, [outcome]);

  // Native apps share the web link, not `capacitor://localhost`. Read on
  // the client only (in a handler or after one), never while rendering on the server.
  const linkUrl = () => shareUrl(import.meta.env.VITE_API_ORIGIN || window.location.origin, path);

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-square"
        aria-label="Share"
        title="Share"
        onClick={() => void shareLink(navigator, { title, url: linkUrl() }).then(setOutcome)}
      >
        <Share2 className="size-5" aria-hidden="true" />
      </button>
      <div role="status" className="absolute top-full right-0 z-10 mt-1">
        {outcome === "copied" && (
          <span className="badge badge-neutral whitespace-nowrap shadow">Link copied</span>
        )}
        {outcome === "failed" && (
          <div className="bg-base-100 border-base-300 w-64 rounded-box border p-2 text-sm shadow">
            <p>Couldn't copy the link. Copy it here:</p>
            <input
              readOnly
              aria-label="Link to this entry"
              value={linkUrl()}
              onFocus={(e) => e.currentTarget.select()}
              className="input input-sm mt-1 w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
