/**
 * The draft Caretook mark (a heart with a check, in a rounded square) and
 * wordmark, drawn inline so it follows the theme's primary color. The same
 * drawing is in `public/favicon.svg` and the PNG icons; replace all of them
 * together when the brand changes.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path
        d="M32 49C16 39 11 30 14 22.5 17 15.5 27 14.5 32 22c5-7.5 15-6.5 18 .5 3 7.5-2 16.5-18 26.5Z"
        fill="none"
        strokeWidth="4"
        strokeLinejoin="round"
        className="stroke-primary-content"
      />
      <path
        d="m24 31.5 5.5 5.5L40 26.5"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-content"
      />
    </svg>
  );
}

/** The name and tagline, in one place: the logo, the hero, page titles and the share image use them. */
export const BRAND = { name: "Caretook", tagline: "Care, taken." } as const;

const SIZES = {
  header: { gap: "gap-2", mark: "size-9", name: "text-xl", tagline: "-mt-px text-xs leading-none" },
  hero: {
    gap: "gap-4 sm:gap-5",
    mark: "size-16 sm:size-24",
    name: "text-5xl sm:text-7xl",
    tagline: "-mt-0.5 text-xl leading-none sm:-mt-1.5 sm:text-3xl",
  },
} as const;

/**
 * The full logo: the mark, "Caretook" in bold, and the tagline tucked just
 * under it, smaller, at the body's weight. `header` fits the 64px bars;
 * `hero` is home's h1 (the caller wraps it; the mark is hidden, so the
 * heading's name is "Caretook Care, taken."). With `wordHiddenBelow`, the
 * words are screen-reader text below that breakpoint (the mark stays), so a
 * link around it keeps its name on narrow screens.
 */
export function FullLogo({
  size = "header",
  wordHiddenBelow,
}: {
  size?: keyof typeof SIZES;
  wordHiddenBelow?: "sm";
}) {
  const s = SIZES[size];
  const hidden = wordHiddenBelow === "sm" ? "max-sm:sr-only" : "";
  return (
    <span className={`flex items-center ${s.gap}`} data-logo>
      <LogoMark className={`${s.mark} shrink-0`} />
      <span className={`flex flex-col ${hidden}`}>
        <span className={`${s.name} leading-none font-bold tracking-tight`} data-logo-part="name">
          {BRAND.name}
        </span>{" "}
        <span className={`${s.tagline} font-normal text-primary-ink`} data-logo-part="tagline">
          {BRAND.tagline}
        </span>
      </span>
    </span>
  );
}
