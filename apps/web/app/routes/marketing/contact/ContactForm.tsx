import type { ContactPageContent } from "../sections/types";

import { CONTACT_MESSAGE_MAX, CONTACT_TOPIC_LABELS, CONTACT_TOPICS, NAME_MAX } from "@caretook/data/schema";
import { formString } from "~/lib/core/form";
import { rpc } from "~/lib/core/rpc";
import {
  PublicFormFrame,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  usePublicForm,
} from "../sections/PublicForm";

const TOPIC_OPTIONS = CONTACT_TOPICS.map((value) => ({ value, label: CONTACT_TOPIC_LABELS[value] }));

/** The contact form: stored, and emailed to the team's support address. */
export function ContactForm({ copy }: { copy: ContactPageContent["form"] }) {
  const form = usePublicForm((data, guard) =>
    rpc.public.contact.send({
      name: formString(data, "name"),
      email: formString(data, "email"),
      topic: formString(data, "topic") as (typeof CONTACT_TOPICS)[number],
      message: formString(data, "message"),
      ...guard,
    }),
  );

  return (
    <PublicFormFrame label="Contact the Caretook team" form={form} thanks={copy.thanks}>
      <TextField
        name="name"
        autoComplete="name"
        maxLength={NAME_MAX}
        required
        copy={copy.name}
        error={form.error("name")}
      />
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        required
        copy={copy.email}
        error={form.error("email")}
      />
      <SelectField
        name="topic"
        required
        copy={copy.topic}
        none={copy.topic.none}
        options={TOPIC_OPTIONS}
        error={form.error("topic")}
      />
      <TextAreaField
        name="message"
        required
        maxLength={CONTACT_MESSAGE_MAX}
        copy={copy.message}
        error={form.error("message")}
      />
      <SubmitButton sending={form.sending} label={copy.submit} sendingLabel={copy.sending} />
    </PublicFormFrame>
  );
}
