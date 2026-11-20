import type { Route } from "./+types/route";

import { handleMcpRequest } from "~/.server/connectors";

// /mcp (web only): the MCP endpoint members' assistants call, server to
// server, with an OAuth bearer token (@caretook/api's connectors module).
// POST only; GET answers 405, so clients don't expect an SSE stream.
export const loader = ({ request }: Route.LoaderArgs) => handleMcpRequest(request);
export const action = ({ request }: Route.ActionArgs) => handleMcpRequest(request);
