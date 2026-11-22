import type { DeviceOptions, RouteModule } from "../../../test/device";

import { renderWithDevice } from "../../../test/device";
import * as about from "./about/route";
import * as contact from "./contact/route";
import * as faq from "./faq/route";
import * as features from "./features/route";
import * as healthDataPrivacy from "./health-data-privacy/route";
import * as home from "./home/route";
import * as layout from "./layout/route";
import * as privacy from "./privacy/route";
import { MARKETING_LINKS } from "./site/pages";
import * as terms from "./terms/route";

// The marketing site on the test device: the real layout (skip link, header,
// footer) around each page, as routes/marketing/routes.ts nests them. The
// layout's server loader only gives the canonical origin, for meta tags.

export const SITE_URL = "https://caretook.test";

const PAGES: [string, RouteModule][] = [
  ["/", home],
  ["/features", features],
  ["/faq", faq],
  ["/about", about],
  ["/contact", contact],
  ["/privacy", privacy],
  ["/terms", terms],
  ["/health-data-privacy", healthDataPrivacy],
];

/** Where the site's links leave it (sign-in, access codes): a stand-in page each, so `location()` follows. */
const OUTSIDE: [string, RouteModule][] = [
  [MARKETING_LINKS.signIn, { default: () => <p>Sign-in stand-in</p> }],
  [MARKETING_LINKS.join, { default: () => <p>Join stand-in</p> }],
];

/** Open a marketing page at `url` (a path, with any search). The device is offline unless `api` answers. */
export const openMarketing = (url: string, options: Omit<DeviceOptions, "route" | "url" | "element"> = {}) =>
  renderWithDevice({
    ...options,
    route: [
      {
        id: "marketing",
        path: "/",
        module: layout,
        loaderData: { siteUrl: SITE_URL },
        children: PAGES.map(([path, module]) => ({ path, module })),
      },
      ...OUTSIDE.map(([path, module]) => ({ path, module })),
    ],
    url,
  });

/** Whether the page scrolls sideways at the current width. */
export const scrollsSideways = () => document.documentElement.scrollWidth > window.innerWidth;
