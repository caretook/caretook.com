import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createRoutesStub, Link } from "react-router";
import { TEST_GROUP } from "../../../../test/fixtures";
import { SectionNav, TabBar } from "./SectionNav";
import { useLocation } from "react-router";

// The section links follow the navigation at once: a tap moves `aria-current`
// to the tapped section while its loader is still pending, and a superseded
// navigation moves it back. (The links also carry `prefetch="render"`.)

const G = TEST_GROUP.id;
const TIMELINE = `/app/groups/${G}/timeline`;
const TASKS = `/app/groups/${G}/tasks`;

function Frame() {
  const { pathname } = useLocation();
  return (
    <>
      <SectionNav groupId={G} pathname={pathname} />
      <TabBar groupId={G} pathname={pathname} />
      <Link to={TIMELINE}>Stay here</Link>
    </>
  );
}

const open = async (width: number) => {
  await page.viewport(width, 900);
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/app/groups/:groupId",
      Component: Frame,
      children: [
        { path: "timeline", Component: () => null },
        // A target whose loader never resolves.
        { path: "tasks", loader: () => new Promise(() => {}), Component: () => null },
      ],
    },
  ]);
  return render(<Stub initialEntries={[TIMELINE]} />);
};

const links = (nav: string, name: string) =>
  document.querySelector(`${nav}`)!.querySelector(`a[href="${name}"]`)!;
const HEADER = "nav:not(.dock)";
const DOCK = "nav.dock";

describe.each([
  ["phone", 420, DOCK],
  ["wide", 1200, HEADER],
])("section links on %s", (_name, width, nav) => {
  test("a tap moves aria-current at once, and a superseded navigation moves it back", async () => {
    await open(width);
    expect(links(nav, TIMELINE).getAttribute("aria-current")).toBe("page");
    expect(links(nav, TASKS).getAttribute("aria-current")).toBeNull();

    (links(nav, TASKS) as HTMLElement).click();
    await expect.poll(() => links(nav, TASKS).getAttribute("aria-current")).toBe("page");
    expect(links(nav, TIMELINE).getAttribute("aria-current")).toBeNull();

    await userEvent.click(page.getByRole("link", { name: "Stay here" }));
    await expect.poll(() => links(nav, TIMELINE).getAttribute("aria-current")).toBe("page");
    expect(links(nav, TASKS).getAttribute("aria-current")).toBeNull();
  });
});

test("both link sets prefetch their targets", async () => {
  await open(420);
  const prefetched = [...document.querySelectorAll('link[rel="prefetch"]')].map((l) =>
    l.getAttribute("href"),
  );
  expect(prefetched.length).toBeGreaterThan(0);
});
