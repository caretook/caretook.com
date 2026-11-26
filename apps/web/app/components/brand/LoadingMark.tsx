import { LogoMark } from "./Logo";

/**
 * The loading look shared by the app's start-up screen (`AppLoading`) and the
 * in-app page loader (`ui/PageLoading`, B-908): the mark over a spinner and
 * the message, a status named by the message. Plain classes on the theme
 * tokens, so it renders before any script runs; its container's CSS
 * (`[data-app-loading]`, `[data-page-loading]` in app.css) fades it in and
 * drops the spinner under reduced motion.
 */
export function LoadingMark({ message }: { message: string }) {
  return (
    <div role="status" aria-label={message} className="flex flex-col items-center gap-4">
      <LogoMark className="size-16" />
      <p className="text-muted flex items-center gap-2">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
        {message}
      </p>
    </div>
  );
}
