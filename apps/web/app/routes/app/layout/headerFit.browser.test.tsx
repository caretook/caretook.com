import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../test/device";
import { fx, TEST_GROUP, TEST_USER } from "../../../../test/fixtures";
import { PROBE } from "../../../../test/probe";

// B-848: across the medium widths (the header's section links show from
// `sm`, 640px; icons only below `lg`), the links never run into the Caretook
// link, the group menu or the account menu, every link stays on screen, and a
// long recipient name truncates in the group menu instead of pushing them.

const WIDTHS = [640, 700, 768, 900, 1023, 1024, 1100, 1280];

/** A second group whose recipient has a long name. */
const LONG = {
  id: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1b03",
  recipient: "7e1c9a40-2b6d-4f3e-8a15-0c9d4e2f1c03",
};
const longGroup = [
  fx.group({ id: LONG.id, name: "Ellery Family" }),
  fx.recipient({
    id: LONG.recipient,
    groupId: LONG.id,
    name: "Josephine Ellery",
    preferredName: "Great-Grandmother Josephine Alexandra",
  }),
  fx.member({ userId: TEST_USER.id, groupId: LONG.id, role: "owner" }),
];

const header = () => document.querySelector("body header")!;
const groupButton = () => page.getByRole("button", { name: /switch care group$/ });
const userButton = () => page.getByRole("button", { name: `Account menu for ${TEST_USER.name}` });
const LINKS = '[data-region="sections"] nav[aria-label="Group sections"] a';

const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const CASES = [
  ["a short name", TEST_GROUP.id],
  ["a long name", LONG.id],
] as const;

describe("the header at medium widths", () => {
  for (const [label, groupId] of CASES)
    for (const width of WIDTHS)
      test(`at ${width}, ${label}: the section links clear the group menu and the account menu`, async () => {
        await renderWithDevice({
          route: PROBE,
          url: `/app/groups/${groupId}/timeline`,
          frame: true,
          width,
          fixtures: [fx.note({ text: "Slept well" }), ...longGroup],
        });
        await expect.element(groupButton()).toBeVisible();
        await expect.element(userButton()).toBeVisible();
        const links = [...document.querySelectorAll(LINKS)];
        expect(links.map((a) => a.textContent?.trim())).toEqual([
          "Timeline",
          "Providers",
          "Medications",
          "Planner",
        ]);
        const group = groupButton().element().getBoundingClientRect();
        const brand = header().querySelector('[data-region="group"] a')!.getBoundingClientRect();
        const user = userButton().element().getBoundingClientRect();
        const viewport = document.documentElement.clientWidth;
        for (const link of links) {
          const r = link.getBoundingClientRect();
          const name = link.textContent?.trim();
          expect(intersects(r, brand), `${name} and the Caretook link`).toBe(false);
          expect(intersects(r, group), `${name} and the group menu`).toBe(false);
          expect(intersects(r, user), `${name} and the account menu`).toBe(false);
          expect(r.left, `${name} on screen`).toBeGreaterThanOrEqual(0);
          expect(r.right, `${name} on screen`).toBeLessThanOrEqual(viewport);
          // Icons only below `lg`, labelled from it.
          expect(r.width, `${name}'s width`).toSatisfy((w: number) => (width < 1024 ? w < 48 : w > 60));
        }
        expect(group.left, "the group menu after the Caretook link").toBeGreaterThanOrEqual(brand.right);
        expect(group.right, "the group menu before the links").toBeLessThanOrEqual(
          links[0]!.getBoundingClientRect().left,
        );
        expect(group.width, "the group menu keeps room for its name").toBeGreaterThan(80);
        expect(user.right).toBeLessThanOrEqual(viewport);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(viewport);
      });
});
