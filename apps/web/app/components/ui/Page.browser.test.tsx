import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { Page, PageHeader } from "./index";

describe("Page", () => {
  test("is the page's one main, and passes data-* through", async () => {
    const { screen } = await renderInRouter(
      <Page data-example-page="x">
        <PageHeader title="Example" />
      </Page>,
    );
    const mains = document.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]?.getAttribute("data-example-page")).toBe("x");
    await expect.element(screen.getByRole("heading", { level: 1, name: "Example" })).toBeVisible();
  });

  test("width wide is wider than the default at 1280 px", async () => {
    await renderInRouter(
      <>
        <Page data-w="default">
          <p>a</p>
        </Page>
        <Page width="wide" data-w="wide">
          <p>b</p>
        </Page>
      </>,
      { width: 1280 },
    );
    const width = (w: string) => document.querySelector(`[data-w="${w}"]`)!.getBoundingClientRect().width;
    expect(width("wide")).toBeGreaterThan(width("default"));
  });

  test("PageHeader shows its description under the title", async () => {
    const { screen } = await renderInRouter(<PageHeader title="Passes" description="The rounds." />);
    await expect.element(screen.getByRole("heading", { level: 1, name: "Passes" })).toBeVisible();
    await expect.element(screen.getByText("The rounds.")).toBeVisible();
  });
});
