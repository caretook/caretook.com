// `~/.server/devUi` under component tests (vitest.config.ts points
// `~/.server/*` here): the same exports, none of the server. The gallery's
// loader never runs on the test device (give the route `loaderData`), so
// calling any of these is a mistake in the test.

const serverOnly = (name: string) => () => {
  throw new Error(`~/.server/devUi's ${name} is server only: give the route loaderData`);
};

export const devUiEnabled: () => boolean = serverOnly("devUiEnabled");
export const requireDevUi: () => void = serverOnly("requireDevUi");
