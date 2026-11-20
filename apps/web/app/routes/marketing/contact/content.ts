import type { ContactPageContent } from "../sections/types";

/** The contact page's copy (draft: the user edits it). The form's layout is in ContactForm.tsx. */
export const content = {
  meta: {
    title: "Contact",
    description:
      "Questions about Caretook, need help, or want to ask about your privacy? Write to the team and we'll answer by email.",
  },
  heading: "Contact us",
  lead: "Questions, ideas, or something not working? Write to us and a real person will answer by email.",
  form: {
    name: { label: "Your name" },
    email: { label: "Your email", hint: "We'll reply to this address." },
    topic: { label: "What's it about?", none: "Choose one" },
    message: {
      label: "Message",
      hint: "Please don't include health details about the person you care for.",
    },
    submit: "Send message",
    sending: "Sending…",
    thanks: {
      heading: "Thanks, your message is on its way.",
      body: "We read every message and usually answer within a few days.",
    },
  },
  notes: [
    {
      heading: "About your privacy or data",
      body: 'Choose "Privacy or my data" to ask what we hold about you, or to have it corrected or deleted. Those messages come to us flagged, and we answer them first.',
    },
    {
      heading: "Already using Caretook?",
      body: "Sign in and tell us which care group you mean, but never send passwords or codes. We'll never ask for them.",
    },
  ],
} satisfies ContactPageContent;
