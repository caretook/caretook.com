import type { Route } from "./+types/route";

import { marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { ContactForm } from "./ContactForm";
import { content } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({ ...content.meta, path: pagePath("contact"), siteUrl: siteUrlFrom(matches) });
}

export default function Page() {
  return (
    <section aria-labelledby="page-heading" className="bg-base-200">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[2fr_3fr]">
        <div>
          <h1 id="page-heading" className="text-4xl font-bold tracking-tight">
            {content.heading}
          </h1>
          <p className="mt-4 leading-relaxed text-base-content/80">{content.lead}</p>
          {content.notes.map((note) => (
            <div key={note.heading} className="mt-8">
              <h2 className="text-xl font-semibold">{note.heading}</h2>
              <p className="mt-2 leading-relaxed text-base-content/80">{note.body}</p>
            </div>
          ))}
        </div>
        <ContactForm copy={content.form} />
      </div>
    </section>
  );
}
