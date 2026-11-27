import { WifiOff } from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { renderInRouter } from "../../../test/device";
import { Notice } from "./index";

describe("Notice", () => {
  test("an error notice is an alert, the other tones statuses", async () => {
    const { screen } = await renderInRouter(
      <>
        <Notice tone="error">This entry was deleted.</Notice>
        <Notice tone="success">Invite sent.</Notice>
        <Notice tone="warning">Changes wait for a connection.</Notice>
        <Notice>Check your email.</Notice>
      </>,
    );
    await expect.element(screen.getByRole("alert")).toHaveTextContent("This entry was deleted.");
    expect(screen.getByRole("status").elements()).toHaveLength(3);
  });

  test("role none: no role of its own, inside a caller's live region", async () => {
    const { screen } = await renderInRouter(
      <div role="status" data-region="">
        <Notice tone="warning" role="none" data-inner="">
          You're offline.
        </Notice>
      </div>,
    );
    await expect.element(screen.getByText("You're offline.")).toBeVisible();
    expect(screen.getByRole("status").elements()).toHaveLength(1);
    expect(document.querySelector("[data-inner]")?.hasAttribute("role")).toBe(false);
  });

  test("shows its icon, hidden from assistive tech, and a given icon replaces the tone's", async () => {
    const { screen } = await renderInRouter(
      <>
        <Notice tone="success" data-a="">
          Invite sent.
        </Notice>
        <Notice icon={WifiOff} data-b="">
          You're offline.
        </Notice>
        <WifiOff data-ref="" />
      </>,
    );
    await expect.element(screen.getByText("You're offline.")).toBeVisible();
    const icon = (sel: string) => document.querySelector(`${sel} svg`);
    expect(icon("[data-a]")?.getAttribute("aria-hidden")).toBe("true");
    expect(icon("[data-b]")?.innerHTML).toBe(document.querySelector("svg[data-ref]")?.innerHTML);
    expect(icon("[data-a]")?.innerHTML).not.toBe(icon("[data-b]")?.innerHTML);
  });

  test("its action is a button with a callback, or a link", async () => {
    const onAction = vi.fn();
    const { screen, location } = await renderInRouter(
      <>
        <Notice action={{ label: "Try again", onAction }}>Couldn't load.</Notice>
        <Notice action={{ label: "Open settings", to: "/settings" }}>Notifications are off.</Notice>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onAction).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("link", { name: "Open settings" }));
    await expect.poll(location).toBe("/settings");
  });
});
