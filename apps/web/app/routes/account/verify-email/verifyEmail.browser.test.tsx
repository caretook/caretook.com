import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createRoutesStub } from "react-router";
import * as verifyEmail from "./route";

// B-314: offline, Better Auth's fetch rejects with a TypeError. Checking the
// link and sending a new one say they couldn't reach Caretook in place,
// never the error page, and an unchecked link isn't called expired.

const OFFLINE = "Couldn't reach Caretook. Check your connection and try again.";
const EXPIRED = "This link has expired or was already used. Send yourself a new one.";
const realFetch = window.fetch.bind(window);

afterEach(() => {
  window.fetch = realFetch;
});

const offline = () => {
  window.fetch = (input, init) => {
    const { pathname } = new URL(new Request(input, init).url);
    if (!pathname.startsWith("/api/auth/")) return realFetch(input, init);
    return Promise.reject(new TypeError("Failed to fetch"));
  };
};

const open = (url: string) => {
  const Stub = createRoutesStub([
    {
      path: "/verify-email",
      loader: verifyEmail.clientLoader as never,
      action: verifyEmail.clientAction as never,
      Component: verifyEmail.default as never,
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
};

const saysOffline = async () => {
  await expect.element(page.getByText(OFFLINE)).toBeVisible();
  expect(document.body.textContent).not.toContain("Unexpected Application Error");
};

describe("offline", () => {
  test("opening the emailed link says so, not that it expired", async () => {
    offline();
    await open("/verify-email?token=fictional-token");
    await saysOffline();
    expect(document.body.textContent).not.toContain(EXPIRED);
    await expect.element(page.getByRole("button", { name: "Send a new link" })).toBeEnabled();
  });

  test("sending a new link says so and keeps the form", async () => {
    offline();
    await open("/verify-email?email=pat%40example.test");
    await userEvent.click(page.getByRole("button", { name: "Send a new link" }));
    await saysOffline();
    await expect.element(page.getByRole("button", { name: "Send a new link" })).toBeEnabled();
  });
});
