import { type RouteConfigEntry, index, layout, route } from "@react-router/dev/routes";

// The marketing site (web only): prerendered at build (react-router.config.ts);
// its paths are listed in routes/marketing/site/pages.ts. New pages append here.
export const marketingRoutes: RouteConfigEntry[] = [
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
  route("sitemap.xml", "routes/marketing/sitemap/route.ts"),
  route("robots.txt", "routes/marketing/robots/route.ts"),
];
