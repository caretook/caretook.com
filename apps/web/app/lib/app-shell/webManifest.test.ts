import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { routeRequest, SHELL_PATH } from "./serviceWorkerRoutes";

const PUBLIC = new URL("../../../public/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("site.webmanifest", PUBLIC), "utf8")) as {
  id: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; type: string }[];
};

describe("the web app manifest", () => {
  it("installs as its own window that opens the app", () => {
    expect(manifest).toMatchObject({ id: "/app", start_url: "/app", scope: "/", display: "standalone" });
  });

  it("has the install icons, and each file exists", () => {
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) expect(existsSync(new URL(`.${icon.src}`, PUBLIC))).toBe(true);
  });

  it("starts at a URL the service worker answers with the offline shell", () => {
    const origin = "https://caretook.example";
    const url = new URL(manifest.start_url, origin);
    expect(url.pathname).toBe(SHELL_PATH);
    expect(routeRequest({ url, mode: "navigate" }, origin, new Set())).toBe("shell");
  });
});
