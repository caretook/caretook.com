import type { ConnectPage } from "~/.server/connectors";

import { CONNECTOR_CONSENT_TEXT } from "@caretook/data/schema";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { CONNECT_RETURN_DELAY_MS, CONNECT_SUCCESS_EXAMPLES } from "~/lib/connectors/connectSuccess";
import { ASK_OWNERS, ASKED_NOTE, askedOn } from "~/lib/connectors/connectGuide";
import { apiCalls } from "../../../../test/api";
import { renderWithDevice } from "../../../../test/device";
import { found } from "../../../../test/found";
import { connectReturn, ConnectSuccess } from "./ConnectConsent";
import * as connect from "./route";

// /connect (connectors PRD), on loader data: the client and where it returns
// to, the group picker, the scope by role (a viewer reads only), Connect
// disabled until the consent is ticked, Cancel, the dead ends, and the
// success step (connectors-2): the group, three examples, Return and the
// auto-return. Leaving the page is `connectReturn.go`, stood in for here. Which
// groups are eligible, the signed query, the grant and the code are the
// server's: packages/api/src/connectors/oauth.int.test.ts and
// packages/data/src/services/connectorGrant.int.test.ts.

const SEARCH =
  "?response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&scope=group%3Aread&sig=s";

const consent: ConnectPage = {
  state: "consent",
  client: { name: "Claude", redirectHost: "claude.ai" },
  groups: [
    {
      id: "g-1",
      name: "Dev Family",
      recipientName: "Grandma Pat",
      role: "caretaker",
      scopes: ["read", "readWrite"],
    },
    { id: "g-2", name: "Lee household", recipientName: "Uncle Lee", role: "viewer", scopes: ["read"] },
  ],
  offGroups: [],
};

const open = async (
  loaderData: ConnectPage,
  answer: (form: FormData) => unknown = () => ({ error: "" }),
  api?: Record<string, (input: unknown) => unknown>,
) => {
  const posts: Record<string, string>[] = [];
  const device = await renderWithDevice({
    route: {
      path: "/connect",
      module: connect,
      loaderData,
      actionResult: (form: FormData) => {
        posts.push(
          Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : v.name])),
        );
        return answer(form);
      },
    },
    url: `/connect${SEARCH}`,
    role: null,
    api,
  });
  return { device, posts };
};

const CONNECTED = {
  groupName: "Dev Family",
  clientName: "Claude",
  redirect: "https://claude.ai/cb?code=fictional-code&state=s",
};

const connectButton = () => page.getByRole("button", { name: "Connect", exact: true });
const radio = (name: string) => page.getByRole("radio", { name, exact: true });

// Never leave the test page, even when a success step's timer outlives its test.
const go = vi.fn<(url: string) => void>();
beforeAll(() => {
  vi.spyOn(connectReturn, "go").mockImplementation(go);
});
beforeEach(() => go.mockClear());

describe("/connect", () => {
  test("names the assistant and where it returns, and lists the groups given", async () => {
    await open(consent);
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("Connect Claude");
    expect(document.querySelector("[data-redirect-host]")?.textContent).toBe("claude.ai");
    const picker = page.getByRole("radiogroup", { name: "Care group" });
    await expect.element(picker.getByRole("radio", { name: "Dev Family (Grandma Pat)" })).toBeChecked();
    await expect.element(picker.getByRole("radio", { name: "Lee household (Uncle Lee)" })).toBeVisible();
    expect(picker.element().querySelectorAll("input[type=radio]")).toHaveLength(2);
    await expect.element(page.getByText(CONNECTOR_CONSENT_TEXT)).toBeVisible();
  });

  test("offers read and write to a caretaker, and read only to a viewer", async () => {
    await open(consent);
    await expect.element(radio("Read only")).toBeChecked();
    await expect.element(radio("Read and add entries")).toBeVisible();

    await userEvent.click(radio("Read and add entries"));
    await userEvent.click(radio("Lee household (Uncle Lee)"));
    await expect.element(radio("Read only")).toBeChecked();
    expect(document.querySelectorAll("input[name=scope]")).toHaveLength(1);
    await expect
      .element(page.getByText("As a viewer in this group, you can connect for reading only."))
      .toBeVisible();
  });

  test("keeps Connect disabled until the consent is ticked, then posts the choice", async () => {
    const { posts } = await open(consent);
    await expect.element(connectButton()).toBeDisabled();
    await userEvent.click(radio("Read and add entries"));
    await userEvent.click(page.getByRole("checkbox"));
    await expect.element(connectButton()).toBeEnabled();
    await userEvent.click(connectButton());
    await expect
      .poll(() => posts)
      .toEqual([{ groupId: "g-1", scope: "readWrite", consent: "on", intent: "connect" }]);
  });

  test("shows the server's refusal", async () => {
    await open(consent, () => ({ error: "This care group doesn't allow assistants." }));
    await userEvent.click(page.getByRole("checkbox"));
    await userEvent.click(connectButton());
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("This care group doesn't allow assistants.");
  });

  test("Cancel posts a cancel, with no consent needed", async () => {
    const { posts } = await open(consent);
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => posts.map((p) => p.intent)).toEqual(["cancel"]);
    expect(posts[0]?.consent).toBeUndefined();
  });

  test("with no group that allows assistants, says who can change that, and only Cancel", async () => {
    const { posts } = await open({ ...consent, groups: [] });
    await expect.element(page.getByText(/None of your care groups allow assistants yet/)).toBeVisible();
    expect(document.querySelector("[data-no-groups]")?.textContent).toMatch(
      /Ask a group’s owner to turn on Assistants/,
    );
    expect(document.querySelector("[data-connect-form]")).toBeNull();
    expect(document.querySelector("input[type=checkbox]")).toBeNull();
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await expect.poll(() => posts.map((p) => p.intent)).toEqual(["cancel"]);
  });

  test("an expired or tampered request says to start again", async () => {
    await open({ state: "invalid" });
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("This link has expired");
    expect(document.querySelector("form")).toBeNull();
  });

  test("after Connect, shows what was connected and three examples; Return goes back at once", async () => {
    await open(consent, () => ({ connected: CONNECTED }));
    await userEvent.click(page.getByRole("checkbox"));
    await userEvent.click(connectButton());
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent("Connected to Dev Family");
    const examples = [...document.querySelectorAll("[data-connect-examples] li")].map((li) => li.textContent);
    expect(examples).toEqual([...CONNECT_SUCCESS_EXAMPLES]);
    expect(document.querySelector("[data-connect-form]")).toBeNull();
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Taking you back to Claude in 5 seconds.");
    expect(go).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole("button", { name: "Return to Claude" }));
    expect(go.mock.calls).toEqual([[CONNECTED.redirect]]);
    await expect.element(page.getByRole("status")).toHaveTextContent("Returning to Claude…");
    await expect.element(page.getByRole("button", { name: "Return to Claude" })).toBeDisabled();
  });
});

// The empty state's groups (connectors-2 slice 2): each group with the
// switch off, where a member who isn't an owner asks its owners.
const ASKED_AT = new Date(Date.now() - 86_400_000).toISOString();
const offPage: ConnectPage = {
  ...consent,
  groups: [],
  offGroups: [
    { id: "g-1", name: "Dev Family", recipientName: "Grandma Pat", role: "caretaker", askedAt: null },
    { id: "g-2", name: "Lee household", recipientName: "Uncle Lee", role: "viewer", askedAt: ASKED_AT },
    { id: "g-3", name: "Kim family", recipientName: null, role: "owner", askedAt: null },
  ],
};
const offRow = (id: string) => document.querySelector<HTMLElement>(`[data-off-group="${id}"]`);

describe("/connect with no group that allows assistants", () => {
  test("lists each group with the switch off: Ask for a member, Asked on after asking, a link for an owner", async () => {
    const calls = apiCalls();
    const api = calls.record({
      "connector.requestEnable": (input) => ({
        id: "req-1",
        groupId: (input as { groupId: string }).groupId,
        requestedAt: new Date().toISOString(),
        created: true,
      }),
    });
    const { posts } = await open(offPage, undefined, api);
    await expect.poll(() => offRow("g-1")?.querySelector("p")?.textContent).toBe("Dev Family (Grandma Pat)");
    const [viewerRow, ownerRow] = [await found(() => offRow("g-2")), await found(() => offRow("g-3"))];
    expect(ownerRow.querySelector("p")?.textContent).toBe("Kim family");

    // A viewer who asked yesterday: Asked on, no button.
    expect(viewerRow.querySelector("[data-asked-on]")?.textContent).toBe(askedOn(ASKED_AT));
    expect(viewerRow.querySelector("button")).toBeNull();
    // An owner: no button, a link to turn it on.
    expect(ownerRow.querySelector("button")).toBeNull();
    expect(ownerRow.querySelector("a")?.getAttribute("href")).toBe("/app/groups/g-3/settings/assistants");

    // Only one ask button, the caretaker's.
    const ask = page.getByRole("button", { name: ASK_OWNERS });
    expect(ask.elements()).toHaveLength(1);
    await userEvent.click(ask);
    await expect.poll(() => calls.of("connector.requestEnable")).toEqual([{ groupId: "g-1" }]);
    await expect
      .poll(() => offRow("g-1")?.querySelector("[data-asked-on]")?.textContent)
      .toMatch(/^Asked on /);
    expect(offRow("g-1")?.textContent).toContain(ASKED_NOTE);
    expect(page.getByRole("button", { name: ASK_OWNERS }).elements()).toHaveLength(0);
    // Cancel is still there, and nothing was posted.
    await expect.element(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(posts).toEqual([]);
  });
});

describe("ConnectSuccess's auto-return", () => {
  test("goes back to the assistant on its own after the delay, once", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await render(<ConnectSuccess connected={CONNECTED} />);
      vi.advanceTimersByTime(CONNECT_RETURN_DELAY_MS - 1);
      expect(go).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(go.mock.calls).toEqual([[CONNECTED.redirect]]);
      vi.advanceTimersByTime(CONNECT_RETURN_DELAY_MS * 2);
      expect(go).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
