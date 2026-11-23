import { ASSISTANT_REQUEST_WINDOW_DAYS } from "@caretook/data/schema";
import { Button, Message } from "~/components/ui/plain";
import { ASK_OWNERS, ASKED_NOTE, askedOn, ASKING_OWNERS, canAskAgain } from "~/lib/connectors/connectGuide";
import { useAskOwners } from "./useAskOwners";

/**
 * "Ask owners to turn this on" (connectors-2, B-194), for a member who isn't
 * an owner while the group's switch is off: emails every owner. After
 * asking, "Asked on <date>" until a week has passed. `askedAt` is the last
 * request when the page already has it (/connect); without it, it loads.
 */
export function AskOwners({ groupId, askedAt: initial }: { groupId: string; askedAt?: string | null }) {
  const { askedAt, busy, error, ask } = useAskOwners(groupId, initial);
  if (askedAt === undefined) return <div data-ask-owners="loading" />;
  const asked = !canAskAgain(askedAt, new Date(), ASSISTANT_REQUEST_WINDOW_DAYS);

  return (
    <div className="space-y-2" data-ask-owners={asked ? "asked" : "ask"}>
      {asked && askedAt ? (
        <p role="status" className="text-sm">
          <strong className="font-medium" data-asked-on="">
            {askedOn(askedAt)}
          </strong>
          . {ASKED_NOTE}
        </p>
      ) : (
        <Button size="sm" busy={busy} busyLabel={ASKING_OWNERS} onClick={() => void ask()}>
          {ASK_OWNERS}
        </Button>
      )}
      {error && <Message tone="error">{error}</Message>}
    </div>
  );
}
