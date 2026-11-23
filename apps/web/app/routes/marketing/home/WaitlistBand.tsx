import type { WaitlistBandContent } from "../sections/types";

import { CARING_FOR, CARING_FOR_LABELS, HEARD_FROM_MAX, NAME_MAX } from "@caretook/data/schema";
import { formString } from "~/lib/core/form";
import { rpc } from "~/lib/core/rpc";
import { waitlistSource } from "../sections/forms";
import { PublicFormFrame, SelectField, SubmitButton, TextField, usePublicForm } from "../sections/PublicForm";
import { CTA_ON_ACCENT, CtaLink } from "../sections/Sections";

const CARING_FOR_OPTIONS = CARING_FOR.map((value) => ({ value, label: CARING_FOR_LABELS[value] }));

/**
 * Home's waitlist band (`/#waitlist`): the form, and "Have an access code?".
 * The page and any UTM parameters go with the entry as its source.
 */
export function WaitlistBand({ content }: { content: WaitlistBandContent }) {
  const copy = content.form;
  const form = usePublicForm((data, guard) =>
    rpc.public.waitlist.join({
      email: formString(data, "email"),
      firstName: formString(data, "firstName"),
      caringFor: formString(data, "caringFor") as (typeof CARING_FOR)[number] | "",
      heardFrom: formString(data, "heardFrom"),
      source: waitlistSource(window.location.pathname, window.location.search),
      ...guard,
    }),
  );

  return (
    <section
      id={content.id}
      aria-labelledby={`${content.id}-heading`}
      className="scroll-mt-20 bg-primary text-primary-content"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[2fr_3fr]">
        <div>
          <h2 id={`${content.id}-heading`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {content.heading}
          </h2>
          <p className="mt-3 leading-relaxed">{content.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {content.actions.map((cta) => (
              <CtaLink key={cta.href} cta={cta} className={CTA_ON_ACCENT} />
            ))}
          </div>
        </div>
        <PublicFormFrame label={content.heading} form={form} thanks={copy.thanks}>
          <TextField
            name="email"
            type="email"
            autoComplete="email"
            required
            copy={copy.email}
            error={form.error("email")}
          />
          <TextField
            name="firstName"
            autoComplete="given-name"
            maxLength={NAME_MAX}
            copy={copy.firstName}
            error={form.error("firstName")}
          />
          <SelectField
            name="caringFor"
            copy={copy.caringFor}
            none={copy.caringFor.none}
            options={CARING_FOR_OPTIONS}
            error={form.error("caringFor")}
          />
          <TextField
            name="heardFrom"
            maxLength={HEARD_FROM_MAX}
            copy={copy.heardFrom}
            error={form.error("heardFrom")}
          />
          <SubmitButton sending={form.sending} label={copy.submit} sendingLabel={copy.sending} />
        </PublicFormFrame>
      </div>
    </section>
  );
}
