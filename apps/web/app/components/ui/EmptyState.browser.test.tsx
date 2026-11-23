import { Stethoscope } from "lucide-react";
import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ratio, rgba, surfaceOf } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { EmptyState } from "./index";

describe("EmptyState", () => {
  test("is one quiet line with no action by default", async () => {
    const { screen } = await renderInRouter(<EmptyState>No one is waiting.</EmptyState>);
    await expect.element(screen.getByText("No one is waiting.")).toBeVisible();
    await expect.element(screen.getByRole("button")).not.toBeInTheDocument();
    await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  });

  test("its action is a link when given a place", async () => {
    const { screen, location } = await renderInRouter(
      <EmptyState action={{ label: "Add a provider", to: "/providers/new" }}>No providers yet.</EmptyState>,
    );
    await userEvent.click(screen.getByRole("link", { name: "Add a provider" }));
    await expect.poll(location).toBe("/providers/new");
  });

  test("its action is a button when given a callback", async () => {
    const onAction = vi.fn();
    const { screen } = await renderInRouter(
      <EmptyState action={{ label: "Invite someone", onAction }}>No invites yet.</EmptyState>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  test("without an icon there is no circle", async () => {
    await renderInRouter(<EmptyState>No one is waiting.</EmptyState>);
    expect(document.querySelector("[data-icon-chip]")).toBeNull();
  });

  test.each(["light", "dark"] as const)(
    "in %s the circle is above the line, hidden, its icon 3:1",
    async (theme) => {
      await renderInRouter(
        <EmptyState icon={Stethoscope} accent="lime">
          No providers yet.
        </EmptyState>,
        { theme },
      );
      const line = page.getByText("No providers yet.");
      await expect.element(line).toBeVisible();
      const circle = document.querySelector<HTMLElement>("[data-icon-chip]");
      expect(circle?.getAttribute("aria-hidden")).toBe("true");
      expect(circle!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        line.element().getBoundingClientRect().top,
      );
      const icon = circle!.querySelector("svg")!;
      expect(ratio(rgba(getComputedStyle(icon).color), surfaceOf(circle!))).toBeGreaterThanOrEqual(3);
    },
  );

  test("with an icon, its action still works as a link and as a button", async () => {
    const onAction = vi.fn();
    const { screen, location } = await renderInRouter(
      <>
        <EmptyState
          icon={Stethoscope}
          accent="lime"
          action={{ label: "Add a provider", to: "/providers/new" }}
        >
          No providers yet.
        </EmptyState>
        <EmptyState icon={Stethoscope} accent="lime" action={{ label: "Invite someone", onAction }}>
          No invites yet.
        </EmptyState>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(onAction).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("link", { name: "Add a provider" }));
    await expect.poll(location).toBe("/providers/new");
  });
});
