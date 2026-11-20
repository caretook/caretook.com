// `~/.server/admin` under component tests (vitest.config.ts points
// `~/.server/*` here): the same exports, none of the server. A route's
// server loader and action never run on the test device (give the route
// `loaderData` and `actionResult`), so calling any of these is a mistake in
// the test.

const serverOnly = (name: string) => () => {
  throw new Error(`~/.server/admin's ${name} is server only: give the route loaderData or actionResult`);
};

export type AdminApi = never;

export const requireStaff: (request: Request, capability?: string) => Promise<never> =
  serverOnly("requireStaff");
export const joinUrl: (code: string) => string = serverOnly("joinUrl");
export const qrSvg: (text: string) => Promise<string> = serverOnly("qrSvg");
