import type { ShareOutcome } from "./share";

import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Field, IconButton } from "~/components/ui";
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
      <IconButton
        label="Share"
        icon={Share2}
        onPress={() => void shareLink(navigator, { title, url: linkUrl() }).then(setOutcome)}
      />
      <div role="status" className="absolute top-full right-0 z-10 mt-1">
        {outcome === "copied" && <Badge className="whitespace-nowrap shadow">Link copied</Badge>}
        {outcome === "failed" && (
          <div className="bg-base-100 border-base-300 w-64 rounded-box border p-2 text-sm shadow">
            <p>Couldn't copy the link. Copy it here:</p>
            <Field label="Link to this entry" labelHidden>
              {(control) => (
                <input
                  {...control}
                  readOnly
                  value={linkUrl()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input input-sm mt-1 w-full"
                />
              )}
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
