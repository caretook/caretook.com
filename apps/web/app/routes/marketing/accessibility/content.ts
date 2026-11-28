import type { LegalPageContent } from "../sections/legal";

/**
 * Accessibility statement (DRAFT: the user edits it). Rendered by `LegalPage`
 * like the legal pages, but a `site` page, not `legal` (that area is the
 * three documents people accept at sign-up).
 *
 * Keep it true: each "what we do" point is checked against the code (the
 * typeface and focus ring in `app.css`, motion and native controls in
 * docs/domain/components.md, the theme in docs/domain/app-shell.md, the
 * jsx-a11y lint in `eslint.config.mjs`). Change this page when one changes.
 */
export const content = {
  meta: {
    title: "Accessibility",
    description:
      "The accessibility standard Caretook works to, what we do to meet it, what we know isn't there yet, and how to tell us about a barrier.",
  },
  heading: "Accessibility statement",
  lastUpdated: "2026-11-28",
  draft: true,
  intro: [
    "Caretook should work for everyone in a care group, including people who use a screen reader, a keyboard, magnification or other assistive technology. This statement says what we aim for, what we do today, and what we know falls short.",
  ],
  sections: [
    {
      id: "our-standard",
      heading: "Our standard",
      summary:
        "We work to WCAG 2.2 at level AA. No one outside Caretook has audited the site or the app against it yet.",
      formal: [
        "Our target for the Caretook website and web app is the Web Content Accessibility Guidelines (WCAG) 2.2, level AA, published by the World Wide Web Consortium (W3C).",
        "This is a goal we design and test against, not a claim of conformance. Caretook has not been independently audited.",
      ],
    },
    {
      id: "what-we-do",
      heading: "What we do",
      summary:
        "A typeface made for legibility, a focus ring you can always see, motion that respects your settings, standard controls, light and dark themes, and automatic accessibility checks on our code.",
      formal: [
        {
          list: [
            "Text is set in Atkinson Hyperlegible Next, a typeface designed to keep letters that look alike easy to tell apart.",
            "Keyboard focus always shows a visible outline on links, buttons and form fields.",
            "Animations play only when your device allows motion. If you have asked for reduced motion, they are turned off.",
            "We use the browser's own buttons, links, form fields and dialogs wherever they do the job, so assistive technology recognizes them.",
            "Caretook has light and dark themes. It follows your device's setting unless you choose one in the app.",
            "Our code is checked by accessibility lint rules that catch common problems, such as images without text alternatives and controls without labels.",
            "Each page of this website starts with a link that skips straight to its main content.",
          ],
        },
      ],
    },
    {
      id: "known-gaps",
      heading: "Known gaps",
      summary:
        "The pictures of the app on this site are placeholders for now, and we haven't had an outside audit.",
      formal: [
        {
          list: [
            "The screenshots on this website are placeholder drawings, not pictures of the real app.",
            "No independent accessibility audit has been done, so there may be barriers we don't know about.",
          ],
        },
        "If you find one, please tell us (see [how to report a barrier](#report-a-barrier)).",
      ],
    },
    {
      id: "report-a-barrier",
      heading: "How to report a barrier",
      summary:
        "If something on the site or in the app doesn't work for you, tell us through the [contact page](/contact).",
      formal: [
        "Write to us through the [contact page](/contact). It helps to say which page you were on, what you were trying to do, and the device, browser and assistive technology you use, but send what you can.",
        "We will reply, and tell you what we can do about it.",
      ],
    },
    {
      id: "this-statement",
      heading: "About this statement",
      summary:
        "We wrote this statement on the date at the top of the page and will update it as things change.",
      formal: [
        "This statement was last reviewed on the date shown at the top of the page. We will update it when we change how Caretook works or learn of new barriers.",
      ],
    },
  ],
} satisfies LegalPageContent;
