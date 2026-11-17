import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Caretook" }];
}

export default function Home() {
  return (
    <main>
      <h1>Caretook</h1>
    </main>
  );
}
