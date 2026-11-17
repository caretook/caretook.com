import { Outlet } from "react-router";

// Shared by web + native. Do not export a server `loader` or `action` from /app routes.
export default function AppLayout() {
  return <Outlet />;
}
