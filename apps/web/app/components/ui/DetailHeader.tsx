import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ICON_LG, TITLE_PAGE } from "./styles";

/** The icon circle's colour: `primary` for a live thing, `muted` for a past or done one. */
export type DetailTone = "primary" | "neutral" | "muted";

const TONE: Record<DetailTone, string> = {
  primary: "bg-primary/15 text-primary",
  neutral: "bg-base-300 text-base-content",
  muted: "bg-base-300 text-muted",
};

type DataAttrs = { [attr: `data-${string}`]: string | undefined };

const shown = (node: ReactNode) => node != null && node !== false && node !== "";

/**
 * A detail page's header (a medication, provider, care period, to-do, the
 * profile), in regions:
 *
 *   [icon] [title, badges ......] [editors] [actions]
 *          [details]
 *
 * - `icon` with `tone`, or `media` for a leading element of the caller's own
 *   (an avatar); decorative either way.
 * - `title` is the page's `h1`; `titleProps` carries its `data-*` hook.
 * - `badges` (`Badge`s, a `ViaTag`) sit beside the title.
 * - `details`: the quiet line (or lines) under it; `detailsProps` its hooks.
 * - `editors`: who is editing the notes now; `actions`: Edit and a ⋯ menu.
 *
 * Every region is marked `data-region`; an empty one renders nothing.
 * `data-*` on the header itself pass through.
 */
export function DetailHeader({
  icon: Icon,
  tone = "primary",
  media,
  title,
  titleProps,
  badges,
  details,
  detailsProps,
  editors,
  actions,
  className = "",
  ...data
}: {
  icon?: LucideIcon;
  tone?: DetailTone;
  media?: ReactNode;
  title: string;
  titleProps?: DataAttrs;
  badges?: ReactNode;
  details?: ReactNode;
  detailsProps?: DataAttrs;
  editors?: ReactNode;
  actions?: ReactNode;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
} & DataAttrs) {
  const hasDetails = shown(details);
  return (
    <header {...data} className={`flex items-start gap-3 ${className}`.trim()}>
      {shown(media) ? (
        <div aria-hidden="true" className="shrink-0" data-region="media">
          {media}
        </div>
      ) : (
        Icon && (
          <span
            aria-hidden="true"
            className={`grid size-9 shrink-0 place-items-center rounded-full ${TONE[tone]}`}
            data-region="icon"
            data-tone={tone}
          >
            <Icon className={ICON_LG} />
          </span>
        )
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div
          data-region="title"
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${hasDetails ? "" : "pt-1"}`.trim()}
        >
          <h1 {...titleProps} className={`${TITLE_PAGE} wrap-break-word`}>
            {title}
          </h1>
          {shown(badges) && (
            <span data-region="badges" className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {badges}
            </span>
          )}
        </div>
        {hasDetails && (
          <div {...detailsProps} data-region="details" className="text-muted text-sm">
            {details}
          </div>
        )}
      </div>
      {shown(editors) && (
        <div data-region="editors" className="flex shrink-0 items-center -space-x-1.5 pt-1">
          {editors}
        </div>
      )}
      {shown(actions) && (
        <div data-region="actions" className="flex shrink-0 items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  );
}
