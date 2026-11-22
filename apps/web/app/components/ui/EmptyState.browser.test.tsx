import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

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
});
