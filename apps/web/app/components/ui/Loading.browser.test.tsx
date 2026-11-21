import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { Loading, Skeleton } from "./index";

describe("Loading", () => {
  test("is a status named by its label, shown beside a spinner", async () => {
    const { screen } = await renderInRouter(<Loading label="Loading…" />);
    const status = screen.getByRole("status", { name: "Loading…" });
    await expect.element(status).toBeVisible();
    await expect.element(status).toHaveTextContent("Loading…");
  });

  test("with lines, a skeleton stands in and the label is for screen readers", async () => {
    const { screen } = await renderInRouter(<Loading label="Loading members…" lines={2} />);
    await expect.element(screen.getByRole("status", { name: "Loading members…" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-skeleton] > *")).toHaveLength(2);
  });
});

describe("Skeleton", () => {
  test("is hidden from assistive tech and draws its lines", async () => {
    await renderInRouter(<Skeleton lines={4} />);
    const skeleton = document.querySelector<HTMLElement>("[data-skeleton]")!;
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.children).toHaveLength(4);
    expect(skeleton.getBoundingClientRect().height).toBeGreaterThan(0);
  });
});
