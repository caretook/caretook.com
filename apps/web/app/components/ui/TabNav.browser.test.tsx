import { CalendarClock, List } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router";
import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { surfaceContrast, textContrast } from "../../../test/contrast";
import { renderInRouter } from "../../../test/device";
import { TabNav } from "./index";

// TabNav's per-tab fields (icon, count, current, replace), its sideways
// scroll, and the current pill's contrast. Its contract (a named nav of
// links, the first claimant current, pending navigation, prefetch) is
// tested in primitives.browser.test.tsx.

const nav = () => page.getByRole("navigation", { name: "Medications tabs" });

let back = () => {};
function BackProbe() {
  const navigate = useNavigate();
  useLayoutEffect(() => {
    back = () => void navigate(-1);
  }, [navigate]);
  return null;
}

describe("TabNav", () => {
  test("an icon is hidden from the tab's name, and a count is part of it", async () => {
    await renderInRouter(
      <TabNav
        label="Medications tabs"
        tabs={[
          { label: "Schedule", to: "/m/schedule", icon: CalendarClock },
          { label: "List", to: "/m/list", icon: List, count: 12 },
        ]}
      />,
      { url: "/m/schedule" },
    );
    const schedule = nav().getByRole("link", { name: "Schedule", exact: true });
    await expect.element(schedule).toHaveAttribute("aria-current", "page");
    expect(schedule.element().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await expect.element(nav().getByRole("link", { name: "List, 12", exact: true })).toBeVisible();
    expect(nav().getByRole("link", { name: "List, 12" }).element().textContent).toContain("12");
  });

  test("`current` overrides the path match, for tabs told apart by a search parameter", async () => {
    function SignInTabs() {
      const [way, setWay] = useState("email");
      return (
        <>
          <TabNav
            label="Medications tabs"
            tabs={[
              { label: "Password", to: "/sign-in", current: way === "password" },
              { label: "Email", to: "/sign-in?with=email", current: way === "email" },
            ]}
          />
          <button type="button" onClick={() => setWay("password")}>
            Use a password
          </button>
        </>
      );
    }
    await renderInRouter(<SignInTabs />, { url: "/sign-in?with=email" });
    await expect.element(nav().getByRole("link", { name: "Email" })).toHaveAttribute("aria-current", "page");
    await expect.element(nav().getByRole("link", { name: "Password" })).not.toHaveAttribute("aria-current");
    await userEvent.click(page.getByRole("button", { name: "Use a password" }));
    await expect
      .element(nav().getByRole("link", { name: "Password" }))
      .toHaveAttribute("aria-current", "page");
    await expect.element(nav().getByRole("link", { name: "Email" })).not.toHaveAttribute("aria-current");
  });

  test("`replace` switches tabs without adding a history step", async () => {
    const { location } = await renderInRouter(
      <>
        <BackProbe />
        <TabNav
          label="Medications tabs"
          tabs={[
            { label: "Schedule", to: "/m/schedule", replace: true },
            { label: "List", to: "/m/list", replace: true },
            { label: "Passes", to: "/m/passes" },
          ]}
        />
      </>,
      { url: "/m/schedule" },
    );
    await userEvent.click(nav().getByRole("link", { name: "Passes" }));
    await expect.poll(location).toBe("/m/passes");
    await userEvent.click(nav().getByRole("link", { name: "List" }));
    await expect.poll(location).toBe("/m/list");
    // List replaced Passes, so Back goes to Schedule.
    back();
    await expect.poll(location).toBe("/m/schedule");
  });

  test("at 420 with eight tabs the bar scrolls sideways, the page doesn't, and the current tab is in view", async () => {
    const tabs = Array.from({ length: 8 }, (_, i) => ({ label: `Section ${i + 1}`, to: `/s/${i + 1}` }));
    await renderInRouter(<TabNav label="Medications tabs" tabs={tabs} />, { url: "/s/7", width: 420 });
    const bar = nav().element();
    await expect
      .element(nav().getByRole("link", { name: "Section 7" }))
      .toHaveAttribute("aria-current", "page");
    expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth);
    expect(getComputedStyle(bar).overflowX).toBe("auto");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    const b = bar.getBoundingClientRect();
    const t = nav().getByRole("link", { name: "Section 7" }).element().getBoundingClientRect();
    expect(t.left).toBeGreaterThanOrEqual(b.left - 1);
    expect(t.right).toBeLessThanOrEqual(b.right + 1);
  });

  test("at 420 a few tabs fill the width, equally", async () => {
    await renderInRouter(
      <TabNav
        label="Medications tabs"
        tabs={[
          { label: "Schedule", to: "/m/schedule" },
          { label: "List", to: "/m/list" },
        ]}
      />,
      { url: "/m/schedule", width: 420 },
    );
    const links = nav().getByRole("link").elements();
    const [a, b] = links.map((l) => l.getBoundingClientRect().width);
    expect(Math.abs(a! - b!)).toBeLessThan(2);
    expect(nav().element().getBoundingClientRect().width).toBeGreaterThan(380);
  });

  test.each(["light", "dark"] as const)(
    "in %s the current pill's text clears 4.5:1 and the bar stands off the page at 3:1 or its edge shows",
    async (theme) => {
      await renderInRouter(
        <TabNav
          label="Medications tabs"
          tabs={[
            { label: "Schedule", to: "/m/schedule" },
            { label: "List", to: "/m/list", count: 3 },
          ]}
        />,
        { url: "/m/schedule", theme },
      );
      const current = nav().getByRole("link", { name: "Schedule" }).element();
      const pill = textContrast(current);
      const other = textContrast(nav().getByRole("link", { name: "List, 3" }).element());
      const bar = surfaceContrast(nav().element(), document.body);
      expect(pill).toBeGreaterThanOrEqual(4.5);
      expect(other).toBeGreaterThanOrEqual(4.5);
      // The bar's own surface against the page: daisyUI's base-100 on base-200
      // is a quiet step, so the shadow (light) and border (dark) carry the edge.
      expect(bar).toBeGreaterThan(1);
      const style = getComputedStyle(nav().element());
      if (theme === "dark") expect(style.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
      else expect(style.boxShadow).not.toBe("none");
    },
  );
});
