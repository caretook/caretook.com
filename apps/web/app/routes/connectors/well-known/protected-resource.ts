import { protectedResourceMetadata } from "~/.server/connectors";

// RFC 9728's metadata for /mcp (web only): the 401 from /mcp points here.
export const loader = () => protectedResourceMetadata();
