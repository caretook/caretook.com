import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/route";

import { loadConnect, submitConnect } from "~/.server/connectors";
import { connectedTitle } from "~/lib/connectors/connectSuccess";
import {
  ConnectCard,
  ConnectConsent,
  ConnectInvalid,
  ConnectSuccess,
  NoEligibleGroups,
} from "./ConnectConsent";

// /connect (web only, connectors PRD): the consent step of connecting a
// member's own AI assistant. Better Auth's OAuth plugin sends the member
// here with a signed query; signed out, they sign in first and come back.
// They pick one care group (only groups whose owners turned Assistants on),
// what the assistant may do (by their role), and tick the consent; Connect
// records the grant and shows the success step, which returns them to the
// assistant with a code; Cancel returns them with nothing connected.

export const meta = () => [
  { title: "Connect an assistant · Caretook" },
  { name: "robots", content: "noindex" },
];

export const loader = ({ request }: Route.LoaderArgs) => loadConnect(request);

export const action = async ({ request }: Route.ActionArgs) =>
  submitConnect(request, await request.formData());

/** After Connect, the success step needs nothing more from the server: skip reloading the consent page. */
export const shouldRevalidate = ({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) =>
  actionResult && typeof actionResult === "object" && "connected" in actionResult
    ? false
    : defaultShouldRevalidate;

export default function Connect({ loaderData, actionData }: Route.ComponentProps) {
  if (actionData && "connected" in actionData) {
    return (
      <ConnectCard title={connectedTitle(actionData.connected.groupName)}>
        <ConnectSuccess connected={actionData.connected} />
      </ConnectCard>
    );
  }
  if (loaderData.state === "invalid") return <ConnectInvalid />;
  const { client, groups } = loaderData;
  return (
    <ConnectCard title={`Connect ${client.name}`}>
      <p className="text-sm">
        <strong>{client.name}</strong> wants to use your Caretook account. When you’re done, it sends you back
        to <strong data-redirect-host="">{client.redirectHost}</strong>.
      </p>
      {groups.length ? <ConnectConsent groups={groups} error={actionData?.error} /> : <NoEligibleGroups />}
    </ConnectCard>
  );
}
