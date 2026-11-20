import { redirect } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";

// Native build only. Not part of the web route tree, so it has no generated +types.
export function clientLoader() {
  return redirect(appUrls.home());
}

export default function NativeIndex() {
  return null;
}
