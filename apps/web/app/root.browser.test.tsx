import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, test } from "vitest";

import { Layout, links } from "./root";

// The document head's install tags (onboarding slice 2), on every page.

const head = () => {
  const Stub = createRoutesStub([{ path: "/", Component: () => null }]);
  const html = renderToStaticMarkup(
    <Layout>
      <Stub />
    </Layout>,
  );
  return new DOMParser().parseFromString(html, "text/html").head;
};

describe("the root document", () => {
  test("links the manifest once", () => {
    expect(links().filter((l) => "rel" in l && l.rel === "manifest")).toEqual([
      { rel: "manifest", href: "/site.webmanifest" },
    ]);
  });

  test("carries the web-app meta tags iOS reads", () => {
    const content = (name: string) => head().querySelector(`meta[name="${name}"]`)?.getAttribute("content");
    expect(content("mobile-web-app-capable")).toBe("yes");
    expect(content("apple-mobile-web-app-capable")).toBe("yes");
    expect(content("apple-mobile-web-app-title")).toBe("Caretook");
    expect(content("apple-mobile-web-app-status-bar-style")).toBe("default");
  });
});
