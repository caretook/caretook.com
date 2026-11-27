import type { RouteManifest } from "./preloadRoutes";

import { describe, expect, it } from "vitest";
import { landingChunks, landingPaths, preloadModules } from "./preloadRoutes";

// The shape of the web build's manifest around /app (ids, paths and parents as
// React Router writes them; chunk names made up).
const manifest: RouteManifest = {
  routes: {
    root: { id: "root", path: "", module: "/assets/root.js", imports: ["/assets/react.js"] },
    "sign-in": { id: "sign-in", parentId: "root", path: "sign-in", module: "/assets/sign-in.js" },
    app: {
      id: "app",
      parentId: "root",
      module: "/assets/app.js",
      imports: ["/assets/react.js", "/assets/ui.js"],
      clientLoaderModule: "/assets/app-loader.js",
      clientMiddlewareModule: "/assets/app-middleware.js",
    },
    home: { id: "home", parentId: "app", path: "app", index: true, module: "/assets/home.js" },
    settings: { id: "settings", parentId: "app", path: "app/settings", module: "/assets/settings.js" },
    group: {
      id: "group",
      parentId: "app",
      path: "app/groups/:groupId",
      module: "/assets/group.js",
      imports: ["/assets/ui.js"],
      clientLoaderModule: "/assets/group-loader.js",
    },
    timeline: {
      id: "timeline",
      parentId: "group",
      path: "timeline",
      module: "/assets/timeline.js",
      imports: ["/assets/quickEntry.js", "/assets/medications.js"],
    },
    providers: { id: "providers", parentId: "group", path: "providers", module: "/assets/providers.js" },
  },
};

describe("landingPaths", () => {
  it("adds a group's timeline for /app's home, which goes on to the member's group", () => {
    const [home, timeline] = landingPaths("/app");
    expect(home).toBe("/app");
    expect(timeline).toMatch(/^\/app\/groups\/[^/]+\/timeline$/);
  });

  it("keeps any other target, and the group list, as it is", () => {
    expect(landingPaths("/app/settings/units")).toEqual(["/app/settings/units"]);
    expect(landingPaths("/app?groups=1")).toEqual(["/app"]);
  });
});

describe("landingChunks", () => {
  it("lists every chunk of the frame, the home and the timeline after a sign-in to /app, once each", () => {
    expect(landingChunks(manifest, landingPaths("/app"))).toEqual([
      "/assets/root.js",
      "/assets/react.js",
      "/assets/app-middleware.js",
      "/assets/app-loader.js",
      "/assets/app.js",
      "/assets/ui.js",
      "/assets/home.js",
      "/assets/group-loader.js",
      "/assets/group.js",
      "/assets/timeline.js",
      "/assets/quickEntry.js",
      "/assets/medications.js",
    ]);
  });

  it("lists only the matched routes for a deep link", () => {
    const chunks = landingChunks(manifest, landingPaths("/app/groups/g1/providers"));
    expect(chunks).toContain("/assets/providers.js");
    expect(chunks).toContain("/assets/group.js");
    expect(chunks).not.toContain("/assets/timeline.js");
    expect(chunks).not.toContain("/assets/home.js");
  });

  it("lists nothing for a path no route matches", () => {
    expect(landingChunks(manifest, ["/nowhere/at/all"])).toEqual([]);
  });
});

/** Just enough of a document for `preloadModules`: a head that holds links. */
function fakeDocument(existing: string[] = []) {
  type Link = { rel: string; href: string; getAttribute: (name: string) => string };
  const links: Link[] = [];
  const createElement = () => {
    const link: Link = { rel: "", href: "", getAttribute: () => link.href };
    return link;
  };
  const head = {
    append: (link: Link) => links.push(link),
    querySelectorAll: () => links.filter((l) => l.rel === "modulepreload"),
  };
  for (const href of existing) {
    const link = createElement();
    link.rel = "modulepreload";
    link.href = href;
    head.append(link);
  }
  return { doc: { head, createElement } as unknown as Document, links };
}

describe("preloadModules", () => {
  it("adds one modulepreload link per chunk not linked yet", () => {
    const { doc, links } = fakeDocument(["/assets/ui.js"]);
    expect(preloadModules(["/assets/ui.js", "/assets/timeline.js", "/assets/timeline.js"], doc)).toBe(1);
    expect(links.map((l) => [l.rel, l.href])).toEqual([
      ["modulepreload", "/assets/ui.js"],
      ["modulepreload", "/assets/timeline.js"],
    ]);
  });
});
