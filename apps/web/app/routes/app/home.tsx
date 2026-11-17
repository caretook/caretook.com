import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Caretook" }];
}

export default function AppHome() {
  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}
