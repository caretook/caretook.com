// @ts-check
// Caretook's local ESLint rules (no dependency): the component-test harness's habits (test-health,
// B-275, B-276). eslint.config.js turns them on for apps/web's component tests, apps/web/test/ and the
// `*World.tsx` files. A real exception carries
// `// eslint-disable-next-line caretook/<rule> -- <reason>`. Tests: rules.test.mjs.

/** @typedef {import("eslint").Rule.RuleModule} RuleModule */
/** @typedef {import("estree").Node} Node */
/** @typedef {import("estree").CallExpression} CallExpression */

/** The harness waits (apps/web/test/found.ts), each on its one `WAIT_TIMEOUT`. */
const HARNESS_WAITS = new Set(["found", "waitUntil", "stopsMoving"]);

/** `expect.<name>(…)`'s name, else null. */
const expectMethod = (/** @type {CallExpression} */ call) =>
  call.callee.type === "MemberExpression" &&
  call.callee.object.type === "Identifier" &&
  call.callee.object.name === "expect" &&
  call.callee.property.type === "Identifier"
    ? call.callee.property.name
    : null;

const calleeName = (/** @type {CallExpression} */ call) =>
  call.callee.type === "Identifier" ? call.callee.name : null;

/** Whether `node` is an object literal with a `timeout` key. */
const hasTimeoutKey = (/** @type {Node} */ node) =>
  node.type === "ObjectExpression" &&
  node.properties.some(
    (p) =>
      p.type === "Property" &&
      !p.computed &&
      ((p.key.type === "Identifier" && p.key.name === "timeout") ||
        (p.key.type === "Literal" && p.key.value === "timeout")),
  );

const isNumber = (/** @type {Node} */ node) =>
  (node.type === "Literal" && typeof node.value === "number") ||
  (node.type === "BinaryExpression" && isNumber(/** @type {Node} */ (node.left)) && isNumber(node.right));

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

/**
 * The first TypeScript non-null assertion (`x!`) in an expression, not looking inside functions (a
 * read inside `found(() => …)` or `expect.poll(() => …)` is retried, so its `!` is only "not yet").
 * @param {any} node
 * @returns {any}
 */
function findNonNull(node) {
  if (!node || typeof node.type !== "string" || FUNCTIONS.has(node.type)) return null;
  if (node.type === "TSNonNullExpression") return node;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const value = node[key];
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object" && typeof child.type === "string") {
        const hit = findNonNull(child);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/** @type {RuleModule} */
const noCallTimeout = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "No per-call milliseconds on found, waitUntil, stopsMoving, expect.poll or expect.element: they share WAIT_TIMEOUT (apps/web/test/found.ts).",
    },
    schema: [],
    messages: {
      timeout:
        "{{ name }} waits the harness's one timeout (WAIT_TIMEOUT, apps/web/test/found.ts): drop the milliseconds. A slow machine is handled there, not per call.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const method = expectMethod(node);
        const name =
          method === "poll" || method === "element"
            ? `expect.${method}`
            : HARNESS_WAITS.has(calleeName(node) ?? "")
              ? calleeName(node)
              : null;
        if (!name) return;
        node.arguments.slice(1).forEach((arg, i) => {
          // stopsMoving(read, ms) takes its timeout second; the others an options object.
          const positional = name === "stopsMoving" && i === 0;
          if (hasTimeoutKey(arg) || isNumber(arg) || positional) {
            context.report({ node: arg, messageId: "timeout", data: { name } });
          }
        });
      },
    };
  },
};

/** @type {RuleModule} */
const noNonNullUserEvent = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No non-null (`!`) read as a userEvent argument: it reads the page once, too early under load.",
    },
    schema: [],
    messages: {
      nonNull:
        "A `!` read passed to userEvent can run before the element is there. Pass a locator (getByRole, getByCss from test/locators.ts) or `await found(() => …)`.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.object.type !== "Identifier" ||
          callee.object.name !== "userEvent"
        )
          return;
        for (const arg of node.arguments) {
          const hit = findNonNull(arg);
          if (hit) context.report({ node: hit, messageId: "nonNull" });
        }
      },
    };
  },
};

/** @type {RuleModule} */
const noNonNullInExpect = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No non-null (`!`) read inside expect(…): it reads the page once and throws a TypeError instead of failing the assertion.",
    },
    schema: [],
    messages: {
      nonNull:
        "A `!` read inside expect(…) reads once and can run too early. Use expect.element(locator), expect.poll(() => …), or `await found(() => …)` first.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const method = expectMethod(node);
        const plain = calleeName(node) === "expect";
        if (!plain && method !== "soft" && method !== "element") return;
        for (const arg of node.arguments) {
          const hit = findNonNull(arg);
          if (hit) context.report({ node: hit, messageId: "nonNull" });
        }
      },
    };
  },
};

const SLEEP_HELPERS = new Set(["sleep", "wait", "delay", "pause"]);

/** @type {RuleModule} */
const noFixedSleep = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No fixed sleep (a setTimeout in a promise, or a sleep/wait/delay/pause(ms) helper): wait on the thing.",
    },
    schema: [],
    messages: {
      sleep:
        "A fixed sleep is too short under load and too long otherwise. Wait on the thing: expect.element, expect.poll, waitUntil, found or device.settle() (apps/web/test/).",
    },
  },
  create(context) {
    /** Executors of `new Promise(…)`, innermost last. */
    const executors = /** @type {Node[]} */ ([]);
    const enter = (/** @type {any} */ node) => {
      const parent = node.parent;
      if (
        parent?.type === "NewExpression" &&
        parent.callee.type === "Identifier" &&
        parent.callee.name === "Promise" &&
        parent.arguments[0] === node
      )
        executors.push(node);
    };
    const leave = (/** @type {any} */ node) => {
      if (executors.at(-1) === node) executors.pop();
    };
    return {
      ArrowFunctionExpression: enter,
      "ArrowFunctionExpression:exit": leave,
      FunctionExpression: enter,
      "FunctionExpression:exit": leave,
      CallExpression(node) {
        const name = calleeName(node);
        if (name === "setTimeout" && executors.length > 0) {
          context.report({ node, messageId: "sleep" });
        } else if (
          name &&
          SLEEP_HELPERS.has(name) &&
          node.arguments.length === 1 &&
          isNumber(/** @type {Node} */ (node.arguments[0]))
        ) {
          // sleep(200), pause(300): a helper waiting a fixed time (not a `wait(id, until)` of its own).
          context.report({ node, messageId: "sleep" });
        } else if (name === "setTimeout" && /** @type {any} */ (node).parent?.type === "AwaitExpression") {
          // node:timers/promises' setTimeout(ms).
          context.report({ node, messageId: "sleep" });
        }
      },
    };
  },
};

export const rules = {
  "no-call-timeout": noCallTimeout,
  "no-non-null-user-event": noNonNullUserEvent,
  "no-non-null-in-expect": noNonNullInExpect,
  "no-fixed-sleep": noFixedSleep,
};

/** @type {import("eslint").ESLint.Plugin} */
const plugin = { meta: { name: "caretook" }, rules };

export default plugin;
