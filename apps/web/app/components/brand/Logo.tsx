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

/**
 * The mark plus "Caretook". With `wordHiddenBelow`, the word is screen-reader
 * text below that breakpoint (the mark stays), so a link around it keeps the
 * name "Caretook" on narrow screens.
 */
export function Wordmark({ wordHiddenBelow }: { wordHiddenBelow?: "sm" }) {
  const hidden = wordHiddenBelow === "sm" ? "max-sm:sr-only" : "";
  return (
    <span className="flex items-center gap-2">
      <LogoMark className="size-8 shrink-0" />
      <span className={`text-xl font-bold tracking-tight ${hidden}`}>Caretook</span>
    </span>
  );
}
