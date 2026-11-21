import type { GuideGroup, GuidePlace } from "~/lib/connectors/connectGuide";
import { AskOwners } from "./ask";

import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SettingsCard } from "~/components/settings";
import {
  CONNECT_CLIENTS,
  COPIED,
  COPY_FAILED,
  GUIDE_INTRO,
  guideView,
  mcpUrl,
} from "~/lib/connectors/connectGuide";

type CopyState = "copied" | "failed" | null;

/**
 * How to connect a member's own Claude or ChatGPT (connectors-2, B-193): the
 * MCP address with Copy, each client's steps and help page. With no group
 * allowing assistants it says so instead; a viewer is told their assistant
 * only reads. With `askGroupId` (a group's page, for a member who isn't an
 * owner), the off note comes with the button that asks the owners to turn
 * it on (slice 2). The wording is `lib/connectors/connectGuide`.
 */
export function ConnectGuide({
  place,
  groups,
  canToggle = false,
  askGroupId,
}: {
  place: GuidePlace;
  groups: readonly GuideGroup[];
  canToggle?: boolean;
  askGroupId?: string;
}) {
  const view = guideView(place, groups, canToggle);
  // Native apps give the web address, not `capacitor://localhost`.
  const url = mcpUrl(import.meta.env.VITE_API_ORIGIN, window.location.origin);
  const urlId = useId();
  const [copy, setCopy] = useState<CopyState>(null);
  useEffect(() => {
    if (copy !== "copied") return;
    const t = setTimeout(() => setCopy(null), 2500);
    return () => clearTimeout(t);
  }, [copy]);

  const copyUrl = async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <SettingsCard id="connect-guide" title="Connect your assistant">
      {view.show === "off" ? (
        <div className="space-y-3">
          <p className="text-sm" data-guide-note="off">
            {view.note}
          </p>
          {askGroupId && <AskOwners groupId={askGroupId} />}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-base-content/70 text-sm">{GUIDE_INTRO}</p>
          {view.viewerNote && (
            <p className="text-sm" data-guide-note="viewer">
              {view.viewerNote}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor={urlId} className="block text-sm font-medium">
              Address
            </label>
            <div className="flex gap-2">
              <input
                id={urlId}
                readOnly
                value={url}
                data-guide-url=""
                onFocus={(e) => e.currentTarget.select()}
                className="input min-w-0 flex-1 font-normal"
              />
              <button type="button" className="btn" onClick={() => void copyUrl()}>
                <Copy aria-hidden="true" className="size-4" />
                Copy
              </button>
            </div>
            <div role="status" data-guide-status="" className="text-success text-sm empty:hidden">
              {copy === "copied" ? COPIED : ""}
            </div>
            {copy === "failed" && (
              <p role="alert" className="text-sm">
                {COPY_FAILED}
              </p>
            )}
          </div>
          {CONNECT_CLIENTS.map((client) => (
            <section
              key={client.id}
              data-guide-client={client.id}
              aria-labelledby={`guide-${client.id}`}
              className="space-y-2"
            >
              <h3 id={`guide-${client.id}`} className="font-medium">
                {client.name}
              </h3>
              <ol className="list-decimal space-y-1 ps-5 text-sm">
                {client.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                href={client.help.href}
                target="_blank"
                rel="noreferrer"
                className="link link-primary inline-flex items-center gap-1 text-sm"
              >
                {client.help.label}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </section>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
