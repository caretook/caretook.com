import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

import { isNative } from "../build-target";

// Shared app screens: client-only data (local DB + oRPC). Present in both targets.
// Each route module is `route.tsx` in its own folder, beside the files only it uses.
// Nested where the UI is nested: the group route loads the group once for every
// screen inside it. Later group sections (Medications, Providers…) are new
// children of `groups/:groupId`, appended at the end of its list.
const appRoutes = [
  ...prefix("app", [
    layout("routes/app/layout/route.tsx", { id: "app" }, [
      index("routes/app/home/route.tsx"),
      route("settings", "routes/app/settings/layout/route.tsx", [
        index("routes/app/settings/index/route.tsx"),
        route("units", "routes/app/settings/units/route.tsx"),
        route("timeline", "routes/app/settings/timeline/route.tsx"),
        route("account", "routes/app/settings/account/route.tsx"),
        route("contact", "routes/app/settings/contact/route.tsx"),
      ]),
      route("groups/:groupId", "routes/app/groups/layout/route.tsx", { id: "group" }, [
        index("routes/app/groups/index/route.tsx"),
        route("timeline", "routes/app/groups/timeline/route.tsx", [
          // Sheets over the timeline, which stays mounted underneath.
          route("new/:kind", "routes/app/groups/timeline/new/route.tsx"),
          route(":entryId/edit", "routes/app/groups/timeline/edit/route.tsx"),
          // The Dose sheet (a static segment, so it wins over `new/:kind`).
          route("new/dose", "routes/app/groups/timeline/new-dose/route.tsx"),
        ]),
        route("entries/:entryId", "routes/app/groups/entry/route.tsx"),
        route("settings", "routes/app/groups/settings/layout/route.tsx", [
          index("routes/app/groups/settings/index/route.tsx"),
          route("details", "routes/app/groups/settings/details/route.tsx"),
          route("members", "routes/app/groups/settings/members/route.tsx"),
        ]),
        route("providers", "routes/app/groups/providers/route.tsx", [
          // Sheets over the directory, which stays mounted underneath.
          route("new", "routes/app/groups/providers/new/route.tsx"),
          route(":providerId/edit", "routes/app/groups/providers/edit/route.tsx"),
        ]),
        route("providers/:providerId", "routes/app/groups/provider/route.tsx"),
        // The medication list (its sheets come as its children) and a medication's page.
        route("medications", "routes/app/groups/medications/route.tsx", [
          // Sheets over the list, which stays mounted underneath (`new` is
          // static, so it ranks above the page's `:medicationId`).
          route("new", "routes/app/groups/medications/new/route.tsx"),
          route(":medicationId/edit", "routes/app/groups/medications/edit/route.tsx"),
        ]),
        route("medications/:medicationId", "routes/app/groups/medication/route.tsx"),
        // The printable sheet (a static segment, so it ranks above `:medicationId`).
        route("medications/print", "routes/app/groups/medications/print/route.tsx"),
        // Appointments and reminders still to come, and the Past tab (past events).
        route("upcoming", "routes/app/groups/upcoming/route.tsx"),
        route("upcoming/past", "routes/app/groups/upcoming/past/route.tsx"),
        // The care recipient's profile (not a section), with its edit sheets over it.
        route("profile", "routes/app/groups/profile/route.tsx", [
          route("basics", "routes/app/groups/profile/basics/route.tsx"),
          route("contact", "routes/app/groups/profile/contact/route.tsx"),
          route("insurance", "routes/app/groups/profile/insurance/route.tsx"),
          route("emergency", "routes/app/groups/profile/emergency/route.tsx"),
        ]),
        // The printable emergency sheet: a page of its own, not a sheet over the profile.
        route("profile/print", "routes/app/groups/profile/print/route.tsx"),
        // Search the group's entries, providers and medications (not a section; the header's magnifier).
        route("search", "routes/app/groups/search/route.tsx"),
      ]),
      // Start another care group (a sheet over its own page; not a group route).
      route("groups/new", "routes/app/groups/new/route.tsx"),
    ]),
  ]),
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  // Signed-out account pages, reached from emailed links and from sign-in.
  route("reset-password", "routes/account/reset-password/route.tsx"),
  route("verify-email", "routes/account/verify-email/route.tsx"),
  // An emailed invite's link: sign up or sign in, agree, join (or decline).
  route("invite/:token", "routes/account/invite/route.tsx"),
  // A staff access code's link (or QR): an account and a new care group.
  route("join/:code", "routes/account/join/route.tsx"),
];

// Web-only: marketing, auth callbacks, anything needing server loaders.
const webRoutes = [
  // The marketing site: prerendered at build (react-router.config.ts); its
  // paths are listed in routes/marketing/site/pages.ts. New pages append here.
  layout("routes/marketing/layout/route.tsx", { id: "marketing" }, [
    index("routes/marketing/home/route.tsx"),
    route("features", "routes/marketing/features/route.tsx"),
    route("faq", "routes/marketing/faq/route.tsx"),
    route("about", "routes/marketing/about/route.tsx"),
    route("contact", "routes/marketing/contact/route.tsx"),
    route("privacy", "routes/marketing/privacy/route.tsx"),
    route("terms", "routes/marketing/terms/route.tsx"),
    route("health-data-privacy", "routes/marketing/health-data-privacy/route.tsx"),
  ]),
  route("api/auth/*", "routes/api/auth.ts"),
  route("rpc/*", "routes/rpc.ts"),
  route("sitemap.xml", "routes/marketing/sitemap/route.ts"),
  route("robots.txt", "routes/marketing/robots/route.ts"),
  // The outbox sweep (CRON_SECRET) and the dev mailbox (404 in production).
  route("api/cron/outbox", "routes/api/cron/outbox.ts"),
  route("dev/mail", "routes/dev/mail/list/route.tsx"),
  route("dev/mail.json", "routes/dev/mail/json/route.ts"),
  route("dev/mail/:id", "routes/dev/mail/message/route.tsx"),
  // Caretook staff only (global admin): access codes and staff-made groups.
  layout("routes/admin/layout/route.tsx", { id: "admin" }, [
    route("admin", "routes/admin/index/route.tsx"),
    route("admin/access-codes", "routes/admin/access-codes/route.tsx"),
    route("admin/new-group", "routes/admin/new-group/route.tsx"),
    route("admin/waitlist", "routes/admin/waitlist/route.tsx"),
  ]),
  route("admin/access-codes/:id/print", "routes/admin/access-codes-print/route.tsx"),
  route("admin/waitlist/export", "routes/admin/waitlist-export/route.ts"),
];

// Native-only: the bundled app has no marketing site, so "/" goes straight to /app.
const nativeRoutes = [index("routes/native-index.tsx")];

// The web-only routes sit in a pathless layout whose middleware adds the
// security headers to resource routes (routes/web/route.ts; documents get them
// in entry.server.tsx).
export default [
  ...(isNative ? nativeRoutes : [layout("routes/web/route.ts", { id: "web" }, webRoutes)]),
  ...appRoutes,
] satisfies RouteConfig;
