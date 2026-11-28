import type { ComponentType, ReactNode } from "react";
import type { RenderResult } from "vitest-browser-react";
import type { SessionUser } from "~/lib/auth/session";
import type { SyncDb } from "~/lib/sync";
import type { Fixture, Fixtures, GroupRole } from "./fixtures";

import { mergeGroupSetup, SETUP_NUDGES } from "@caretook/data/schema";
import { useLayoutEffect } from "react";
import { createRoutesStub, Outlet, RouterContextProvider, useLocation } from "react-router";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ToastRegion } from "~/components/ui";
import { sessionContext } from "~/lib/auth/session";
import { installTestDatabase } from "~/lib/sync";
import { searchIndexSettled } from "~/lib/search/search.sync";
import * as appLayout from "~/routes/app/layout/route";
import * as groupLayout from "~/routes/app/groups/layout/route";
import { openTestDatabase, queuedWrites, setConnected, settle, syncDown, syncRemove } from "./database";
import { flattenFixtures, fx, TEST_GROUP, TEST_USER } from "./fixtures";
import { waitUntil } from "./found";

// The test device: a screen rendered as it runs on a phone, with the real
// route modules (middleware, loaders, actions, components), the real live
// queries and local writes, on a local-only PowerSync database in this
// Chromium tab. No server, no sync service, no Docker.
//
//   const device = await renderWithDevice({
//     route: { path: "/app/groups/:groupId/timeline", module: timeline },
//     url: `/app/groups/${TEST_GROUP.id}/timeline`,
//     role: "viewer",
//     fixtures: [fx.note({ text: "Slept well" })],
//   });
//   await expect.element(device.screen.getByText("Slept well")).toBeVisible();
//
// The stub mirrors routes.ts: the /app layout (id "app"; its middleware puts
// the session in the router context, as `requireSession` would), the group
// route (id "group", its real module) for paths under /app/groups/:groupId,
// then your routes. Paths are absolute patterns, nested by prefix. A path
// outside /app (`/admin/...`) is a top-level route beside /app.
//
// Web-only routes with a server `loader` or `action` (/admin) render from
// what the test gives instead: `loaderData` (a value, or a function called on
// every load, so it can change after an action) and `actionResult` (a value,
// or a function of the posted form). Their `~/.server/*` imports resolve to
// stubs in test/server/ (vitest.config.ts) that throw if called.
//
//   await renderWithDevice({
//     route: { path: "/admin/settings", module: settings, loaderData: { settings, canWrite: true } },
//     url: "/admin/settings",
//   });

/** A route module as React Router's framework mode reads it (only what the stub uses). */
export type RouteModule = {
  // Route components take generated prop types; the stub passes the same props.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default?: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorBoundary?: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientLoader?: (args: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientAction?: (args: any) => unknown;
  /** A server loader (web-only routes): never run in tests; give `loaderData`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loader?: (args: any) => unknown;
  /** A server action: never run in tests; give `actionResult`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action?: (args: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientMiddleware?: ((args: any, next: any) => unknown)[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shouldRevalidate?: (args: any) => boolean;
};

/** What a `loaderData` function gets: the URL being loaded and the route's params. */
export type LoaderArgs = { url: URL; params: Record<string, string | undefined> };

/** One route to render: an absolute path pattern, its module, and child routes (sheets). */
export type DeviceRoute = {
  path: string;
  module: RouteModule;
  /** The route's id (`useRouteLoaderData`); defaults to the path. */
  id?: string;
  children?: DeviceRoute[];
  /**
   * For a route with a server `loader`: what it returns. A function is
   * called on every load (the first, each navigation, and each revalidation
   * after an action) with the URL and params, so it can answer by search.
   */
  loaderData?: unknown;
  /**
   * For a route with a server `action`: what a post returns, or a function of
   * the posted form (record what was sent, answer by intent).
   */
  actionResult?: unknown;
};

export type DeviceOptions = {
  /** The route(s) under test. Give this or `element`. */
  route?: DeviceRoute | DeviceRoute[];
  /** Or any element, rendered at `url` inside the /app (and group) routes, so `useGroup()` works. */
  element?: ReactNode;
  /** Where the device starts. Defaults to the default group's root. */
  url?: string;
  /** The signed-in user (`TEST_USER` by default). Their public profile is inserted for you. */
  user?: SessionUser;
  /** Their role in `TEST_GROUP` (default "owner"); null for not a member. */
  role?: GroupRole | null;
  /** Rows on the device before the screen opens (`fx` builders, nested freely). */
  fixtures?: Fixtures;
  /** Leave out the default group, recipient and membership (you bring your own). */
  bareDevice?: boolean;
  /** Viewport width in CSS pixels (default 420) and height (default 900). */
  width?: number;
  height?: number;
  /** The app's theme: "light" or "dark" set `data-theme` as the user menu does; default is the system's. */
  theme?: "light" | "dark";
  /** Render the real /app frame (header, menus, tab bar) around the screen. */
  frame?: boolean;
  /** Whether the device counts as synced (default true; false shows "Syncing your care groups…" states). */
  firstSyncDone?: boolean;
  /**
   * Build the search index (only search tests need it). The device starts
   * with it built, and `settle()` also waits for it to take in changes.
   */
  search?: boolean;
  /**
   * The server, as far as this test needs one. The device is offline by
   * default: every request to `/rpc/*` and `/api/*` fails as a lost
   * connection does. Give oRPC handlers by procedure path (`"me.get"`,
   * `"careGroup.update"`) to answer those calls; a handler gets the input
   * and returns the output, or a `Response` (an error, say) as it is.
   * A key that starts with `/` is a path under `/api/` (Better Auth's
   * `"/api/auth/list-sessions"`): its handler gets the plain JSON body (null
   * for a GET) and its result is sent as plain JSON.
   */
  api?: Record<string, (input: unknown) => unknown>;
  /**
   * Wait for the first screen before returning (default true): the route's
   * loaders have finished and it has mounted (or errored; a load that never
   * finishes stops waiting at `WAIT_TIMEOUT`), every live query has reported
   * and the DOM is still for a frame. False returns as soon as React has
   * rendered, for a test of what shows first.
   */
  settle?: boolean;
  /**
   * Whether PowerSync counts as connected (default false: the device never
   * connects). Screens with online-only controls (the profile's Edit) read
   * this; `api` is what answers their calls. `device.connect()` changes it.
   */
  connected?: boolean;
  /**
   * The app starting (B-806): the /app middleware waits on this before the
   * session is set, as `requireSession` waits on the server and the database
   * open; `fallback` (root.tsx's `HydrateFallback`) shows meanwhile. Pair it
   * with `settle: false`.
   */
  starting?: { until: Promise<unknown>; fallback: ComponentType };
  /**
   * Start with no setup record for `TEST_GROUP`. By default the account has
   * set it up (opened, every nudge retired), as the seeds leave seeded
   * members, so no setup redirect or nudge appears: the record is added to a
   * settings cache the test stored and to every `me.get` answer.
   */
  noSetupRecord?: boolean;
};

export type Device = {
  /** The rendered screen: locators (`getByRole`, `getByText`…) for `expect.element`. */
  screen: RenderResult;
  /** The device's database, for reading what a screen wrote. */
  db: SyncDb;
  user: SessionUser;
  /** The router's current location (pathname + search), after any navigation. */
  location: () => string;
  /** Rows arriving from the server (another device's change), as a sync would apply them. */
  sync: (fixtures: Fixtures) => Promise<void>;
  /** Rows leaving the device as a sync would remove them. */
  unsync: (fixtures: readonly Pick<Fixture, "table" | "id">[]) => Promise<void>;
  /** Writes this device has queued for upload (PowerSync's `ps_crud`). */
  queued: () => ReturnType<typeof queuedWrites>;
  /** Run a query against the device's copy. */
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  /**
   * Wait for the screen to catch up with the database: every live query whose
   * tables changed has rerun, and the DOM is then unchanged for a frame. Call
   * it after a stored write, `sync()` or `unsync()`, before reading the
   * screen without a retrying `expect.element`. Throws after `timeout` ms
   * (default 5000), naming what was still moving.
   */
  settle: (options?: { timeout?: number }) => Promise<void>;
  /** PowerSync's connection coming back (true) or dropping (false), as its status listeners hear it. */
  connect: (connected: boolean) => void;
};

const GROUP_PREFIX = "/app/groups/:groupId";

/** Devices still open, closed after each test by `closeDevices()` (test/setup.ts). */
const open = new Set<SyncDb>();

const realFetch = window.fetch.bind(window);

/** The device's network: `/rpc` and `/api` go to `api` handlers, or fail as offline; the rest is real (Vite). */
const deviceFetch =
  (api: DeviceOptions["api"] = {}): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init);
    const { pathname, origin } = new URL(request.url);
    if (origin !== location.origin || !/^\/(rpc|api)\//.test(pathname)) return realFetch(input, init);
    const rpc = pathname.startsWith("/rpc/");
    const handler = rpc ? api[pathname.slice(5).replaceAll("/", ".")] : api[pathname];
    if (!handler) throw new TypeError("Failed to fetch (the test device is offline)");
    const body =
      request.method === "GET"
        ? null
        : ((await request.json().catch(() => null)) as { json?: unknown } | null);
    // oRPC wraps input and output in `{ json }`; Better Auth's `/api/auth/*` sends plain JSON.
    const result = await handler(rpc ? body?.json : body);
    if (result instanceof Response) return result;
    return Response.json(rpc ? { json: result ?? null, meta: [] } : (result ?? null));
  };

let currentLocation = "";

/**
 * Records where the router is, for `device.location()`. A layout effect, so
 * it's current by the time the new screen is in the DOM (a plain effect can
 * run after a test has already seen the screen and read the old location).
 */
function LocationProbe() {
  const location = useLocation();
  useLayoutEffect(() => {
    currentLocation = location.pathname + location.search;
  }, [location]);
  return null;
}

/** Routes showing their fallback: the router's first load (every loader) hasn't finished. */
let routesLoading = 0;

/** Renders nothing, as a route with no fallback does, and counts while the first load runs. */
function FirstLoad() {
  useLayoutEffect(() => {
    routesLoading++;
    return () => {
      routesLoading--;
    };
  }, []);
  return null;
}

/** The app's own first-load fallback, counted as `FirstLoad` is. */
const startingFallback = (Fallback: ComponentType) =>
  function Starting() {
    return (
      <>
        <FirstLoad />
        <Fallback />
      </>
    );
  };

type StubRoute = Parameters<typeof createRoutesStub>[0][number];

/** A server-only export the test didn't stand in for: fail loudly, naming the route. */
const serverOnly = (path: string, what: string) => () => {
  throw new Error(
    `${path} has a server ${what}: give the route ${what === "loader" ? "loaderData" : "actionResult"}`,
  );
};

/** A server loader's stand-in: the given data, or what its function returns for this load. */
const givenLoader =
  (data: unknown) =>
  ({ request, params }: { request: Request; params: Record<string, string | undefined> }) =>
    typeof data === "function"
      ? (data as (args: LoaderArgs) => unknown)({ url: new URL(request.url), params })
      : data;

/** A server action's stand-in: the given result, or its function of the posted form. */
const givenAction =
  (result: unknown) =>
  async ({ request }: { request: Request }) =>
    typeof result === "function" ? (result as (form: FormData) => unknown)(await request.formData()) : result;

const stubLoader = ({ path, module, loaderData }: DeviceRoute) => {
  if (loaderData !== undefined) return givenLoader(loaderData);
  if (module.loader) return serverOnly(path, "loader");
  return module.clientLoader;
};

const stubAction = ({ path, module, actionResult }: DeviceRoute) => {
  if (actionResult !== undefined) return givenAction(actionResult);
  if (module.action) return serverOnly(path, "action");
  return module.clientAction;
};

const toStub = (route: DeviceRoute): StubRoute => ({
  id: route.id ?? route.path,
  path: route.path,
  Component: route.module.default,
  HydrateFallback: FirstLoad,
  ErrorBoundary: route.module.ErrorBoundary,
  loader: stubLoader(route),
  action: stubAction(route),
  middleware: route.module.clientMiddleware as StubRoute["middleware"],
  shouldRevalidate: route.module.shouldRevalidate,
  children: route.children?.map(toStub),
});

/** A top-level route outside /app (/admin): the location probe, then its component. */
const outsideApp = (route: DeviceRoute): StubRoute => {
  const stub = toStub(route);
  const Component = stub.Component;
  return {
    ...stub,
    // The stub passes route component props (loaderData, actionData, params) through.
    Component: (props: object) => (
      <>
        <LocationProbe />
        {Component ? <Component {...props} /> : <Outlet />}
      </>
    ),
  };
};

/**
 * The /app route's component: the location probe, then the real frame or a
 * bare outlet with the frame's toast region (so a screen's toasts show).
 */
const withProbe =
  (Frame: RouteModule["default"] | null) =>
  // The stub passes route component props (loaderData, params, matches) through.
  (props: object) => (
    <>
      <LocationProbe />
      {Frame ? (
        <Frame {...props} />
      ) : (
        <>
          <Outlet />
          <ToastRegion />
        </>
      )}
    </>
  );

/** The user, their group and recipient, and their membership: what a signed-in member's device always has. */
const deviceBasics = (user: SessionUser, role: GroupRole | null, bare: boolean): Fixtures => [
  fx.user({ id: user.id, name: user.name, image: user.image ?? null }),
  !bare && [fx.group(), fx.recipient(), role && fx.member({ userId: user.id, role })],
];

/** `TEST_GROUP` set up, as a seeded member's account has it. */
const SETUP_DONE = { [TEST_GROUP.id]: { opened: true as const, retired: [...SETUP_NUDGES] } };

/**
 * Give the account `SETUP_DONE`: in a settings cache the test stored (none
 * is added: no cache stays no cache), and in every `me.get` answer.
 */
const withSetupRecord = (userId: string, api: DeviceOptions["api"] = {}): DeviceOptions["api"] => {
  const key = `caretook:settings:${userId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as { groupSetup?: Parameters<typeof mergeGroupSetup>[0] };
      localStorage.setItem(
        key,
        JSON.stringify({ ...cached, groupSetup: mergeGroupSetup(SETUP_DONE, cached.groupSetup) }),
      );
    }
  } catch {
    // No storage: nothing cached.
  }
  const get = api["me.get"];
  if (!get) return api;
  return {
    ...api,
    "me.get": async (input) => {
      const me: unknown = await get(input);
      if (me instanceof Response || typeof me !== "object" || me === null) return me;
      const { groupSetup } = me as { groupSetup?: Parameters<typeof mergeGroupSetup>[0] };
      return { ...me, groupSetup: mergeGroupSetup(SETUP_DONE, groupSetup) };
    },
  };
};

/** Open a test device on a screen. See the top of this file. */
export const renderWithDevice = async (options: DeviceOptions): Promise<Device> => {
  const user: SessionUser = options.user ?? { ...TEST_USER };
  const role = options.role === undefined ? "owner" : options.role;
  const url = options.url ?? `/app/groups/${TEST_GROUP.id}`;

  window.fetch = deviceFetch(options.noSetupRecord ? options.api : withSetupRecord(user.id, options.api));
  const db = await openTestDatabase(user.id);
  open.add(db);
  await syncDown(db, flattenFixtures([deviceBasics(user, role, !!options.bareDevice), options.fixtures]));
  await installTestDatabase(db, { firstSyncDone: options.firstSyncDone ?? true, search: options.search });
  if (options.connected) setConnected(db, true);

  await page.viewport(options.width ?? 420, options.height ?? 900);
  if (options.theme) document.documentElement.dataset.theme = options.theme;

  // An element renders at any url under its parent: as the index and as a splat.
  const elementRoutes = (prefix: string): StubRoute[] => {
    const Element = () => options.element;
    return [
      { id: "element-index", index: true, Component: Element },
      { id: "element", path: `${prefix}/*`, Component: Element },
    ];
  };
  const elementInGroup = !options.route && url.startsWith("/app/groups/");
  const allRoutes = options.route ? [options.route].flat() : [];
  const isApp = (r: DeviceRoute) => r.path === "/app" || r.path.startsWith("/app/");
  const routes = allRoutes.filter(isApp);
  const outside = allRoutes.filter((r) => !isApp(r)).map(outsideApp);
  const inGroup = [
    ...routes.filter((r) => r.path.startsWith(GROUP_PREFIX)).map(toStub),
    ...(elementInGroup ? elementRoutes(GROUP_PREFIX) : []),
  ];
  const inApp = [
    ...routes.filter((r) => !r.path.startsWith(GROUP_PREFIX)).map(toStub),
    ...(!options.route && !elementInGroup ? elementRoutes("/app") : []),
  ];

  const context = new RouterContextProvider();
  const Stub = createRoutesStub(
    [
      {
        id: "app",
        path: "/app",
        middleware: [
          options.starting
            ? async ({ context: ctx }, next) => {
                await options.starting?.until;
                ctx.set(sessionContext, { user, db });
                return next();
              }
            : ({ context: ctx }, next) => (ctx.set(sessionContext, { user, db }), next()),
        ],
        loader: () => ({ user }),
        Component: withProbe(options.frame ? (appLayout.default as RouteModule["default"]) : null),
        HydrateFallback: options.starting ? startingFallback(options.starting.fallback) : FirstLoad,
        ErrorBoundary: appLayout.ErrorBoundary,
        children: [
          ...inApp,
          ...(inGroup.length
            ? [
                {
                  ...toStub({ id: "group", path: "groups/:groupId", module: groupLayout }),
                  children: inGroup,
                },
              ]
            : []),
        ],
      },
      ...outside,
    ],
    context,
  );

  currentLocation = url;
  // With the search index on, settling includes the index taking in what changed.
  const settled = async (settleOptions?: { timeout?: number }) => {
    if (options.search) await searchIndexSettled();
    await settle(db, settleOptions);
  };
  if (options.search) await searchIndexSettled();
  const screen = await render(<Stub initialEntries={[url]} />);
  if (options.settle ?? true) {
    // Loaders read the device before the route mounts, and settle can go quiet in between. A load that
    // never finishes isn't this wait's failure: carry on, and the test's own read reports it.
    await waitUntil(() => routesLoading === 0, "the route to mount").catch(() => undefined);
    await settled();
  }

  return {
    screen,
    db,
    user,
    location: () => currentLocation,
    sync: (fixtures) => syncDown(db, flattenFixtures(fixtures)),
    unsync: (fixtures) => syncRemove(db, fixtures),
    queued: () => queuedWrites(db),
    query: (sql, params = []) => db.powersync.getAll(sql, params),
    settle: settled,
    connect: (connected) => setConnected(db, connected),
  };
};

/**
 * Render an element in a router (no database): for `ui/` primitives and
 * other pieces that only need links to work. Same `width` and `theme`.
 */
export const renderInRouter = async (
  element: ReactNode,
  options: { url?: string; width?: number; height?: number; theme?: "light" | "dark" } = {},
) => {
  await page.viewport(options.width ?? 420, options.height ?? 900);
  if (options.theme) document.documentElement.dataset.theme = options.theme;
  const url = options.url ?? "/";
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "*",
      Component: () => (
        <>
          <LocationProbe />
          {element}
        </>
      ),
    },
  ]);
  currentLocation = url;
  const screen = await render(<Stub initialEntries={[url]} />);
  return { screen, location: () => currentLocation };
};

/** After each test: unmount first (test/setup.ts), then close every device and reset the page. */
export const closeDevices = async () => {
  await installTestDatabase(null);
  for (const db of open) await db.powersync.close().catch(() => undefined);
  open.clear();
  window.fetch = realFetch;
  delete document.documentElement.dataset.theme;
  try {
    localStorage.clear();
  } catch {
    // No storage: nothing kept.
  }
};
