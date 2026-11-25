import { useEffect, useState } from "react";
import { requireDevUi } from "~/.server/devUi";
import { ChoiceGroup, ToastRegion } from "~/components/ui";
import { GALLERY } from "./registry";

// The dev UI gallery (web only, 404 in production): every ui/ primitive and
// its variants on one page, with fictional data, in light or dark.
export const meta = () => [{ title: "UI gallery · Caretook" }, { name: "robots", content: "noindex" }];

export const loader = () => {
  requireDevUi();
  return null;
};

type Theme = "light" | "dark";
const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

/**
 * The page's theme, set on `<html>` (sheets, popovers and dialogs render
 * outside the page, so a wrapper's theme wouldn't reach them). Nothing is
 * stored: leaving the page puts back the theme it found.
 */
function useGalleryTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    return () => {
      if (before === undefined) delete root.dataset.theme;
      else root.dataset.theme = before;
    };
  }, []);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, setTheme] as const;
}

export default function DevUi() {
  const [theme, setTheme] = useGalleryTheme();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">UI gallery</h1>
          <p className="text-base-content/70 text-sm">
            Every primitive in <code>components/ui</code>, with made-up data.
          </p>
        </div>
        <ChoiceGroup name="theme" label="Theme" options={THEMES} value={theme} onChange={setTheme} />
      </header>
      <nav aria-label="Sections" className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {GALLERY.map(({ id, title }) => (
          <a key={id} href={`#${id}`} className="link">
            {title}
          </a>
        ))}
      </nav>
      {GALLERY.map(({ id, title, Section }) => (
        <section
          key={id}
          id={id}
          aria-labelledby={`${id}-title`}
          data-gallery-section={id}
          className="rounded-box border-base-300 bg-base-100 scroll-mt-4 space-y-4 border p-4"
        >
          <h2 id={`${id}-title`} className="text-base font-semibold">
            {title}
          </h2>
          <Section />
        </section>
      ))}
      <ToastRegion />
    </main>
  );
}
