import { LogoMark } from "./Logo";

export type LoadingMarkProps = {
  /** What's loading (a startup step's words): a polite status, named by it. */
  message: string;
  /** Shown after the message but not announced ("40%": the bar carries the number). */
  detail?: string;
  /** A progress bar under the message (value of 100), named by `label`; none without it. */
  progress?: { value: number; label: string };
};

/**
 * The loading look shared by the app's start-up screen (`AppLoading`) and the
 * in-app page loader (`ui/PageLoading`, B-908): the mark over a spinner and
 * the message, a status named by the message, and, while the app starts
 * (B-957), a `<progress>` bar. Only the message is in the live region, so a
 * step change is announced and a percentage isn't. Plain classes on the theme
 * tokens, so it renders before any script runs; its container's CSS
 * (`[data-app-loading]`, `[data-page-loading]` in app.css) fades it in and
 * drops the spinner and the bar under reduced motion.
 */
export function LoadingMark({ message, detail, progress }: LoadingMarkProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <LogoMark className="size-16" />
      <p className="text-muted flex items-center gap-2">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        <span role="status" aria-label={message}>
          {message}
        </span>
        {detail && (
          <span aria-hidden="true" className="tabular-nums" data-loading-detail="">
            {detail}
          </span>
        )}
      </p>
      {progress && (
        <progress
          className="progress progress-primary w-48"
          value={progress.value}
          max={100}
          aria-label={progress.label}
        />
      )}
    </div>
  );
}
