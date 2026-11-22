import { Pill } from "lucide-react";
import { describe, expect, test } from "vitest";

import { rgba } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { Badge, DetailHeader } from "./index";

const region = (name: string) => document.querySelector<HTMLElement>(`header [data-region="${name}"]`);

describe("DetailHeader", () => {
  test("the title is the page's h1, and each part lands in its region", async () => {
    const { screen } = await renderInRouter(
      <main>
        <DetailHeader
          icon={Pill}
          title="Metformin 500 mg"
          titleProps={{ "data-example-name": "" }}
          badges={<Badge>Stopped</Badge>}
          details="Tablet · 1 with breakfast"
          detailsProps={{ "data-example-details": "" }}
          editors={<span data-person="a">A</span>}
          actions={<button type="button">Edit</button>}
          data-example-header=""
        />
      </main>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Metformin 500 mg" });
    await expect.element(h1).toBeVisible();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(region("title")?.querySelector("h1")?.hasAttribute("data-example-name")).toBe(true);
    expect(region("badges")?.textContent).toBe("Stopped");
    expect(region("title")?.contains(region("badges"))).toBe(true);
    expect(region("details")?.textContent).toBe("Tablet · 1 with breakfast");
    expect(region("details")?.hasAttribute("data-example-details")).toBe(true);
    expect(region("editors")?.querySelector("[data-person]")).toBeTruthy();
    expect(region("actions")?.querySelector("button")?.textContent).toBe("Edit");
    expect(document.querySelector("header[data-example-header]")).toBeTruthy();
    // The icon is decorative.
    expect(region("icon")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("an empty region renders nothing", async () => {
    await renderInRouter(
      <DetailHeader
        icon={Pill}
        title="Lisinopril"
        badges={false}
        details=""
        editors={null}
        actions={false}
      />,
    );
    for (const name of ["badges", "details", "editors", "actions", "media"]) {
      expect(region(name), name).toBeNull();
    }
    expect(region("title")).toBeTruthy();
  });

  test("media replaces the icon", async () => {
    await renderInRouter(
      <DetailHeader icon={Pill} media={<span data-avatar="">MJ</span>} title="Margaret Jones" />,
    );
    expect(region("media")?.querySelector("[data-avatar]")).toBeTruthy();
    expect(region("icon")).toBeNull();
  });

  test.each(["light", "dark"] as const)("the muted tone differs from the primary (%s)", async (theme) => {
    await renderInRouter(
      <>
        <div data-tone-case="primary">
          <DetailHeader icon={Pill} tone="primary" title="Current" />
        </div>
        <div data-tone-case="muted">
          <DetailHeader icon={Pill} tone="muted" title="Stopped" />
        </div>
      </>,
      { theme },
    );
    const paint = (tone: string) => {
      const icon = document.querySelector<HTMLElement>(`[data-tone-case="${tone}"] [data-region="icon"]`)!;
      const style = getComputedStyle(icon);
      return { fill: rgba(style.backgroundColor).join(), text: rgba(style.color).join() };
    };
    const primary = paint("primary");
    const muted = paint("muted");
    expect(muted.fill).not.toBe(primary.fill);
    expect(muted.text).not.toBe(primary.text);
  });
});
