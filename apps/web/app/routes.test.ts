import type { RouteConfigEntry } from "@react-router/dev/routes";

import { describe, expect, it } from "vitest";
import { composeRoutes } from "./routes";

// The route config as one flat list of "full path|file|id", frozen before each
// area's routes moved into its own routes.ts (code-layout PRD). Sorted: only
// what is routed matters, not the order the areas are spread in.
// Adding a route means adding a line here.

const flatten = (routes: RouteConfigEntry[], parent = ""): string[] =>
  routes.flatMap((r) => {
    const path = r.path ? `${parent}/${r.path}` : parent;
    return [
      `${path || "/"}|${r.file}|${r.id ?? ""}${r.index ? "|index" : ""}`,
      ...flatten(r.children ?? [], path),
    ];
  });

const WEB = [
  "/.well-known/oauth-authorization-server/api/auth|routes/connectors/well-known/authorization-server.ts|",
  "/.well-known/oauth-authorization-server|routes/connectors/well-known/authorization-server-root.ts|",
  "/.well-known/oauth-protected-resource/mcp|routes/connectors/well-known/protected-resource.ts|",
  "/.well-known/oauth-protected-resource|routes/connectors/well-known/protected-resource-root.ts|",
  "/about|routes/marketing/about/route.tsx|",
  "/admin/access-codes/:id/print|routes/admin/access-codes-print/route.tsx|",
  "/admin/access-codes|routes/admin/access-codes/route.tsx|",
  "/admin/audit|routes/admin/audit/route.tsx|",
  "/admin/groups/:groupId|routes/admin/group/route.tsx|",
  "/admin/groups|routes/admin/groups/route.tsx|",
  "/admin/new-group|routes/admin/new-group/route.tsx|",
  "/admin/settings|routes/admin/settings/route.tsx|",
  "/admin/suppressions|routes/admin/suppressions/route.tsx|",
  "/admin/users/:userId|routes/admin/user/route.tsx|",
  "/admin/users|routes/admin/users/route.tsx|",
  "/admin/waitlist/export|routes/admin/waitlist-export/route.ts|",
  "/admin/waitlist|routes/admin/waitlist/route.tsx|",
  "/admin|routes/admin/index/route.tsx|",
  "/api/auth/*|routes/api/auth.ts|",
  "/api/cron/calendar|routes/api/cron/calendar.ts|",
  "/api/cron/outbox|routes/api/cron/outbox.ts|",
  "/api/webhooks/resend|routes/api/webhooks/resend.ts|",
  "/app/groups/:groupId/entries/:entryId|routes/app/groups/entry/route.tsx|",
  "/app/groups/:groupId/medications/:medicationId/edit|routes/app/groups/medications/edit/route.tsx|",
  "/app/groups/:groupId/medications/:medicationId|routes/app/groups/medication/route.tsx|",
  "/app/groups/:groupId/medications/allergies|routes/app/groups/medications/allergies/route.tsx|",
  "/app/groups/:groupId/medications/new|routes/app/groups/medications/new/route.tsx|",
  "/app/groups/:groupId/medications/passes|routes/app/groups/medications/passes/route.tsx|",
  "/app/groups/:groupId/medications/print/week|routes/app/groups/medications/print/week/route.tsx|",
  "/app/groups/:groupId/medications/print|routes/app/groups/medications/print/route.tsx|",
  "/app/groups/:groupId/medications|routes/app/groups/medications/route.tsx|",
  "/app/groups/:groupId/periods/:periodId/edit|routes/app/groups/periods/edit/route.tsx|",
  "/app/groups/:groupId/periods/:periodId|routes/app/groups/period/route.tsx|",
  "/app/groups/:groupId/periods/new|routes/app/groups/periods/new/route.tsx|",
  "/app/groups/:groupId/periods|routes/app/groups/periods/route.tsx|",
  "/app/groups/:groupId/profile/basics|routes/app/groups/profile/basics/route.tsx|",
  "/app/groups/:groupId/profile/contact|routes/app/groups/profile/contact/route.tsx|",
  "/app/groups/:groupId/profile/emergency|routes/app/groups/profile/emergency/route.tsx|",
  "/app/groups/:groupId/profile/insurance|routes/app/groups/profile/insurance/route.tsx|",
  "/app/groups/:groupId/profile/print|routes/app/groups/profile/print/route.tsx|",
  "/app/groups/:groupId/profile|routes/app/groups/profile/route.tsx|",
  "/app/groups/:groupId/providers/:providerId/edit|routes/app/groups/providers/edit/route.tsx|",
  "/app/groups/:groupId/providers/:providerId|routes/app/groups/provider/route.tsx|",
  "/app/groups/:groupId/providers/new|routes/app/groups/providers/new/route.tsx|",
  "/app/groups/:groupId/providers|routes/app/groups/providers/route.tsx|",
  "/app/groups/:groupId/search|routes/app/groups/search/route.tsx|",
  "/app/groups/:groupId/settings/assistants|routes/app/groups/settings/assistants/route.tsx|",
  "/app/groups/:groupId/settings/details|routes/app/groups/settings/details/route.tsx|",
  "/app/groups/:groupId/settings/members|routes/app/groups/settings/members/route.tsx|",
  "/app/groups/:groupId/settings|routes/app/groups/settings/index/route.tsx||index",
  "/app/groups/:groupId/settings|routes/app/groups/settings/layout/route.tsx|",
  "/app/groups/:groupId/tasks/:taskId/edit|routes/app/groups/tasks/edit/route.tsx|",
  "/app/groups/:groupId/tasks/:taskId|routes/app/groups/task/route.tsx|",
  "/app/groups/:groupId/tasks/new|routes/app/groups/tasks/new/route.tsx|",
  "/app/groups/:groupId/tasks|routes/app/groups/tasks/route.tsx|",
  "/app/groups/:groupId/timeline/:entryId/edit|routes/app/groups/timeline/edit/route.tsx|",
  "/app/groups/:groupId/timeline/new/:kind|routes/app/groups/timeline/new/route.tsx|",
  "/app/groups/:groupId/timeline/new/dose|routes/app/groups/timeline/new-dose/route.tsx|",
  "/app/groups/:groupId/timeline/pass/:passLogId/edit|routes/app/groups/timeline/pass/route.tsx|",
  "/app/groups/:groupId/timeline|routes/app/groups/timeline/route.tsx|",
  "/app/groups/:groupId/upcoming/past|routes/app/groups/upcoming/past/route.tsx|",
  "/app/groups/:groupId/upcoming|routes/app/groups/upcoming/route.tsx|",
  "/app/groups/:groupId|routes/app/groups/index/route.tsx||index",
  "/app/groups/:groupId|routes/app/groups/layout/route.tsx|group",
  "/app/groups/new|routes/app/groups/new/route.tsx|",
  "/app/settings/account|routes/app/settings/account/route.tsx|",
  "/app/settings/contact|routes/app/settings/contact/route.tsx|",
  "/app/settings/devices|routes/app/settings/devices/route.tsx|",
  "/app/settings/timeline|routes/app/settings/timeline/route.tsx|",
  "/app/settings/units|routes/app/settings/units/route.tsx|",
  "/app/settings|routes/app/settings/index/route.tsx||index",
  "/app/settings|routes/app/settings/layout/route.tsx|",
  "/app|routes/app/home/route.tsx||index",
  "/connect|routes/connectors/connect/route.tsx|",
  "/contact|routes/marketing/contact/route.tsx|",
  "/dev/mail.json|routes/dev/mail/json/route.ts|",
  "/dev/mail/:id|routes/dev/mail/message/route.tsx|",
  "/dev/mail|routes/dev/mail/list/route.tsx|",
  "/faq|routes/marketing/faq/route.tsx|",
  "/features|routes/marketing/features/route.tsx|",
  "/health-data-privacy|routes/marketing/health-data-privacy/route.tsx|",
  "/invite/:token|routes/account/invite/route.tsx|",
  "/join/:code|routes/account/join/route.tsx|",
  "/mcp|routes/connectors/mcp/route.ts|",
  "/privacy|routes/marketing/privacy/route.tsx|",
  "/reset-password|routes/account/reset-password/route.tsx|",
  "/robots.txt|routes/marketing/robots/route.ts|",
  "/rpc/*|routes/rpc.ts|",
  "/sign-in|routes/sign-in.tsx|",
  "/sign-out|routes/sign-out.tsx|",
  "/sitemap.xml|routes/marketing/sitemap/route.ts|",
  "/terms|routes/marketing/terms/route.tsx|",
  "/verify-email|routes/account/verify-email/route.tsx|",
  "/|routes/admin/layout/route.tsx|admin",
  "/|routes/app/layout/route.tsx|app",
  "/|routes/marketing/home/route.tsx||index",
  "/|routes/marketing/layout/route.tsx|marketing",
  "/|routes/web/route.ts|web",
];

const NATIVE = [
  "/app/groups/:groupId/entries/:entryId|routes/app/groups/entry/route.tsx|",
  "/app/groups/:groupId/medications/:medicationId/edit|routes/app/groups/medications/edit/route.tsx|",
  "/app/groups/:groupId/medications/:medicationId|routes/app/groups/medication/route.tsx|",
  "/app/groups/:groupId/medications/allergies|routes/app/groups/medications/allergies/route.tsx|",
  "/app/groups/:groupId/medications/new|routes/app/groups/medications/new/route.tsx|",
  "/app/groups/:groupId/medications/passes|routes/app/groups/medications/passes/route.tsx|",
  "/app/groups/:groupId/medications/print/week|routes/app/groups/medications/print/week/route.tsx|",
  "/app/groups/:groupId/medications/print|routes/app/groups/medications/print/route.tsx|",
  "/app/groups/:groupId/medications|routes/app/groups/medications/route.tsx|",
  "/app/groups/:groupId/periods/:periodId/edit|routes/app/groups/periods/edit/route.tsx|",
  "/app/groups/:groupId/periods/:periodId|routes/app/groups/period/route.tsx|",
  "/app/groups/:groupId/periods/new|routes/app/groups/periods/new/route.tsx|",
  "/app/groups/:groupId/periods|routes/app/groups/periods/route.tsx|",
  "/app/groups/:groupId/profile/basics|routes/app/groups/profile/basics/route.tsx|",
  "/app/groups/:groupId/profile/contact|routes/app/groups/profile/contact/route.tsx|",
  "/app/groups/:groupId/profile/emergency|routes/app/groups/profile/emergency/route.tsx|",
  "/app/groups/:groupId/profile/insurance|routes/app/groups/profile/insurance/route.tsx|",
  "/app/groups/:groupId/profile/print|routes/app/groups/profile/print/route.tsx|",
  "/app/groups/:groupId/profile|routes/app/groups/profile/route.tsx|",
  "/app/groups/:groupId/providers/:providerId/edit|routes/app/groups/providers/edit/route.tsx|",
  "/app/groups/:groupId/providers/:providerId|routes/app/groups/provider/route.tsx|",
  "/app/groups/:groupId/providers/new|routes/app/groups/providers/new/route.tsx|",
  "/app/groups/:groupId/providers|routes/app/groups/providers/route.tsx|",
  "/app/groups/:groupId/search|routes/app/groups/search/route.tsx|",
  "/app/groups/:groupId/settings/assistants|routes/app/groups/settings/assistants/route.tsx|",
  "/app/groups/:groupId/settings/details|routes/app/groups/settings/details/route.tsx|",
  "/app/groups/:groupId/settings/members|routes/app/groups/settings/members/route.tsx|",
  "/app/groups/:groupId/settings|routes/app/groups/settings/index/route.tsx||index",
  "/app/groups/:groupId/settings|routes/app/groups/settings/layout/route.tsx|",
  "/app/groups/:groupId/tasks/:taskId/edit|routes/app/groups/tasks/edit/route.tsx|",
  "/app/groups/:groupId/tasks/:taskId|routes/app/groups/task/route.tsx|",
  "/app/groups/:groupId/tasks/new|routes/app/groups/tasks/new/route.tsx|",
  "/app/groups/:groupId/tasks|routes/app/groups/tasks/route.tsx|",
  "/app/groups/:groupId/timeline/:entryId/edit|routes/app/groups/timeline/edit/route.tsx|",
  "/app/groups/:groupId/timeline/new/:kind|routes/app/groups/timeline/new/route.tsx|",
  "/app/groups/:groupId/timeline/new/dose|routes/app/groups/timeline/new-dose/route.tsx|",
  "/app/groups/:groupId/timeline/pass/:passLogId/edit|routes/app/groups/timeline/pass/route.tsx|",
  "/app/groups/:groupId/timeline|routes/app/groups/timeline/route.tsx|",
  "/app/groups/:groupId/upcoming/past|routes/app/groups/upcoming/past/route.tsx|",
  "/app/groups/:groupId/upcoming|routes/app/groups/upcoming/route.tsx|",
  "/app/groups/:groupId|routes/app/groups/index/route.tsx||index",
  "/app/groups/:groupId|routes/app/groups/layout/route.tsx|group",
  "/app/groups/new|routes/app/groups/new/route.tsx|",
  "/app/settings/account|routes/app/settings/account/route.tsx|",
  "/app/settings/contact|routes/app/settings/contact/route.tsx|",
  "/app/settings/devices|routes/app/settings/devices/route.tsx|",
  "/app/settings/timeline|routes/app/settings/timeline/route.tsx|",
  "/app/settings/units|routes/app/settings/units/route.tsx|",
  "/app/settings|routes/app/settings/index/route.tsx||index",
  "/app/settings|routes/app/settings/layout/route.tsx|",
  "/app|routes/app/home/route.tsx||index",
  "/invite/:token|routes/account/invite/route.tsx|",
  "/join/:code|routes/account/join/route.tsx|",
  "/reset-password|routes/account/reset-password/route.tsx|",
  "/sign-in|routes/sign-in.tsx|",
  "/sign-out|routes/sign-out.tsx|",
  "/verify-email|routes/account/verify-email/route.tsx|",
  "/|routes/app/layout/route.tsx|app",
  "/|routes/native-index.tsx||index",
];

describe("route config", () => {
  it("composes the frozen web routes", () => {
    expect(flatten(composeRoutes(false)).sort()).toEqual(WEB);
  });

  it("composes the frozen native routes", () => {
    expect(flatten(composeRoutes(true)).sort()).toEqual(NATIVE);
  });

  it("has no path, id or file twice", () => {
    for (const native of [false, true]) {
      const flat = flatten(composeRoutes(native));
      expect(new Set(flat).size).toBe(flat.length);
      const ids = flat.map((f) => f.split("|")[2]).filter((id) => id);
      expect(new Set(ids).size).toBe(ids.length);
      const files = flat.map((f) => f.split("|")[1]);
      expect(new Set(files).size).toBe(files.length);
    }
  });
});
