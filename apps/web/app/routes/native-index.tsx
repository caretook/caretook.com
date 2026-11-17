import { redirect } from "react-router";

// Native build only. Not part of the web route tree, so it has no generated +types.
export function clientLoader() {
  return redirect("/app");
}

export default function NativeIndex() {
  return null;
}
