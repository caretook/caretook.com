// `~/.server/connectors` under component tests (vitest.config.ts points
// `~/.server/*` here): the same exports, none of the server. /connect's
// loader and action never run on the test device (give the route
// `loaderData` and `actionResult`), so calling any of these is a mistake.
import type { AuthUser } from "@caretook/data/permissions";
import type { ConnectorScope } from "@caretook/data/schema";

const serverOnly = (name: string) => () => {
  throw new Error(`~/.server/connectors' ${name} is server only: give the route loaderData or actionResult`);
};

export type ConnectGroup = {
  id: string;
  name: string;
  recipientName: string | null;
  role: NonNullable<AuthUser["groupRoles"]>[string];
  scopes: readonly ConnectorScope[];
};
export type ConnectPage =
  | { state: "invalid" }
  | { state: "consent"; client: { name: string; redirectHost: string }; groups: ConnectGroup[] };

export const loadConnect: (request: Request) => Promise<ConnectPage> = serverOnly("loadConnect");
export const submitConnect: (request: Request, form: FormData) => Promise<{ error: string }> =
  serverOnly("submitConnect");
export const handleMcpRequest: (request: Request) => Promise<Response> = serverOnly("handleMcpRequest");
export const protectedResourceMetadata: () => Response = serverOnly("protectedResourceMetadata");
export const authorizationServerMetadata: (request: Request) => Promise<Response> = serverOnly(
  "authorizationServerMetadata",
);
