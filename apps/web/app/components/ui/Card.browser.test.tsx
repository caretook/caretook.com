import { describe, expect, test } from "vitest";

import { renderInRouter } from "../../../test/device";
import { Button, Card } from "./index";

describe("Card", () => {
  test("a titled card is a region named by its title, with its data-section hook and actions", async () => {
    const { screen } = await renderInRouter(
      <Card id="reminders" title="Reminders" actions={<Button size="sm">Edit</Button>} data-extra="x">
        <p>Email me the evening before.</p>
      </Card>,
    );
    const region = screen.getByRole("region", { name: "Reminders" });
    await expect.element(region).toBeVisible();
    await expect.element(region.getByRole("heading", { level: 2, name: "Reminders" })).toBeVisible();
    await expect.element(region.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect.element(region.getByText("Email me the evening before.")).toBeVisible();
    const section = document.querySelector("section")!;
    expect(section.dataset.section).toBe("reminders");
    expect(section.dataset.extra).toBe("x");
  });

  test("an untitled card is a plain surface, not a region", async () => {
    const { screen } = await renderInRouter(
      <Card data-plain="">
        <p>Nothing to name.</p>
      </Card>,
    );
    await expect.element(screen.getByText("Nothing to name.")).toBeVisible();
    await expect.element(screen.getByRole("region")).not.toBeInTheDocument();
    expect(document.querySelector("section")).toBeNull();
    expect(document.querySelector("[data-plain]")).not.toBeNull();
  });
});
