/**
 * The marketing site's shared look: class strings, and nothing else. Every
 * section, the legal page, the header and the footer take their width,
 * rhythm, surfaces and heading sizes from here instead of their own.
 *
 * Theme tokens only (`base-*`, `primary`), so light, dark and a stored app
 * theme all apply. The page tone is the layout's `base-100`; the alternate
 * band is `base-200`. A card reads on either.
 */

/** The page's width and side gutters (16 px on a phone). */
export const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** A section's vertical rhythm. */
export const SECTION = "py-16 sm:py-24";

/** The page tone: a band on the layout's own colour. */
export const BAND_PAGE = "bg-base-100";

/** The alternate tone, set apart from the page's. */
export const BAND_ALT = "bg-base-200";

/** The accent band (the closing call to action, the waitlist). */
export const BAND_ACCENT = "bg-primary text-primary-content";

/**
 * The sticky header's surface: the page tone, nearly opaque and blurred
 * behind; fully opaque, with no blur, under reduced transparency.
 */
export const HEADER_SURFACE =
  "border-b border-base-300 bg-base-100/95 backdrop-blur [@media(prefers-reduced-transparency:reduce)]:bg-base-100 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none";

/** A card: lifted off either band, edged so it holds in dark too. */
export const CARD = "card border border-base-300 bg-base-100 shadow-sm";

/** A form's surface on a band (waitlist, contact). */
export const FORM_SURFACE =
  "rounded-box border border-base-300 bg-base-100 p-5 text-base-content shadow-md sm:p-8";

/** An icon in a soft primary tile, heading a card or a feature. */
export const ICON_TILE = "flex size-12 items-center justify-center rounded-box bg-primary/10 text-primary";

/** The page's opening: a soft primary glow from the top, fading into the page. */
export const OPENING =
  "bg-base-100 bg-radial-[ellipse_at_50%_0%] from-primary/15 via-primary/5 to-transparent to-70%";

/** Heading sizes. */
export const H1 = "text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl";
export const H2 = "text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl";
export const H3 = "text-xl font-semibold";

/** The lead under a page's `h1`, and the quieter intro under an `h2`. */
export const LEAD = "text-lg leading-relaxed text-base-content/80 sm:text-xl";
export const INTRO = "text-lg leading-relaxed text-base-content/80";
