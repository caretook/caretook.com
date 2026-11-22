import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";

import stylesheet from "./app.css?url";
import fontSans from "./fonts/AtkinsonHyperlegibleNext-Variable.woff2?url";
import { useDocumentCsp } from "./lib/security-headers/csp";
import { BUILD_APP_ENV, robotsMeta } from "./lib/marketing/noindex";
import { THEME_SCRIPT } from "./lib/app-shell/theme";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  // The upright face (B-415), by the same hashed URL app.css's @font-face uses,
  // so the text's first paint doesn't wait for the stylesheet to find it.
  { rel: "preload", href: fontSans, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  // The draft brand icons (public/; marketing slice 1), for every page in both targets.
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
];

// Staging's builds ask search engines to stay away from every page (hosting slice 1).
const ROBOTS = robotsMeta(BUILD_APP_ENV);

export function Layout({ children }: { children: React.ReactNode }) {
  // The server's nonce and policy (entry.server.tsx). In the browser there's
  // neither, and the nonce is "": browsers hide a nonce attribute's value, so
  // "" is what hydration finds there.
  const { nonce = "", policy } = useDocumentCsp();
  return (
    // The theme script sets data-theme before hydration, so React mustn't flag it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {ROBOTS && <meta name={ROBOTS.name} content={ROBOTS.content} />}
        {/* The CSP for pages served as files (prerendered, native); before any script. */}
        {policy && <meta httpEquiv="Content-Security-Policy" content={policy} />}
        {/* Applies the saved theme before first paint (both targets; app-shell slice 2).
            The CSP allows it by its hash (THEME_SCRIPT_HASH). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Meta />
        {/* No nonce on links: stylesheets and module preloads are allowed by
            'self', and an explicit "" keeps React Router from adding one
            (browsers don't hide it there, so hydration would differ). */}
        <Links nonce="" />
      </head>
      <body className="min-h-dvh bg-base-200 text-base-content">
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// Shown while the native SPA boots (required for ssr: false).
export function HydrateFallback() {
  return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Error";
  let details = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "Page not found." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="mt-2">{details}</p>
    </main>
  );
}
