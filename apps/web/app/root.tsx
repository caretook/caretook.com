import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";

import stylesheet from "./app.css?url";
import { THEME_SCRIPT } from "./lib/theme";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  // The draft brand icons (public/; marketing slice 1), for every page in both targets.
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before hydration, so React mustn't flag it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Applies the saved theme before first paint (both targets; app-shell slice 2). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh bg-base-200 text-base-content">
        {children}
        <ScrollRestoration />
        <Scripts />
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
