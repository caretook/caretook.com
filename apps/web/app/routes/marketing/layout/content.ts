/**
 * The marketing header's and footer's own words (the page links' text is each
 * page's `label` in `site/pages.ts`). Kept here, not inline, so the claims test
 * (`site/claims.test.ts`) reads them with every page's copy.
 */
export const layoutContent = {
  header: {
    homeLabel: "Caretook home",
    signIn: "Sign in",
    waitlist: "Join the waitlist",
    menu: "Menu",
    navLabel: "Main",
  },
  footer: {
    blurb: "A shared place for a family to keep track of someone's care.",
    siteHeading: "Caretook",
    siteNavLabel: "Site",
    signIn: "Sign in",
    legalHeading: "Legal",
    legalNavLabel: "Legal",
    owner: "Caretook",
  },
} as const;
