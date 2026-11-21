// The authorize step's dead ends, for a person in a browser (B-188).
//
// Better Auth's OAuth plugin answers an authorize request it can't send back
// to the client (an unknown or disabled client, a redirect URI the client
// never registered) by redirecting to its own error URL, which in production
// goes on to the home page with the error in the query; and some refusals
// (its rate limit) are a JSON body. An assistant's browser window shows
// neither as anything a member can act on. A browser navigation to authorize
// that ends there gets a plain page saying what to do instead; any other
// request (an assistant's server, a fetch, Accept: application/json) gets the
// plugin's answer as it is.

/** What a member sees when the connection link can't be used. */
export const CONNECTOR_LINK_INVALID_TEXT =
  "This connection link isn't valid any more. Remove Caretook from your assistant's connectors and add it again.";

/** What a member sees when they've tried to connect too often. */
export const CONNECTOR_TOO_MANY_TEXT =
  "Too many tries to connect. Wait a minute, then try again from your assistant.";

const AUTHORIZE_PATH = "/oauth2/authorize";

/** A person's browser loading the page, not a fetch or a server asking for JSON. */
const isBrowserNavigation = (request: Request) => {
  const mode = request.headers.get("sec-fetch-mode");
  const accept = request.headers.get("accept") ?? "";
  if (mode === "cors" || accept.includes("application/json")) return false;
  return mode === "navigate" || accept.includes("text/html");
};

/** The plugin's own error URL (`<basePath>/error`), where it sends what it can't return to the client. */
const isPluginErrorRedirect = (response: Response, authorizeUrl: URL) => {
  const location = response.headers.get("location");
  if (!location || response.status < 300 || response.status >= 400) return false;
  const target = new URL(location, authorizeUrl);
  const errorPath = `${authorizeUrl.pathname.slice(0, -AUTHORIZE_PATH.length)}/error`;
  return target.origin === authorizeUrl.origin && target.pathname === errorPath;
};

/** For element text (never an attribute). */
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A plain page: no scripts, no app shell (the CSP and headers are the server's). */
const page = (status: number, title: string, text: string) =>
  new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · Caretook</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:2rem 1rem;line-height:1.5}main{max-width:28rem;margin:0 auto}h1{font-size:1.5rem}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p data-connector-error="">${escapeHtml(text)}</p>
</main>
</body>
</html>
`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

/**
 * Better Auth's handler, with authorize's dead ends as a page for a browser
 * navigation. Everything else passes through untouched.
 */
export const withConnectorAuthorizePage =
  (handler: (request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    const response = await handler(request);
    const url = new URL(request.url);
    if (!url.pathname.endsWith(AUTHORIZE_PATH) || !isBrowserNavigation(request)) return response;
    if (response.status === 429) return page(429, "Try again in a minute", CONNECTOR_TOO_MANY_TEXT);
    if (isPluginErrorRedirect(response, url) || (response.status >= 400 && response.status < 500))
      return page(400, "This link isn't valid", CONNECTOR_LINK_INVALID_TEXT);
    return response;
  };
