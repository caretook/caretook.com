import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { renderWithDevice } from "../../../../../test/device";
import { fx, hoursAgo, TEST_GROUP } from "../../../../../test/fixtures";
import * as entryRoute from "./route";

// The "via" tag (connectors) on the entry page: a note or event a member
// added through their own AI assistant says so after its time in the
// header ("via Claude", `data-via`); one without has none.

const ROUTES = [{ path: "/app/groups/:groupId/entries/:entryId", module: entryRoute }];
const entryUrl = (id: string) => `/app/groups/${TEST_GROUP.id}/entries/${id}`;

const VIA = fx.event({ title: "Cardiology follow-up", occurredAt: hoursAgo(2), via: "Claude" });
const PLAIN = fx.note({ title: "Lunch", text: "Soup", occurredAt: hoursAgo(3) });
const open = (id: string) => renderWithDevice({ route: ROUTES, url: entryUrl(id), fixtures: [VIA, PLAIN] });

const tag = () => document.querySelector<HTMLElement>("main header [data-via]");

describe("the via tag on the entry page", () => {
  test("shows after the time for an entry added through an assistant", async () => {
    await open(VIA.id);
    await expect.element(page.getByRole("heading", { name: /Cardiology follow-up/ })).toBeInTheDocument();
    await expect.poll(() => tag()?.textContent).toBe("via Claude");
    expect(tag()?.closest('[data-region="time"]')).not.toBeNull();
  });

  test("shows nothing for an entry without one", async () => {
    await open(PLAIN.id);
    await expect.element(page.getByRole("heading", { name: /Lunch/ })).toBeInTheDocument();
    expect(tag()).toBeNull();
    expect(document.querySelector('[data-region="via"]')).toBeNull();
  });
});
