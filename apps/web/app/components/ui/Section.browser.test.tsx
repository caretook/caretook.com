import { describe, expect, test } from "vitest";

import { rgba } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { Page, Section } from "./index";

const bg = (el: Element) => rgba(getComputedStyle(el).backgroundColor).join();
const bands = () => [...document.querySelectorAll("main[data-bands] > [data-band]")];

/** A part that renders nothing, as a hidden-by-role or empty part does. */
function Nothing() {
  return null;
}

const References = () => (
  <>
    <div className="bg-base-200" data-ref="base-200" />
    <div className="bg-base-100" data-ref="base-100" />
  </>
);
const ref = (name: string) => bg(document.querySelector(`[data-ref="${name}"]`)!);

describe("Section in a banded Page", () => {
  test.each(["light", "dark"] as const)(
    "bands alternate base-200 and base-100 from the first, also past a part that renders nothing (%s)",
    async (theme) => {
      await renderInRouter(
        <>
          <References />
          <Page bands>
            <Section>
              <h1>Metformin</h1>
            </Section>
            <Section title="Details">a</Section>
            <Nothing />
            <Section title="Refills">b</Section>
            <Section title="Notes">c</Section>
          </Page>
        </>,
        { theme },
      );
      const [page200, card100] = [ref("base-200"), ref("base-100")];
      expect(page200).not.toBe(card100);
      expect(bands().map(bg)).toEqual([page200, card100, page200, card100]);
      // A rule between bands, none above the first.
      const top = bands().map((b) => getComputedStyle(b).borderTopWidth);
      expect(top[0]).toBe("0px");
      expect(top.slice(1).every((w) => w === "1px")).toBe(true);
    },
  );

  test("a band spans the window at 1280 px while its content keeps to the column", async () => {
    await renderInRouter(
      <Page bands>
        <Section title="Details">
          <p data-content="">Once every morning with food.</p>
        </Section>
      </Page>,
      { width: 1280 },
    );
    const band = bands()[0]!.getBoundingClientRect();
    const content = document.querySelector("[data-content]")!.getBoundingClientRect();
    expect(band.width).toBeGreaterThanOrEqual(document.documentElement.clientWidth - 1);
    expect(content.width).toBeLessThan(800);
    expect(content.left).toBeGreaterThan(200);
  });

  test("a titled Section is a region named by its heading; an untitled one isn't a region", async () => {
    const { screen } = await renderInRouter(
      <Page bands>
        <Section>
          <p>Header</p>
        </Section>
        <Section
          title="Refills"
          id="refills"
          actions={<button type="button">Add</button>}
          description="Quiet"
        >
          <p>None yet.</p>
        </Section>
        <Section aria-label="Allergies">
          <p>No known allergies</p>
        </Section>
      </Page>,
    );
    const refills = screen.getByRole("region", { name: "Refills" });
    await expect.element(refills).toBeInTheDocument();
    expect(refills.element().getAttribute("data-section")).toBe("refills");
    await expect.element(refills.getByRole("heading", { level: 2, name: "Refills" })).toBeVisible();
    await expect.element(refills.getByRole("button", { name: "Add" })).toBeVisible();
    await expect.element(screen.getByRole("region", { name: "Allergies" })).toBeInTheDocument();
    expect(document.querySelectorAll("main section")).toHaveLength(2);
  });
});
