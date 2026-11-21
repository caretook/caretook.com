import { Star } from "lucide-react";
import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { Badge } from "./index";

describe("Badge", () => {
  test("each tone renders with its own colour", async () => {
    const tones = ["neutral", "primary", "success", "warning", "danger", "info"] as const;
    const { screen } = await renderInRouter(
      <>
        {tones.map((tone) => (
          <Badge key={tone} tone={tone} data-tone={tone}>
            {tone}
          </Badge>
        ))}
      </>,
    );
    await expect.element(screen.getByText("danger")).toBeVisible();
    const colours = tones.map(
      (tone) => getComputedStyle(document.querySelector(`[data-tone="${tone}"]`)!).color,
    );
    expect(new Set(colours).size).toBe(tones.length);
  });

  test("passes its data hooks through and takes a decorative icon", async () => {
    await renderInRouter(
      <Badge tone="primary" icon={Star} data-badge="primary">
        Primary contact
      </Badge>,
    );
    const badge = document.querySelector<HTMLElement>('[data-badge="primary"]')!;
    expect(badge.textContent).toBe("Primary contact");
    expect(badge.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
