import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { ToggleField } from "./index";

describe("ToggleField", () => {
  test("is a native checkbox with the switch role", async () => {
    const { screen } = await renderInRouter(<ToggleField label="Email me reminders" data-reminders-on="" />);
    const toggle = screen.getByRole("switch", { name: "Email me reminders" });
    await expect.element(toggle).toBeVisible();
    const input = toggle.element() as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("checkbox");
    expect(input.hasAttribute("data-reminders-on")).toBe(true);
  });

  test("clicking its label toggles it", async () => {
    const onChange = vi.fn<(on: boolean) => void>();
    const { screen } = await renderInRouter(
      <ToggleField
        label="Allow members to connect assistants"
        onChange={(e) => onChange(e.target.checked)}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Allow members to connect assistants" });
    await userEvent.click(screen.getByText("Allow members to connect assistants"));
    await expect.element(toggle).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  test("its help and error are its description, and an error sets aria-invalid", async () => {
    const { screen } = await renderInRouter(
      <ToggleField
        label="Include titles, places and providers"
        help="Shown in your own emails."
        error="Couldn't save."
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Include titles, places and providers" });
    await expect.element(toggle).toHaveAttribute("aria-invalid", "true");
    await expect.element(toggle).toHaveAccessibleDescription("Shown in your own emails. Couldn't save.");
  });
});
