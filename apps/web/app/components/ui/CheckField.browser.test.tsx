import { useState } from "react";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { CheckField } from "./index";

describe("CheckField", () => {
  test("clicking its label toggles it", async () => {
    const { screen } = await renderInRouter(<CheckField label="1 hour before" name="lead" />);
    const box = screen.getByRole("checkbox", { name: "1 hour before" });
    await expect.element(box).not.toBeChecked();
    await userEvent.click(screen.getByText("1 hour before"));
    await expect.element(box).toBeChecked();
    await userEvent.click(screen.getByText("1 hour before"));
    await expect.element(box).not.toBeChecked();
  });

  test("its help and error are its description, and an error sets aria-invalid", async () => {
    function Example() {
      const [error, setError] = useState<string>();
      return (
        <>
          <CheckField label="I know them" help="Only invite people you know." error={error} />
          <button type="button" onClick={() => setError("Confirm that you know them.")}>
            Fail
          </button>
        </>
      );
    }
    const { screen } = await renderInRouter(<Example />);
    const box = screen.getByRole("checkbox", { name: "I know them" });
    await expect.element(box).toHaveAccessibleDescription("Only invite people you know.");
    await expect.element(box).not.toHaveAttribute("aria-invalid");

    await userEvent.click(screen.getByRole("button", { name: "Fail" }));
    await expect.element(box).toHaveAttribute("aria-invalid", "true");
    await expect
      .element(box)
      .toHaveAccessibleDescription("Only invite people you know. Confirm that you know them.");
  });

  test("an aria-label names it instead, and the visible label isn't read twice", async () => {
    const { screen } = await renderInRouter(<CheckField label="Locked" aria-label="Lock Sam in easy mode" />);
    await expect.element(screen.getByRole("checkbox", { name: "Lock Sam in easy mode" })).toBeVisible();
    await expect.element(screen.getByText("Locked")).toBeVisible();
  });
});
