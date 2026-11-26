import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { LoadingMark } from "~/components/brand";
import { appUrls } from "~/lib/app-shell/appUrls";
import { Button } from "./Button";

/** How long a load runs before the "taking a while" prompt shows (ms). */
export const PAGE_LOADING_SLOW_AFTER = 10_000;

export type PageLoadingProps = {
  /** What's loading ("Getting your care groups…"): the status's name and its text. */
  message: string;
  /** Show Go back from the start, to cancel the load (it always shows once the load is slow). */
  back?: boolean;
  /** Go back's text ("Go back"). */
  backLabel?: string;
  /** Instead of the default (a step back in history, else the groups list). */
  onBack?: () => void;
  /** Milliseconds before the "taking a while" prompt (`PAGE_LOADING_SLOW_AFTER`); `null` never shows it. */
  slowAfter?: number | null;
  /** The prompt's text ("This is taking a while."). */
  slowMessage?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
};

/**
 * A full-page load inside the /app frame (B-908): the start-up screen's look
 * (`LoadingMark`: the mark, spinner and message), centred in the content
 * under the header, as the page's `main`. Like the start-up screen it stays
 * invisible for its first 300 ms (app.css's `[data-page-loading]`). After
 * `slowAfter` it says the load is taking a while and offers Go back, which
 * steps back in history when the app has any, else opens the groups list.
 */
export function PageLoading({
  message,
  back = false,
  backLabel = "Go back",
  onBack,
  slowAfter = PAGE_LOADING_SLOW_AFTER,
  slowMessage = "This is taking a while.",
  ...data
}: PageLoadingProps) {
  const slow = useSlow(slowAfter);
  const goBack = useGoBack();
  return (
    <main {...data} data-page-loading="" className="grid min-h-[70dvh] place-items-center px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <LoadingMark message={message} />
        {slow && (
          <p role="status" className="text-muted text-sm" data-page-loading-slow="">
            {slowMessage}
          </p>
        )}
        {(back || slow) && (
          <Button size="sm" onClick={onBack ?? goBack} data-page-loading-back="">
            {backLabel}
          </Button>
        )}
      </div>
    </main>
  );
}

/** True once `after` ms have passed since mounting (never with `null`). */
function useSlow(after: number | null) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (after === null) return;
    const timer = setTimeout(() => setSlow(true), after);
    return () => clearTimeout(timer);
  }, [after]);
  return slow;
}

/**
 * Back in history when this app put an entry there (the router's first
 * entry has the key "default"), else to the groups list.
 */
function useGoBack() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => {
    if (key === "default") void navigate(appUrls.groupList());
    else void navigate(-1);
  };
}
