import type { StaffCapability } from "@caretook/data/schema";
import type { SuppressionRow, SuppressionsApi } from "./suppressionsData";

import { staffCapabilities } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
import { useLayoutEffect } from "react";
import { createRoutesStub, useLoaderData, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { apiCalls } from "../../../../test/api";
import { clearSuppressionAction, loadSuppressions } from "./suppressionsData";
import { SuppressionsPage } from "./SuppressionsPage";

// /admin/suppressions (hosting slice 4): the page's own loader and action
// logic (suppressionsData) over a stubbed `admin.suppressions` API, since
// the route's server loader needs a staff session. Fictional addresses only.

const ROWS: SuppressionRow[] = [
  { id: "1", address: "pat@example.com", reason: "bounce", createdAt: "2026-11-18T10:00:00.000Z" },
  { id: "2", address: "sam@example.org", reason: "complaint", createdAt: "2026-11-17T10:00:00.000Z" },
];

let location = "";
function LocationProbe() {
  const current = useLocation();
  useLayoutEffect(() => {
    location = current.pathname + current.search;
  }, [current]);
  return null;
}

/** The page over a stub API holding `rows`; `clear` answers with `onClear` (or removes the row). */
const renderPage = async ({
  rows = ROWS,
  capabilities = staffCapabilities(["support"]),
  url = "/admin/suppressions",
  onClear,
}: {
  rows?: SuppressionRow[];
  capabilities?: readonly StaffCapability[];
  url?: string;
  onClear?: (input: { address: string; reason: string }) => unknown;
} = {}) => {
  let stored = [...rows];
  const calls = apiCalls();
  const handlers = calls.record({
    "admin.suppressions.list": (input) => {
      const { query, page } = input as { query?: string; page: number };
      const matches = stored.filter((r) => !query || r.address.includes(query.toLowerCase()));
      return { count: matches.length, page, pageSize: 50, suppressions: matches };
    },
    "admin.suppressions.clear": (input) => {
      const clear = input as { address: string; reason: string };
      if (onClear) return onClear(clear);
      stored = stored.filter((r) => r.address !== clear.address);
      return { address: clear.address, cleared: true };
    },
  });
  const api: SuppressionsApi = {
    list: async (input) => (await handlers["admin.suppressions.list"]?.(input)) as never,
    clear: async (input) => await handlers["admin.suppressions.clear"]?.(input),
  };

  await page.viewport(420, 900);
  const Stub = createRoutesStub([
    {
      path: "/admin/suppressions",
      Component: () => (
        <>
          <LocationProbe />
          <SuppressionsPage data={useLoaderData<typeof loadSuppressions>()} />
        </>
      ),
      HydrateFallback: () => null,
      loader: ({ request }) => loadSuppressions(new URL(request.url), api, capabilities),
      action: async ({ request }) => clearSuppressionAction(await request.formData(), api),
    },
  ]);
  location = url;
  const screen = await render(<Stub initialEntries={[url]} />);
  await expect.element(screen.getByRole("heading", { name: "Email suppressions" })).toBeVisible();
  return { screen, calls };
};

describe("/admin/suppressions", () => {
  it("lists the suppressed addresses with the reason and date", async () => {
    const { screen } = await renderPage();
    const list = screen.getByRole("list", { name: "Suppressed addresses" });
    await expect.element(list).toBeVisible();
    expect(list.getByRole("listitem").elements()).toHaveLength(2);
    await expect.element(screen.getByText("pat@example.com")).toBeVisible();
    await expect.element(screen.getByText("Hard bounce · Nov 18, 2026")).toBeVisible();
    await expect.element(screen.getByText("Marked as spam · Nov 17, 2026")).toBeVisible();
    await expect.element(screen.getByText("2 addresses.")).toBeVisible();
  });

  it("says when there are none", async () => {
    const { screen } = await renderPage({ rows: [] });
    await expect.element(screen.getByText("No suppressed addresses.")).toBeVisible();
    expect(screen.getByRole("list", { name: "Suppressed addresses" }).query()).toBeNull();
  });

  it("searches by address, in the URL", async () => {
    const { screen, calls } = await renderPage();
    await userEvent.fill(screen.getByRole("searchbox", { name: "Address" }), "pat@");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await expect.poll(() => location).toBe("/admin/suppressions?q=pat%40");
    await expect.element(screen.getByText("1 address matches.")).toBeVisible();
    expect(screen.getByText("sam@example.org").query()).toBeNull();
    expect(calls.of("admin.suppressions.list").at(-1)).toEqual({ query: "pat@", page: 1 });
  });

  it("opens a search from the URL, and says when nothing matches", async () => {
    const { screen, calls } = await renderPage({ url: "/admin/suppressions?q=nobody" });
    await expect.element(screen.getByText("No suppressed address matches.")).toBeVisible();
    await expect.element(screen.getByRole("searchbox", { name: "Address" })).toHaveValue("nobody");
    expect(calls.of("admin.suppressions.list")).toEqual([{ query: "nobody", page: 1 }]);
  });

  it("clears one with a reason through the API", async () => {
    const { screen, calls } = await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Clear pat@example.com" }));
    const dialog = screen.getByRole("dialog", { name: "Clear this suppression?" });
    await expect.element(dialog).toBeVisible();
    // No reason, no clearing.
    await expect.element(dialog.getByRole("button", { name: "Clear it" })).toBeDisabled();
    await userEvent.fill(dialog.getByRole("textbox", { name: "Reason" }), "They fixed their mailbox");
    await userEvent.click(dialog.getByRole("button", { name: "Clear it" }));

    await expect.element(screen.getByRole("status")).toHaveTextContent("pat@example.com gets email again.");
    expect(calls.of("admin.suppressions.clear")).toEqual([
      { address: "pat@example.com", reason: "They fixed their mailbox" },
    ]);
    // The list reloads without it.
    await expect.poll(() => screen.getByText("pat@example.com").query()).toBeNull();
    await expect.element(screen.getByText("1 address.")).toBeVisible();
  });

  it("keeps a refusal in the dialog", async () => {
    const { screen } = await renderPage({
      onClear: () => {
        throw new ORPCError("BAD_REQUEST", {
          message: "Check the suppression's details",
          data: { issues: [{ path: "reason", message: "Say why" }] },
        });
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Clear sam@example.org" }));
    const dialog = screen.getByRole("dialog", { name: "Clear this suppression?" });
    await userEvent.fill(dialog.getByRole("textbox", { name: "Reason" }), "x");
    await userEvent.click(dialog.getByRole("button", { name: "Clear it" }));
    await expect.element(dialog.getByText("Say why")).toBeVisible();
    await expect.element(screen.getByText("sam@example.org")).toBeVisible();
  });

  it("has no Clear without users.help", async () => {
    const { screen } = await renderPage({ capabilities: ["users.read"] });
    await expect.element(screen.getByText("pat@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Clear/ }).query()).toBeNull();
  });
});
