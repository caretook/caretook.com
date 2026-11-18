// Sign-in can't be submitted twice (B-1): the button stays disabled, showing
// "Signing in…", from submit until /app renders, and a wrong password re-enables it.
//
// /app is held in its loaders by pausing the PowerSync token fetch (/api/auth/token)
// with CDP's Fetch domain, so the first sync waits and the redirect stays "loading".
import { launch, openPage, sleep } from "./cdp.mjs";

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "caretook-dev-password";
const HOLD_MS = 4000;
const button = `document.querySelector('form button[type="submit"]')`;
const buttonState = `({ body: ${button} ? undefined : document.body.innerText.slice(0, 200), disabled: ${button}?.disabled, text: ${button}?.textContent.trim(), path: location.pathname })`;

// A second CDP connection, attached to the page's target, for events the harness
// doesn't expose (Network requests and Fetch pauses).
async function watchPage(browser, onEvent) {
  const ws = new WebSocket(browser.ws);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  let sessionId;
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method && msg.sessionId === sessionId) onEvent(msg);
  });
  const send = (method, params = {}, sid = sessionId) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
      ws.send(JSON.stringify({ id: n, method, params, ...(sid ? { sessionId: sid } : {}) }));
    });
  const { targetInfos } = await send("Target.getTargets", {}, undefined);
  const page = targetInfos.find((t) => t.type === "page" && t.title === "sign-in-check");
  ({ sessionId } = await send(
    "Target.attachToTarget",
    { targetId: page.targetId, flatten: true },
    undefined,
  ));
  return { send, close: () => ws.close() };
}

let failed = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed++;
};

const b = await launch(9341);
try {
  // 1. Success: two clicks, one sign-in request, the button disabled until /app renders.
  const p = await openPage(b, "member");
  const signInRequests = [];
  let tokenHeld = 0;
  let sawSignInResponse = false;
  let signInStatus;
  await p.evaluate(`document.title = "sign-in-check"`); // so watchPage finds this tab
  const w = await watchPage(b, (msg) => {
    if (
      msg.method === "Network.requestWillBeSent" &&
      msg.params.request.url.includes("/api/auth/sign-in/email")
    )
      signInRequests.push(msg.params.request.url);
    if (
      msg.method === "Network.responseReceived" &&
      msg.params.response.url.includes("/api/auth/sign-in/email")
    ) {
      sawSignInResponse = true;
      signInStatus = msg.params.response.status;
    }
    if (msg.method === "Fetch.requestPaused") {
      tokenHeld++;
      setTimeout(
        () => w.send("Fetch.continueRequest", { requestId: msg.params.requestId }).catch(() => {}),
        HOLD_MS,
      );
    }
  });
  await w.send("Network.enable");
  await w.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/auth/token*", requestStage: "Request" }] });

  await p.goto("/sign-in");
  await p.waitFor(`document.querySelector('input[name="email"]')`);
  await p.type(`document.querySelector('input[name="email"]')`, "member@example.com");
  await p.type(`document.querySelector('input[name="password"]')`, PASSWORD);
  await p.press(button);
  await p.waitFor(`${button}?.disabled`, 5000);
  check(
    (await p.evaluate(`${button}.textContent.trim()`)) === "Signing in…",
    "the button shows Signing in… while submitting",
  );

  // Wait for the action to finish: the redirect is now loading /app, held on the token.
  const end = Date.now() + 30000;
  while (!(sawSignInResponse && tokenHeld > 0) && Date.now() < end) await sleep(50);
  check(
    sawSignInResponse && tokenHeld > 0,
    "the sign-in succeeded and /app is loading",
    `sign-in/email ${signInStatus ?? "no response"}, token held ${tokenHeld}x`,
  );
  // A failed sign-in (e.g. the server's database timing out) correctly re-enables the
  // form, so the rest of this case would be meaningless: stop with a clear reason.
  if (signInStatus !== 200) throw new Error(`sign-in/email returned ${signInStatus}: is the stack healthy?`);
  await sleep(300);
  const during = await p.evaluate(buttonState);
  check(
    during.path === "/sign-in" && during.disabled === true && during.text === "Signing in…",
    "during the redirect the button is disabled and shows Signing in…",
    JSON.stringify(during),
  );
  await p.screenshot("sign-in-redirecting");
  // A second click (and an Enter press) while /app loads.
  await p.press(button);
  await p.evaluate(
    `document.querySelector('input[name="password"]').dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))`,
  );
  await sleep(300);
  check(
    (await p.evaluate(`${button}?.disabled`)) === true,
    "the button is still disabled after the second click",
  );

  const reachedApp = await p
    .waitFor(`location.pathname.startsWith("/app") && !document.querySelector("#email")`, 20000)
    .then(
      () => true,
      () => false,
    );
  check(reachedApp, "/app renders after the sign-in", await p.evaluate("location.pathname"));
  await sleep(500);
  check(signInRequests.length === 1, "exactly one sign-in/email request", `${signInRequests.length} sent`);
  check(p.errors.length === 0, "no console errors (success case)", p.errors.join(" | "));
  w.close();
  p.close();

  // 2. Wrong password: the error shows and the button is enabled again.
  const b2 = await launch(9342);
  try {
    const q = await openPage(b2, "wrong");
    await q.goto("/sign-in");
    await q.waitFor(`document.querySelector('input[name="email"]')`);
    await q.type(`document.querySelector('input[name="email"]')`, "member@example.com");
    await q.type(`document.querySelector('input[name="password"]')`, "not-the-password-1234");
    await q.press(button);
    await q.waitFor(`document.querySelector('[role="alert"]')`, 10000);
    await q.waitFor(`!${button}.disabled`, 5000).catch(() => {});
    const after = await q.evaluate(
      `({ ...${buttonState}, alert: document.querySelector('[role="alert"]').textContent.trim() })`,
    );
    check(
      after.path === "/sign-in" &&
        after.disabled === false &&
        after.text === "Sign in" &&
        after.alert === "That email and password don't match an account.",
      "a wrong password re-enables the button with the error",
      JSON.stringify(after),
    );
    await q.screenshot("sign-in-wrong-password");
    // Browsers log failed fetches (the 401) as console errors; ignore those.
    const errs = q.errors.filter((e) => !/401|Failed to load resource/.test(e));
    check(errs.length === 0, "no console errors (wrong password)", errs.join(" | "));
  } finally {
    b2.proc.kill();
  }
} finally {
  b.proc.kill();
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
