import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createRoutesStub } from "react-router";
import * as appLayout from "./app/layout/route";
import * as signIn from "./sign-in";

// B-130: a session check the server rate-limits twice, on a device with
// nobody cached (just signed out, say), goes to sign-in with a message,
// never a silent bounce. The server is a stubbed fetch: get-session always
// answers 429 (no wait before the retry).

const realFetch = window.fetch.bind(window);

afterEach(() => {
  window.fetch = realFetch;
});

const sessionAnswers = (answer: () => Response) => {
  const asked: string[] = [];
  window.fetch = (input, init) => {
    const { pathname } = new URL(new Request(input, init).url);
    if (pathname !== "/api/auth/get-session") return realFetch(input, init);
    asked.push(pathname);
    return Promise.resolve(answer());
  };
  return asked;
};

const tooMany = () =>
  new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "X-Retry-After": "0" },
  });

const open = async (url: string) => {
  const Stub = createRoutesStub([
    {
      id: "app",
      path: "/app",
      middleware: appLayout.clientMiddleware as never,
      Component: () => <p>The app</p>,
    },
    {
      path: "/sign-in",
      loader: signIn.clientLoader as never,
      action: signIn.clientAction as never,
      Component: signIn.default as never,
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
};

describe("a rate-limited session check", () => {
  test("with nobody cached, sign-in says to try again in a moment", async () => {
    localStorage.clear();
    const asked = sessionAnswers(tooMany);
    await open("/app");
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Too many attempts. Try again in a moment.");
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    // /app asked twice (a retry after the first 429), then sign-in once.
    expect(asked).toHaveLength(3);
  });

  test("a plain sign-in page shows no such message", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in");
    await expect.element(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(page.getByRole("status").elements()).toHaveLength(0);
  });
});

describe("the email tab", () => {
  test("is labelled Email, and its form has no explanation above it", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in?with=email");
    const tab = page.getByRole("link", { name: "Email", exact: true });
    await expect.element(tab).toHaveAttribute("aria-current", "page");
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeVisible();
    const form = page.getByRole("button", { name: "Send email" }).element().closest("form")!;
    expect(form.querySelector("p")).toBeNull();
  });
});

describe("the ways to sign in", () => {
  test("two tabs, Password and Email, with the current one marked; Email opens its form", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in");
    const nav = page.getByRole("navigation", { name: "Ways to sign in" });
    await expect.element(nav.getByRole("link", { name: "Password" })).toHaveAttribute("aria-current", "page");
    await expect
      .element(nav.getByRole("link", { name: "Email", exact: true }))
      .not.toHaveAttribute("aria-current");
    await userEvent.click(nav.getByRole("link", { name: "Email", exact: true }));
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeVisible();
    await expect
      .element(nav.getByRole("link", { name: "Email", exact: true }))
      .toHaveAttribute("aria-current", "page");
  });

  test("the password form links to Forgot password?", async () => {
    sessionAnswers(() => Response.json(null));
    await open("/sign-in");
    await expect
      .element(page.getByRole("link", { name: "Forgot password?" }))
      .toHaveAttribute("href", "/reset-password");
  });
});
