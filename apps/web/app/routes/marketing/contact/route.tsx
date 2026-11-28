import type { Route } from "./+types/route";

import { BAND_ALT, CONTAINER, H1, H3, LEAD, SECTION } from "../sections/look";
import { marketingMeta, siteUrlFrom } from "../site/meta";
import { pagePath } from "../site/pages";
import { ContactForm } from "./ContactForm";
import { content } from "./content";

export function meta({ matches }: Route.MetaArgs) {
  return marketingMeta({ ...content.meta, path: pagePath("contact"), siteUrl: siteUrlFrom(matches) });
}

export default function Page() {
  return (
    <section aria-labelledby="page-heading" className={BAND_ALT}>
      <div className={`${CONTAINER} ${SECTION} grid gap-10 md:grid-cols-[2fr_3fr] md:gap-14`}>
        <div>
          <h1 id="page-heading" className={H1}>
            {content.heading}
          </h1>
          <p className={`mt-5 ${LEAD}`}>{content.lead}</p>
          {content.notes.map((note) => (
            <div key={note.heading} className="mt-8">
              <h2 className={H3}>{note.heading}</h2>
              <p className="mt-2 leading-relaxed text-base-content/80">{note.body}</p>
            </div>
          ))}
        </div>
        <ContactForm copy={content.form} />
      </div>
    </section>
  );
}
